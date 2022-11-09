import { ObjectDefinition } from "./fs/definition/ObjectDefinition";
import { OverlayDefinition } from "./fs/definition/OverlayDefinition";
import { UnderlayDefinition } from "./fs/definition/UnderlayDefinition";
import { IndexSync } from "./fs/Index";
import { ObjectLoader } from "./fs/loader/ObjectLoader";
import { OverlayLoader } from "./fs/loader/OverlayLoader";
import { UnderlayLoader } from "./fs/loader/UnderlayLoader";
import { StoreSync } from "./fs/Store";
import { Scene } from "./Scene";
import { packHsl } from "./util/ColorUtil";

export class RegionLoader {
    mapIndex: IndexSync<StoreSync>;

    underlayLoader: UnderlayLoader;

    overlayLoader: OverlayLoader;

    objectLoader: ObjectLoader;

    xteasMap: Map<number, number[]>;

    regions: Map<number, Scene> = new Map();

    invalidRegions: Set<number> = new Set();

    blendedUnderlayColors: Map<number, Int32Array[][]> = new Map();

    lightLevels: Map<number, Int32Array[][]> = new Map();

    static getRegionId(regionX: number, regionY: number): number {
        return regionX << 8 | regionY;
    }

    constructor(mapIndex: IndexSync<StoreSync>, underlayLoader: UnderlayLoader, overlayLoader: OverlayLoader, objectLoader: ObjectLoader, xteasMap: Map<number, number[]>) {
        this.mapIndex = mapIndex;
        this.underlayLoader = underlayLoader;
        this.overlayLoader = overlayLoader;
        this.objectLoader = objectLoader;
        this.xteasMap = xteasMap;
    }

    getTerrainArchiveId(regionX: number, regionY: number): number {
        return this.mapIndex.getArchiveId(`m${regionX}_${regionY}`);
    }

    getLandscapeArchiveId(regionX: number, regionY: number): number {
        return this.mapIndex.getArchiveId(`l${regionX}_${regionY}`);
    }

    getTerrainData(regionX: number, regionY: number): Int8Array | undefined {
        const archiveId = this.getTerrainArchiveId(regionX, regionY);
        if (archiveId === -1) {
            return undefined;
        }
        const file = this.mapIndex.getFile(archiveId, 0);
        return file && file.data;
    }

    getLandscapeData(regionX: number, regionY: number): Int8Array | undefined {
        const archiveId = this.getLandscapeArchiveId(regionX, regionY);
        if (archiveId === -1) {
            return undefined;
        }
        const key = this.xteasMap.get(archiveId);
        if (!key) {
            return undefined;
        }
        const file = this.mapIndex.getFile(archiveId, 0, key);
        return file && file.data;
    }

    getRegion(regionX: number, regionY: number): Scene | undefined {
        const id = RegionLoader.getRegionId(regionX, regionY);

        if (this.invalidRegions.has(id)) {
            return undefined;
        }

        let region = this.regions.get(id);

        if (!region) {
            // console.time(`load region ${regionX}_${regionY}`);
            // console.log('load region', regionX, regionY);
            const terrainData = this.getTerrainData(regionX, regionY);
            if (terrainData) {
                region = new Scene(209, Scene.MAX_PLANE, Scene.MAP_SIZE, Scene.MAP_SIZE);
                region.decodeTerrain(terrainData, 0, 0, regionX * 64, regionY * 64);

                this.regions.set(id, region);
            } else {
                this.invalidRegions.add(id);
            }
            // console.timeEnd(`load region ${regionX}_${regionY}`);
        }

        return region;
    }

    getUnderlayDef(id: number): UnderlayDefinition {
        return this.underlayLoader.getDefinition(id);
    }

    getOverlayDef(id: number): OverlayDefinition {
        return this.overlayLoader.getDefinition(id);
    }

    getObjectDef(id: number): ObjectDefinition {
        return this.objectLoader.getDefinition(id);
    }

    getHeight(x: number, y: number, plane: number): number {
        x |= 0;
        y |= 0;
        const region = this.getRegion(x / 64 | 0, y / 64 | 0);
        if (!region) {
            return 0;
        }
        // added height based on plane to fix zfighting on bridges
        return region.tileHeights[plane][x % 64][y % 64];// - plane * 0.5;
    }

    getHeightInterp(x: number, y: number, plane: number): number {
        const h00 = this.getHeight(x, y, plane);
        const h10 = this.getHeight(x + 1, y, plane);
        const h01 = this.getHeight(x, y + 1, plane);
        const h11 = this.getHeight(x + 1, y + 1, plane);

        // bilinear interpolation
        return h00 * (1 - x % 1) * (1 - y % 1) +
            h10 * (x % 1) * (1 - y % 1) +
            h01 * (1 - x % 1) * (y % 1) +
            h11 * (x % 1) * (y % 1);
    }

