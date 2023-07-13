import { ByteBuffer } from "../util/ByteBuffer";
import { Compression } from "../util/Compression";
import { Djb2 } from "../util/Djb2";
import { ArchiveFile } from "./ArchiveFile";
import { IndexTypeDat } from "./IndexType";
import { CacheType } from "./Types";

export class Archive {
    public static decodeDat(indexId: number, id: number, data: Int8Array) {
        const buffer = new ByteBuffer(data);
        const files: Map<number, ArchiveFile> = new Map();

        let fileCount: number;
        let fileIds: Int32Array;
        let fileNameHashes: Int32Array;
        if (indexId === IndexTypeDat.CONFIGS) {
            const actualSize = buffer.readMedium();
            const size = buffer.readMedium();

            const isCompressed = actualSize !== size;

            let dataBuffer: ByteBuffer;
            let metaBuffer: ByteBuffer;
            if (isCompressed) {
                const data = buffer.readUnsignedBytes(size);
                const decompressed = Compression.decompressBzip2(
                    data,
                    actualSize
                );
                dataBuffer = new ByteBuffer(decompressed);
                metaBuffer = new ByteBuffer(decompressed);
            } else {
                dataBuffer = new ByteBuffer(data);
                metaBuffer = buffer;
            }

            fileCount = metaBuffer.readUnsignedShort();
            dataBuffer.offset = metaBuffer.offset + fileCount * 10;

            fileIds = new Int32Array(fileCount);
            fileNameHashes = new Int32Array(fileCount);
            for (let i = 0; i < fileCount; i++) {
                const nameHash = metaBuffer.readInt();
                const fileActualSize = metaBuffer.readMedium();
                const fileSize = metaBuffer.readMedium();

                let decompressedFile: Int8Array;
                if (isCompressed) {
                    decompressedFile = dataBuffer.readBytes(fileSize);
                } else {
                    const data = dataBuffer.readUnsignedBytes(fileSize);
                    decompressedFile = Compression.decompressBzip2(
                        data,
                        fileActualSize
                    );
                }
                files.set(i, new ArchiveFile(i, id, decompressedFile));
                fileIds[i] = i;
                fileNameHashes[i] = nameHash;
            }
        } else {
            const decompressed = Compression.decompressGzip(
                buffer.readUnsignedBytes(buffer.remaining)
            );

            fileCount = 1;
            fileIds = new Int32Array(fileCount);
            fileNameHashes = new Int32Array(fileCount);
            files.set(0, new ArchiveFile(0, id, decompressed));
        }

        const lastFileId = fileCount - 1;

        return new Archive(
            CacheType.DAT,
            id,
            lastFileId,
            fileCount,
            fileIds,
            fileNameHashes,
            files
        );
    }

    public static decodeDat2(
        id: number,
        lastFileId: number,
        fileCount: number,
        fileIds: Int32Array,
        fileNameHashes: Int32Array,
        buffer: ByteBuffer
    ): Archive {
        const files: Map<number, ArchiveFile> = new Map();
        if (fileCount === 1) {
            files.set(lastFileId, new ArchiveFile(lastFileId, id, buffer.data));
        } else {
            buffer.offset = buffer.length - 1;
            const chunks = buffer.readUnsignedByte();

            buffer.offset = buffer.length - 1 - chunks * (fileCount * 4);

            const chunkSizes = new Int32Array(chunks * fileCount);
            const fileSizes = new Int32Array(fileCount);
            for (let chunk = 0; chunk < chunks; chunk++) {
                let lastFileSize = 0;
                for (let fileIdx = 0; fileIdx < fileCount; fileIdx++) {
                    lastFileSize += buffer.readInt();
                    chunkSizes[chunk * fileCount + fileIdx] = lastFileSize;
                    fileSizes[fileIdx] += lastFileSize;
                }
            }

            const fileData = new Array<ByteBuffer>(fileCount);
            for (let fileIdx = 0; fileIdx < fileCount; fileIdx++) {
                fileData[fileIdx] = new ByteBuffer(fileSizes[fileIdx]);
            }

            buffer.offset = 0;

            for (let chunk = 0; chunk < chunks; chunk++) {
                for (let fileIdx = 0; fileIdx < fileCount; fileIdx++) {
                    const chunkSize = chunkSizes[chunk * fileCount + fileIdx];
                    const bytes = buffer.readBytes(chunkSize);
                    fileData[fileIdx].writeBytes(bytes);
                }
            }

            for (let fileIdx = 0; fileIdx < fileCount; fileIdx++) {
                const fileId = fileIds[fileIdx];
                const data = fileData[fileIdx].data;
                files.set(fileId, new ArchiveFile(fileId, id, data));
            }
        }
        return new Archive(
            CacheType.DAT2,
            id,
            lastFileId,
            fileCount,
            fileIds,
            fileNameHashes,
            files
        );
    }

    constructor(
        private readonly _cacheType: CacheType,
        public readonly id: number,
        public readonly lastFileId: number,
        public readonly fileCount: number,
        public readonly fileIds: Int32Array,
        public readonly fileNameHashes: Int32Array,
        private readonly _files: Map<number, ArchiveFile>,
        private readonly _fileNameHashIdMap: Map<number, number> = new Map()
    ) {
        if (fileNameHashes) {
            for (let i = 0; i < this.fileIds.length; i++) {
                this._fileNameHashIdMap.set(
                    this.fileNameHashes[i],
                    this.fileIds[i]
                );
            }
        }
    }

    getFile(id: number): ArchiveFile | undefined {
        return this._files.get(id);
    }

    getFileId(name: string): number {
        let hash: number;
        if (this._cacheType === CacheType.DAT) {
            name = name.toUpperCase();
            hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = (hash * 61 + name.charCodeAt(i) - 32) | 0;
            }
        } else {
            hash = Djb2.hash(name);
        }

        return this._fileNameHashIdMap.get(hash) ?? -1;
    }

    getFileNamed(name: string): ArchiveFile | undefined {
        const id = this.getFileId(name);
        if (id === -1) {
            return undefined;
        }
        return this.getFile(id);
    }

    get files(): ArchiveFile[] {
        return Array.from(this._files.values());
    }
}
