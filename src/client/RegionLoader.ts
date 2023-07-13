import { ObjectDefinition } from "./fs/definition/ObjectDefinition";
import { OverlayDefinition } from "./fs/definition/floor/OverlayDefinition";
import { ObjectLoader } from "./fs/loader/ObjectLoader";
import { FloorLoader, OverlayLoader } from "./fs/loader/OverlayLoader";
import { ObjectModelLoader } from "./fs/loader/model/ObjectModelLoader";
import { VarpManager } from "./VarpManager";
import { LandscapeLoadMode, Scene } from "./scene/Scene";
import { CacheInfo } from "./fs/Types";
import { GenericIndex } from "./fs/Index";
import { FloorDefinition } from "./fs/definition/floor/FloorDefinition";
import { MapIndex } from "./MapIndex";

export class RegionLoader {
    static readonly SCENE_BORDER_RADIUS = 5;

    cacheInfo: CacheInfo;

    mapIndex: MapIndex;

    mapCacheIndex: GenericIndex;

    underlayLoader: FloorLoader;
    overlayLoader: OverlayLoader;

    objectLoader: ObjectLoader;
    objectModelLoader: ObjectModelLoader;

    xteasMap: Map<number, number[]>;

    varpManager: VarpManager;

    regions: Map<number, Scene> = new Map();

    static getRegionId(regionX: number, regionY: number): number {
        return (regionX << 8) | regionY;
    }

    constructor(
        cacheInfo: CacheInfo,
        mapIndex: MapIndex,
        mapCacheIndex: GenericIndex,
        underlayLoader: FloorLoader,
        overlayLoader: OverlayLoader,
        objectLoader: ObjectLoader,
        objectModelLoader: ObjectModelLoader,
        xteasMap: Map<number, number[]>,
        varpManager: VarpManager
    ) {
        this.cacheInfo = cacheInfo;
        this.mapIndex = mapIndex;
        this.mapCacheIndex = mapCacheIndex;
        this.underlayLoader = underlayLoader;
        this.overlayLoader = overlayLoader;
        this.objectLoader = objectLoader;
        this.objectModelLoader = objectModelLoader;
        this.xteasMap = xteasMap;
        this.varpManager = varpManager;
    }

    getTerrainData(regionX: number, regionY: number): Int8Array | undefined {
        const archiveId = this.mapIndex.getTerrainArchiveId(regionX, regionY);
        if (archiveId === -1) {
            return undefined;
        }
        try {
            const file = this.mapCacheIndex.getFile(archiveId, 0);
            return file && file.data;
        } catch (e) {
            return undefined;
        }
    }

    getLandscapeData(regionX: number, regionY: number): Int8Array | undefined {
        const archiveId = this.mapIndex.getLandscapeArchiveId(regionX, regionY);
        if (archiveId === -1) {
            return undefined;
        }
        const key = this.xteasMap.get(archiveId);
        const file = this.mapCacheIndex.getFile(archiveId, 0, key);
        return file && file.data;
    }

    getRegion(
        regionX: number,
        regionY: number,
        loadMode: LandscapeLoadMode = LandscapeLoadMode.MODELS
    ): Scene | undefined {
        const id = RegionLoader.getRegionId(regionX, regionY);

        let region = this.regions.get(id);

        if (!region) {
            region = new Scene(
                regionX,
                regionY,
                RegionLoader.SCENE_BORDER_RADIUS,
                Scene.MAX_PLANE
            );

            const halfSceneWidth = region.sizeX / 2;
            const halfSceneHeight = region.sizeY / 2;

            const regionStartX = Math.floor(
                (region.centerX - halfSceneWidth) / 64
            );
            const regionStartY = Math.floor(
                (region.centerY - halfSceneHeight) / 64
            );

            const regionEndX = Math.ceil(
                (region.centerX + halfSceneWidth) / 64
            );
            const regionEndY = Math.ceil(
                (region.centerY + halfSceneHeight) / 64
            );

            for (let rx = regionStartX; rx < regionEndX; rx++) {
                for (let ry = regionStartY; ry < regionEndY; ry++) {
                    const terrainData = this.getTerrainData(rx, ry);
                    if (!terrainData) {
                        continue;
                    }
                    const offsetX = rx * Scene.MAP_SIZE - region.startX;
                    const offsetY = ry * Scene.MAP_SIZE - region.startY;
                    region.decodeTerrain(
                        terrainData,
                        offsetX,
                        offsetY,
                        region.startX,
                        region.startY,
                        this.cacheInfo.game === "oldschool" &&
                            this.cacheInfo.revision >= 209
                    );
                }
            }

            for (let rx = regionStartX; rx < regionEndX; rx++) {
                for (let ry = regionStartY; ry < regionEndY; ry++) {
                    const offsetX = rx * Scene.MAP_SIZE - region.startX;
                    const offsetY = ry * Scene.MAP_SIZE - region.startY;

                    let landscapeData: Int8Array | undefined;
                    try {
                        landscapeData = this.getLandscapeData(rx, ry);
                    } catch (e) {}
                    if (landscapeData) {
                        region.decodeLandscape(
                            this,
                            this.objectModelLoader,
                            landscapeData,
                            offsetX,
                            offsetY,
                            loadMode
                        );
                    }
                }
            }

            this.regions.set(id, region);
        }

        return region;
    }

    getUnderlayDef(id: number): FloorDefinition {
        return this.underlayLoader.getDefinition(id);
    }

    getOverlayDef(id: number): OverlayDefinition {
        return this.overlayLoader.getDefinition(id);
    }

    getObjectDef(id: number): ObjectDefinition {
        return this.objectLoader.getDefinition(id);
    }
}