    getUnderlayId(x: number, y: number, plane: number): number {
        const region = this.getRegion(x / 64 | 0, y / 64 | 0);
        if (!region) {
            return -1;
        }
        return region.tileUnderlays[plane][x % 64][y % 64] - 1;
    }

    getUnderlay(x: number, y: number, plane: number): UnderlayDefinition {
        return this.getUnderlayDef(this.getUnderlayId(x, y, plane));
    }

    getOverlayId(x: number, y: number, plane: number): number {
        const region = this.getRegion(x / 64 | 0, y / 64 | 0);
        if (!region) {
            return -1;
        }
        return region.tileOverlays[plane][x % 64][y % 64] - 1;
    }

    getTileShape(x: number, y: number, plane: number): number {
        const region = this.getRegion(x / 64 | 0, y / 64 | 0);
        if (!region) {
            return -1;
        }
        return region.tileShapes[plane][x % 64][y % 64] + 1;
    }

    getTileRotation(x: number, y: number, plane: number): number {
        const region = this.getRegion(x / 64 | 0, y / 64 | 0);
        if (!region) {
            return -1;
        }
        return region.tileRotations[plane][x % 64][y % 64];
    }

    blendUnderlays(regionX: number, regionY: number, plane: number): Int32Array[] {
        const BLEND = 5;

        const baseX = regionX * Scene.MAP_SIZE;
        const baseY = regionY * Scene.MAP_SIZE;

        const colors: Int32Array[] = new Array(Scene.MAP_SIZE);
        for (let i = 0; i < Scene.MAP_SIZE; i++) {
            colors[i] = new Int32Array(Scene.MAP_SIZE).fill(-1);
        }

        const hues = new Int32Array(Scene.MAP_SIZE + BLEND * 2);
        const sats = new Int32Array(hues.length);
        const light = new Int32Array(hues.length);
        const mul = new Int32Array(hues.length);
        const num = new Int32Array(hues.length);

        // console.time(`load regions ${regionX}_${regionY}`);
        const hasLeftRegion = !!this.getRegion(regionX - 1, regionY);
        const hasRightRegion = !!this.getRegion(regionX + 1, regionY);
        const hasUpRegion = !!this.getRegion(regionX, regionY + 1);
        const hasDownRegion = !!this.getRegion(regionX, regionY - 1);
        // console.timeEnd(`load regions ${regionX}_${regionY}`);

        for (let xi = (hasLeftRegion ? -BLEND * 2 : -BLEND); xi < Scene.MAP_SIZE + (hasRightRegion ? BLEND * 2 : BLEND); xi++) {
            for (let yi = (hasDownRegion ? -BLEND : 0); yi < Scene.MAP_SIZE + (hasUpRegion ? BLEND : 0); yi++) {
                const xr = xi + BLEND;
                if (xr >= (hasLeftRegion ? -BLEND : 0) && xr < Scene.MAP_SIZE + (hasRightRegion ? BLEND : 0)) {
                    const underlayId = this.getUnderlayId(baseX + xr, baseY + yi, plane);
                    if (underlayId != -1) {
                        const underlay = this.getUnderlayDef(underlayId);
                        hues[yi + BLEND] += underlay.hue;
                        sats[yi + BLEND] += underlay.saturation;
                        light[yi + BLEND] += underlay.lightness;
                        mul[yi + BLEND] += underlay.hueMultiplier;
                        num[yi + BLEND]++;
                    }

                }

                const xl = xi - BLEND;
                if (xl >= (hasLeftRegion ? -BLEND : 0) && xl < Scene.MAP_SIZE + (hasRightRegion ? BLEND : 0)) {
                    const underlayId = this.getUnderlayId(baseX + xl, baseY + yi, plane);
                    if (underlayId != -1) {
                        const underlay = this.getUnderlayDef(underlayId);
                        hues[yi + BLEND] -= underlay.hue;
                        sats[yi + BLEND] -= underlay.saturation;
                        light[yi + BLEND] -= underlay.lightness;
                        mul[yi + BLEND] -= underlay.hueMultiplier;
                        num[yi + BLEND]--;
                    }

                }
            }


            if (xi >= 0 && xi < Scene.MAP_SIZE) {
                let runningHues = 0;
                let runningSat = 0;
                let runningLight = 0;
                let runningMultiplier = 0;
                let runningNumber = 0;

                for (let yi = (hasDownRegion ? -BLEND * 2 : -BLEND); yi < Scene.MAP_SIZE + (hasUpRegion ? BLEND * 2 : BLEND); yi++) {
                    const yu = yi + BLEND;
                    if (yu >= (hasDownRegion ? -BLEND : 0) && yu < Scene.MAP_SIZE + (hasUpRegion ? BLEND : 0)) {
                        runningHues += hues[yu + BLEND];
                        runningSat += sats[yu + BLEND];
                        runningLight += light[yu + BLEND];
                        runningMultiplier += mul[yu + BLEND];
                        runningNumber += num[yu + BLEND];
                    }

                    const yd = yi - BLEND;
                    if (yd >= (hasDownRegion ? -BLEND : 0) && yd < Scene.MAP_SIZE + (hasUpRegion ? BLEND : 0)) {
                        runningHues -= hues[yd + BLEND];
                        runningSat -= sats[yd + BLEND];
                        runningLight -= light[yd + BLEND];
                        runningMultiplier -= mul[yd + BLEND];
                        runningNumber -= num[yd + BLEND];
                    }

                    if (yi >= 0 && yi < Scene.MAP_SIZE) {
                        const underlayId = this.getUnderlayId(baseX + xi, baseY + yi, plane);
                        if (underlayId != -1) {
                            const avgHue = (runningHues * 256 / runningMultiplier) | 0;
                            const avgSat = (runningSat / runningNumber) | 0;
                            const avgLight = (runningLight / runningNumber) | 0;

                            colors[xi][yi] = packHsl(avgHue, avgSat, avgLight);
                        }
                    }
                }
            }
        }

        return colors;
    }

