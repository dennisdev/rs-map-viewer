import { ByteBuffer } from "../util/ByteBuffer";
import { Sector } from "./Sector";
import { SectorCluster } from "./SectorCluster";
import { StoreSync } from "./Store";

export class MemoryStore extends StoreSync {
    constructor(
        public readonly dataFile: ArrayBuffer,
        public readonly indexFiles: (ArrayBuffer | undefined)[],
        public readonly metaFile: ArrayBuffer
     ) {
        super();
     }

    override read(indexId: number, archiveId: number): Int8Array {
        if (indexId < 0) {
            throw new Error('Index id cannot be lower than 0');
        }
        if (indexId >= this.indexFiles.length && indexId !== 255) {
            throw new Error(`Index ${indexId} not found`);
        }
        const indexFile = indexId === 255 ? this.metaFile : this.indexFiles[indexId];
        if (!indexFile) {
            throw new Error(`Index ${indexId} not loaded`);
        }

        const clusterPtr = archiveId * SectorCluster.SIZE;
        if (clusterPtr < 0 || clusterPtr + SectorCluster.SIZE > indexFile.byteLength) {
            throw new Error(`Invalid ptr: ${clusterPtr}, fileSize: ${indexFile.byteLength}, indexId: ${indexId}, archiveId: ${archiveId}`);
        }

        const extended = archiveId > 65535;

        const sectorClusterBuf = new ByteBuffer(new Int8Array(indexFile, clusterPtr, SectorCluster.SIZE));
        const sectorCluster = SectorCluster.decode(sectorClusterBuf);

        const data = new Int8Array(sectorCluster.size);
        let chunk = 0;
        let remaining = sectorCluster.size;
        let sectorPtr = sectorCluster.sector * Sector.SIZE;

        while (remaining > 0) {
            const sectorBuffer = new ByteBuffer(new Int8Array(this.dataFile, sectorPtr, Sector.SIZE));
            const sector = extended ? Sector.decodeExtended(sectorBuffer) : Sector.decode(sectorBuffer);
            const dataSize = extended ? Sector.EXTENDED_DATA_SIZE : Sector.DATA_SIZE;
            if (remaining > dataSize) {
                data.set(sector.data, sectorCluster.size - remaining);

                if (sector.indexId !== indexId) {
                    throw new Error(`Sector index id mismatch. expected: ${indexId} got: ${sector.indexId}`);
                }

                if (sector.archiveId !== archiveId) {
                    throw new Error(`Sector archive id mismatch. expected: ${archiveId} got: ${sector.archiveId}`);
                }

                if (sector.chunk !== chunk) {
                    throw new Error('Sector chunk mismatch');
                }

                chunk++;

                sectorPtr = sector.nextSector * Sector.SIZE;
            } else {
                data.set(sector.data.subarray(0, remaining), sectorCluster.size - remaining);
            }
            remaining -= dataSize;
        }

        return data;
    }
}
