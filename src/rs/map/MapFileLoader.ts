import { XteaMap } from "../../mapviewer/Caches";
import { CacheIndex } from "../cache/CacheIndex";
import { Bzip2 } from "../compression/Bzip2";
import { ByteBuffer } from "../io/ByteBuffer";
import { MapFileIndex } from "./MapFileIndex";

export class MapFileLoader {
    constructor(
        readonly mapIndex: CacheIndex,
        readonly mapFileIndex: MapFileIndex,
    ) {}

    getTerrainData(mapX: number, mapY: number): Int8Array | undefined {
        const archiveId = this.mapFileIndex.getTerrainArchiveId(mapX, mapY);
        if (archiveId === -1) {
            return undefined;
        }
        try {
            const file = this.mapIndex.getFile(archiveId, 0);
            return file?.data;
        } catch (e) {
            return undefined;
        }
    }

    getLocData(mapX: number, mapY: number, xteasMap: XteaMap): Int8Array | undefined {
        const archiveId = this.mapFileIndex.getLocArchiveId(mapX, mapY);
        if (archiveId === -1) {
            return undefined;
        }
        const key = xteasMap.get(archiveId);
        try {
            const file = this.mapIndex.getFile(archiveId, 0, key);
            return file?.data;
        } catch (e) {
            return undefined;
        }
    }

    getNpcSpawnData(mapX: number, mapY: number, xteasMap: XteaMap): Int8Array | undefined {
        const landscapeArchiveId = this.mapFileIndex.getLocArchiveId(mapX, mapY);
        const archiveId = this.mapIndex.getArchiveId(`n${mapX}_${mapY}`);
        if (landscapeArchiveId === -1 || archiveId === -1) {
            return undefined;
        }
        const key = xteasMap.get(landscapeArchiveId);
        try {
            const file = this.mapIndex.getFile(archiveId, 0, key);
            return file?.data;
        } catch (e) {
            return undefined;
        }
    }
}

export class LegacyMapFileLoader extends MapFileLoader {
    decompress(data: Int8Array): Int8Array {
        const buffer = new ByteBuffer(data);
        const actualSize = buffer.readInt();
        const compressed = buffer.readUnsignedBytes(buffer.remaining);
        const decompressed = Bzip2.decompress(compressed, actualSize);
        return decompressed;
    }

    override getTerrainData(mapX: number, mapY: number): Int8Array | undefined {
        const data = super.getTerrainData(mapX, mapY);
        if (!data) {
            return undefined;
        }
        try {
            return this.decompress(data);
        } catch (e) {
            console.error("Failed decompressing terrain data", mapX, mapY, data.length, e);
            return undefined;
        }
    }

    override getLocData(mapX: number, mapY: number, xteasMap: XteaMap): Int8Array | undefined {
        const data = super.getLocData(mapX, mapY, xteasMap);
        if (!data) {
            return undefined;
        }
        try {
            return this.decompress(data);
        } catch (e) {
            console.error("Failed decompressing loc data", mapX, mapY, data.length, data, e);
            return undefined;
        }
    }
}
