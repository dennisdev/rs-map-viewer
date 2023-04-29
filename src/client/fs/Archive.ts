import { ByteBuffer } from "../util/ByteBuffer";
import { File } from "./File";

export class Archive {
    public static decode(
        id: number,
        lastFileId: number,
        fileCount: number,
        fileIds: Int32Array,
        buffer: ByteBuffer
    ): Archive {
        const files: Map<number, File> = new Map();
        if (fileCount === 1) {
            files.set(lastFileId, new File(lastFileId, id, buffer.data));
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
                files.set(fileId, new File(fileId, id, data));
            }
        }
        return new Archive(id, lastFileId, fileCount, fileIds, files);
    }

    constructor(
        public readonly id: number,
        public readonly lastFileId: number,
        public readonly fileCount: number,
        private readonly _fileIds: Int32Array,
        private readonly _files: Map<number, File>
    ) {}

    getFile(id: number): File | undefined {
        return this._files.get(id);
    }

    get fileIds(): Int32Array {
        return this._fileIds;
    }

    get files(): File[] {
        return Array.from(this._files.values());
    }
}
