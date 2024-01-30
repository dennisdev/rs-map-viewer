import { vec4 } from "gl-matrix";

import { MapFileIndex, getMapSquareId } from "../rs/map/MapFileIndex";
import { Scene } from "../rs/scene/Scene";
import { Camera } from "./Camera";

function getMapDistance(x: number, z: number, mapX: number, mapY: number): number {
    const centerX = mapX * Scene.MAP_SQUARE_SIZE + 32;
    const centerY = mapY * Scene.MAP_SQUARE_SIZE + 32;
    const dx = Math.max(Math.abs(x - centerX) - 32, 0);
    const dz = Math.max(Math.abs(z - centerY) - 32, 0);
    return Math.sqrt(dx * dx + dz * dz);
}

type LoadMapFunction = (mapX: number, mapY: number) => void;

export interface MapSquare {
    mapX: number;
    mapY: number;

    canRender(frameCount: number): boolean;

    delete(): void;
}

export class MapManager<T extends MapSquare> {
    static readonly MAX_MAP_X = 100;
    static readonly MAX_MAP_Y = 200;

    static mapIntersectBox: number[][] = [
        [0, (-240 * 10) / 128, 0],
        [0, (240 * 3) / 128, 0],
    ];

    invalidMapIds: Set<number> = new Set();
    loadingMapIds: Set<number> = new Set();

    renderBounds: vec4 = vec4.fromValues(-1, -1, -1, -1);

    renderDistMapCount: number = 0;
    renderDistMapIds: number[] = [];

    visibleMapCount: number = 0;
    visibleMaps: T[] = [];

    mapSquares: Map<number, T> = new Map();

    constructor(
        readonly maxQueuedTasks: number,
        readonly loadMapFunction: LoadMapFunction,
    ) {}

    init(mapFileIndex: MapFileIndex, fillEmptyTerrain: boolean): void {
        this.cleanUp();
        for (let x = 0; x < MapManager.MAX_MAP_X; x++) {
            for (let y = 0; y < MapManager.MAX_MAP_Y; y++) {
                const exists = mapFileIndex.getTerrainArchiveId(x, y) !== -1;
                if (exists) {
                    continue;
                }
                if (y < 100 && fillEmptyTerrain) {
                    let hasNeighbour = false;
                    loop: for (let nx = x - 2; nx <= x + 2; nx++) {
                        for (let ny = y - 2; ny <= y + 2; ny++) {
                            const neighbourExists = mapFileIndex.getTerrainArchiveId(nx, ny) !== -1;
                            if (neighbourExists) {
                                hasNeighbour = true;
                                break loop;
                            }
                        }
                    }
                    if (hasNeighbour) {
                        continue;
                    }
                }
                this.invalidMapIds.add(getMapSquareId(x, y));
            }
        }
        console.log("Invalid map count", this.invalidMapIds.size);
    }

    isMapVisible(camera: Camera, mapX: number, mapY: number): boolean {
        const baseX = mapX * Scene.MAP_SQUARE_SIZE;
        const baseY = mapY * Scene.MAP_SQUARE_SIZE;
        const endX = baseX + Scene.MAP_SQUARE_SIZE;
        const endY = baseY + Scene.MAP_SQUARE_SIZE;

        MapManager.mapIntersectBox[0][0] = baseX;
        MapManager.mapIntersectBox[0][2] = baseY;

        MapManager.mapIntersectBox[1][0] = endX;
        MapManager.mapIntersectBox[1][2] = endY;

        return camera.frustum.intersectsBox(MapManager.mapIntersectBox);
    }

    clearMaps(): void {
        this.invalidMapIds.clear();
        this.loadingMapIds.clear();
        for (const map of this.mapSquares.values()) {
            map.delete();
        }
        this.mapSquares.clear();
    }

    getMap(mapX: number, mapY: number): T | undefined {
        return this.mapSquares.get(getMapSquareId(mapX, mapY));
    }

    addMap(mapX: number, mapY: number, mapSquare: T): void {
        const mapId = getMapSquareId(mapX, mapY);
        this.loadingMapIds.delete(mapId);
        this.invalidMapIds.delete(mapId);
        this.mapSquares.set(mapId, mapSquare);
    }

