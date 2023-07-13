import { SectorCluster } from "./SectorCluster";
import { Sector } from "./Sector";
import { ByteBuffer } from "../../util/ByteBuffer";
import { StoreAsync } from "./Store";
import { CacheType } from "../Types";

export class FileStore extends StoreAsync<CacheType.DAT2> {
    constructor(
        private readonly dataFile: File,
        private readonly indexFiles: File[],
        private readonly metaFile: File
    ) {
        super(CacheType.DAT2);
    }

    override read(indexId: number, archiveId: number): Promise<Int8Array> {
        return new Promise<Int8Array>((resolve, reject) => {
            if (indexId < 0) {
                reject("Index id cannot be lower than 0");
                return;
            }
            if (indexId >= this.indexFiles.length && indexId !== 255) {
                reject(`Index ${indexId} not found`);
                return;
            }
            const indexFile =
                indexId === 255 ? this.metaFile : this.indexFiles[indexId];

            const clusterPtr = archiveId * SectorCluster.SIZE;
            if (
                clusterPtr < 0 ||
                clusterPtr + SectorCluster.SIZE > indexFile.size
            ) {
                reject(
                    `Invalid ptr: ${clusterPtr}, fileSize: ${indexFile.size}, indexId: ${indexId}, archiveId: ${archiveId}`
                );
                return;
            }

            const extended = archiveId > 65535;

            const sectorClusterReader = new FileReader();

            sectorClusterReader.onload = (e: any) => {
                const buffer = new ByteBuffer(e.target.result);
                const sectorCluster = SectorCluster.decode(buffer);

                const data = new Int8Array(sectorCluster.size);
                let chunk = 0;
                let remaining = sectorCluster.size;
                let sectorPtr = sectorCluster.sector * Sector.SIZE;

                const readSector = (pointer: number) => {
                    const sectorReader = new FileReader();

                    sectorReader.onload = (e: any) => {
                        const sectorBuffer = new ByteBuffer(e.target.result);
                        const sector = extended
                            ? Sector.decodeExtendedNew(sectorBuffer)
                            : Sector.decodeNew(sectorBuffer);
                        const dataSize = extended
                            ? Sector.EXTENDED_DATA_SIZE
                            : Sector.DATA_SIZE;
                        if (remaining > dataSize) {
                            data.set(
                                sector.data,
                                sectorCluster.size - remaining
                            );
                            remaining -= dataSize;

                            if (sector.indexId !== indexId) {
                                reject(
                                    `Sector index id mismatch. expected: ${indexId} got: ${sector.indexId}`
                                );
                                return;
                            }

                            if (sector.archiveId !== archiveId) {
                                reject(
                                    `Sector archive id mismatch. expected: ${archiveId} got: ${sector.archiveId}`
                                );
                                return;
                            }

                            if (sector.chunk !== chunk) {
                                reject("Sector chunk mismatch");
                                return;
                            }

                            chunk++;

                            if (remaining > 0) {
                                readSector(sector.nextSector * Sector.SIZE);
                            } else {
                                resolve(data);
                            }
                        } else {
                            data.set(
                                sector.data.slice(0, remaining),
                                sectorCluster.size - remaining
                            );
                            resolve(data);
                        }
                    };
                    sectorReader.onerror = (e: any) => {
                        reject(e.target.error);
                    };

                    const sectorBlob = this.dataFile.slice(
                        pointer,
                        pointer + Sector.SIZE
                    );
                    sectorReader.readAsArrayBuffer(sectorBlob);
                };

                readSector(sectorPtr);
            };
            sectorClusterReader.onerror = (e: any) => {
                reject(e.target.error);
            };

            const sectorClusterBlob = indexFile.slice(
                clusterPtr,
                clusterPtr + SectorCluster.SIZE
            );
            sectorClusterReader.readAsArrayBuffer(sectorClusterBlob);
        });
    }
}