    getBlendedUnderlayColors(regionX: number, regionY: number): Int32Array[][] {
        const regionId = RegionLoader.getRegionId(regionX, regionY);

        let colors = this.blendedUnderlayColors.get(regionId);
        if (!colors) {
            colors = new Array(Scene.MAX_PLANE);
            for (let i = 0; i < Scene.MAX_PLANE; i++) {
                colors[i] = this.blendUnderlays(regionX, regionY, i);
            }
            this.blendedUnderlayColors.set(regionId, colors);
        }
        return colors;
    }

    getBlendedUnderlayColor(x: number, y: number, plane: number): number {
        const regionX = x / 64 | 0;
        const regionY = y / 64 | 0;

        let colors = this.getBlendedUnderlayColors(regionX, regionY);
        return colors[plane][x % 64][y % 64];
    }

    calculateLightLevels(regionX: number, regionY: number, plane: number): Int32Array[] {
        const baseX = regionX * Scene.MAP_SIZE;
        const baseY = regionY * Scene.MAP_SIZE;

        const levels: Int32Array[] = new Array(Scene.MAP_SIZE);
        for (let i = 0; i < Scene.MAP_SIZE; i++) {
            levels[i] = new Int32Array(Scene.MAP_SIZE);
        }


        // const var45: Uint8Array[] = new Array(Scene.MAP_SIZE + 2);
        // for (let x = 0; x < Scene.MAP_SIZE + 2; x++) {
        //     var45[x] = new Uint8Array(Scene.MAP_SIZE).fill(127);
        // }

        // LIGHT_X * LIGHT_X + LIGHT_Y * LIGHT_Y + LIGHT_Z * LIGHT_Z
        const var9 = Math.sqrt(5100.0) | 0;
        const var10 = var9 * 768 >> 8;

        for (let x = baseX; x < baseX + Scene.MAP_SIZE; x++) {
            for (let y = baseY; y < baseY + Scene.MAP_SIZE; y++) {
                const heightDeltaX = this.getHeight(x + 1, y, plane) - this.getHeight(x - 1, y, plane);
                const heightDeltaY = this.getHeight(x, y + 1, plane) - this.getHeight(x, y - 1, plane);
                const sqrtHeightDelta = Math.sqrt(heightDeltaY * heightDeltaY + heightDeltaX * heightDeltaX + 65536) | 0;
                const lightX = (heightDeltaX << 8) / sqrtHeightDelta | 0;
                const lightY = 65536 / sqrtHeightDelta | 0;
                const lightZ = (heightDeltaY << 8) / sqrtHeightDelta | 0;
                const ambient = ((lightZ * -50 + lightX * -50 + lightY * -10) / var10 | 0) + 96;
                const contrast = (0 >> 2)
                    + (0 >> 2)
                    + (0 >> 3)
                    + (0 >> 3)
                    + (0 >> 1);
                levels[x - baseX][y - baseY] = ambient - contrast;
            }
        }

        return levels;
    }

    getLightLevels(regionX: number, regionY: number): Int32Array[][] {
        const regionId = RegionLoader.getRegionId(regionX, regionY);

        let levels = this.lightLevels.get(regionId);
        if (!levels) {
            // console.log('calc light levels: ', regionX, regionY);
            levels = new Array(Scene.MAX_PLANE);
            for (let i = 0; i < Scene.MAX_PLANE; i++) {
                levels[i] = this.calculateLightLevels(regionX, regionY, i);
            }
            this.lightLevels.set(regionId, levels);
        }
        return levels;
    }

    getLightLevel(x: number, y: number, plane: number): number {
        const regionX = x / 64 | 0;
        const regionY = y / 64 | 0;

        const levels = this.getLightLevels(regionX, regionY);
        return levels[plane][x % 64][y % 64];
    }
}