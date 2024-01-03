import { Archive } from "../cache/Archive";
import { CacheIndex } from "../cache/CacheIndex";

export function getMapSquareId(mapX: number, mapY: number): number {
    return (mapX << 8) + mapY;
}

export function getMapCoordinates(mapId: number): { mapX: number; mapY: number } {
    const mapY = mapId & 255;
    const mapX = (mapId >> 8) & 0xffff;
    return { mapX, mapY };
}

export interface MapFileIndex {
    getTerrainArchiveId(mapX: number, mapY: number): number;
    getLandscapeArchiveId(mapX: number, mapY: number): number;
}

class MapSquare {
    constructor(
        readonly mapId: number,
        readonly terrainArchiveId: number,
        readonly landscapeArchiveId: number,
        readonly members: boolean,
    ) {}
}

export class DatMapFileIndex implements MapFileIndex {
    static load(versionListArchive: Archive): DatMapFileIndex {
        const file = versionListArchive.getFileNamed("map_index");
        if (!file) {
            throw new Error("map_index not found");
        }
        const buffer = file.getDataAsBuffer();

        const mapSquares = new Map<number, MapSquare>();

        const count = (buffer.remaining / 7) | 0;
        for (let i = 0; i < count; i++) {
            const mapId = buffer.readUnsignedShort();
            const terrainArchiveId = buffer.readUnsignedShort();
            const landscapeArchiveId = buffer.readUnsignedShort();
            const members = buffer.readUnsignedByte() === 1;
            mapSquares.set(
                mapId,
                new MapSquare(mapId, terrainArchiveId, landscapeArchiveId, members),
            );
        }

        return new DatMapFileIndex(mapSquares);
    }

    constructor(readonly mapSquares: Map<number, MapSquare>) {}

    getTerrainArchiveId(mapX: number, mapY: number): number {
        return this.mapSquares.get(getMapSquareId(mapX, mapY))?.terrainArchiveId ?? -1;
    }

    getLandscapeArchiveId(mapX: number, mapY: number): number {
        return this.mapSquares.get(getMapSquareId(mapX, mapY))?.landscapeArchiveId ?? -1;
    }
}

export class Dat2MapIndex implements MapFileIndex {
    constructor(readonly mapIndex: CacheIndex) {}

    getTerrainArchiveId(mapX: number, mapY: number): number {
        return this.mapIndex.getArchiveId(`m${mapX}_${mapY}`);
    }

    getLandscapeArchiveId(mapX: number, mapY: number): number {
        return this.mapIndex.getArchiveId(`l${mapX}_${mapY}`);
    }
}