    removeMap(mapX: number, mapY: number): void {
        const mapId = getMapSquareId(mapX, mapY);
        const map = this.mapSquares.get(mapId);
        if (map) {
            map.delete();
            this.mapSquares.delete(mapId);
        }
    }

    addInvalidMap(mapX: number, mapY: number): void {
        const mapId = getMapSquareId(mapX, mapY);
        this.invalidMapIds.add(mapId);
        this.loadingMapIds.delete(mapId);
    }

    loadMap(mapX: number, mapY: number): void {
        const mapId = getMapSquareId(mapX, mapY);
        if (
            this.mapSquares.has(mapId) ||
            this.invalidMapIds.has(mapId) ||
            this.loadingMapIds.has(mapId) ||
            this.loadingMapIds.size > this.maxQueuedTasks
        ) {
            return;
        }
        console.log("Loading map", mapX, mapY);
        this.loadingMapIds.add(mapId);
        this.loadMapFunction(mapX, mapY);
    }

    update(
        camera: Camera,
        frameCount: number,
        renderDistance: number,
        unloadDistance: number,
    ): void {
        const cameraX = camera.getPosX();
        const cameraZ = camera.getPosZ();

        const mapStartX = Math.floor((cameraX - renderDistance) / Scene.MAP_SQUARE_SIZE);
        const mapStartY = Math.floor((cameraZ - renderDistance) / Scene.MAP_SQUARE_SIZE);

        const mapEndX = Math.ceil((cameraX + renderDistance) / Scene.MAP_SQUARE_SIZE);
        const mapEndY = Math.ceil((cameraZ + renderDistance) / Scene.MAP_SQUARE_SIZE);

        const renderBoundsChanged =
            this.renderBounds[0] !== mapStartX ||
            this.renderBounds[1] !== mapStartY ||
            this.renderBounds[2] !== mapEndX ||
            this.renderBounds[3] !== mapEndY;

        if (renderBoundsChanged) {
            this.renderDistMapCount = 0;

            for (let x = mapStartX; x < mapEndX; x++) {
                for (let y = mapStartY; y < mapEndY; y++) {
                    if (x < 0 || y < 0 || x >= MapManager.MAX_MAP_X || y >= MapManager.MAX_MAP_Y) {
                        continue;
                    }
                    const mapId = getMapSquareId(x, y);
                    if (this.invalidMapIds.has(mapId)) {
                        continue;
                    }

                    this.renderDistMapIds[this.renderDistMapCount++] = mapId;
                }
            }

            for (const map of this.mapSquares.values()) {
                const { mapX, mapY } = map;
                if (
                    mapX < mapStartX - unloadDistance ||
                    mapX > mapEndX + unloadDistance ||
                    mapY < mapStartY - unloadDistance ||
                    mapY > mapEndY + unloadDistance
                ) {
                    this.removeMap(mapX, mapY);
                }
            }
        }

        if (renderBoundsChanged || camera.updatedPosition) {
            this.renderDistMapIds.length = this.renderDistMapCount;
            // sort front to back
            this.renderDistMapIds.sort((a, b) => {
                const distA = getMapDistance(cameraX, cameraZ, a >> 8, a & 0xff);
                const distB = getMapDistance(cameraX, cameraZ, b >> 8, b & 0xff);
                return distA - distB;
            });
        }

        this.visibleMapCount = 0;
        for (let i = 0; i < this.renderDistMapCount; i++) {
            const mapId = this.renderDistMapIds[i];
            const mapX = mapId >> 8;
            const mapY = mapId & 0xff;
            if (!this.isMapVisible(camera, mapX, mapY)) {
                continue;
            }
            const mapSquare = this.mapSquares.get(mapId);
            if (mapSquare) {
                if (mapSquare.canRender(frameCount)) {
                    this.visibleMaps[this.visibleMapCount++] = mapSquare;
                }
            } else {
                this.loadMap(mapX, mapY);
            }
        }

        // Probably a better way to do this, maybe set null
        if (this.visibleMapCount > this.visibleMaps.length) {
            // Delete 1 per frame
            this.visibleMaps.length -= 1;
        }

        this.renderBounds[0] = mapStartX;
        this.renderBounds[1] = mapStartY;
        this.renderBounds[2] = mapEndX;
        this.renderBounds[3] = mapEndY;
    }

    cleanUp(): void {
        this.renderBounds.fill(-1);
        this.clearMaps();
    }
}
