import { RegionLoader } from "./RegionLoader";
import { Archive } from "./fs/Archive";
import { GenericIndexDat2 } from "./fs/Index";
import { ByteBuffer } from "./util/ByteBuffer";

export interface MapIndex {
    getTerrainArchiveId(regionX: number, regionY: number): number;

    getLandscapeArchiveId(regionX: number, regionY: number): number;
}

export class MapSquareIndex {
    constructor(
        public readonly regionId: number,
        public readonly terrainArchiveId: number,
        public readonly landscapeArchiveId: number,
        public readonly members: boolean
    ) {}
}

export class MapIndexDat implements MapIndex {
    mapSquares: Map<number, MapSquareIndex>;

    static load(versionListArchive: Archive): MapIndexDat {
        const file = versionListArchive.getFileNamed("map_index");
        if (!file) {
            throw new Error("map_index not found");
        }
        const buffer = new ByteBuffer(file.data);

        const mapSquares = new Map<number, MapSquareIndex>();

        const count = buffer.remaining / 7;
        for (let i = 0; i < count; i++) {
            const regionId = buffer.readUnsignedShort();
            const terrainArchiveId = buffer.readUnsignedShort();
            const landscapeArchiveId = buffer.readUnsignedShort();
            const members = buffer.readUnsignedByte() === 1;
            mapSquares.set(
                regionId,
                new MapSquareIndex(
                    regionId,
                    terrainArchiveId,
                    landscapeArchiveId,
                    members
                )
            );
        }

        return new MapIndexDat(mapSquares);
    }

    constructor(mapSquares: Map<number, MapSquareIndex>) {
        this.mapSquares = mapSquares;
    }

    getTerrainArchiveId(regionX: number, regionY: number): number {
        return (
            this.mapSquares.get(RegionLoader.getRegionId(regionX, regionY))
                ?.terrainArchiveId ?? -1
        );
    }

    getLandscapeArchiveId(regionX: number, regionY: number): number {
        return (
            this.mapSquares.get(RegionLoader.getRegionId(regionX, regionY))
                ?.landscapeArchiveId ?? -1
        );
    }
}

export class MapIndexDat2 implements MapIndex {
    constructor(public readonly mapCacheIndex: GenericIndexDat2) {}

    getTerrainArchiveId(regionX: number, regionY: number): number {
        return this.mapCacheIndex.getArchiveId(`m${regionX}_${regionY}`);
    }

    getLandscapeArchiveId(regionX: number, regionY: number): number {
        return this.mapCacheIndex.getArchiveId(`l${regionX}_${regionY}`);
    }
}
