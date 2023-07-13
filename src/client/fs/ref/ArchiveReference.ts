import { ArchiveFileReference } from "./ArchiveFileReference";

export class ArchiveReference {
    constructor(
        public readonly id: number,
        public readonly nameHash: number,
        public readonly whirlpool: Int8Array,
        public readonly crc: number,
        public readonly revision: number,
        public readonly fileCount: number,
        public readonly lastFileId: number,
        private readonly _fileIdIndexMap: Map<number, number>,
        public readonly fileIds: Int32Array,
        public readonly fileNameHashes: Int32Array
    ) {}

    getFileReference(id: number): ArchiveFileReference | undefined {
        const i = this._fileIdIndexMap.get(id);
        if (i === undefined) {
            return undefined;
        }

        return new ArchiveFileReference(
            this.fileIds[i],
            id,
            this.fileNameHashes ? this.fileNameHashes[i] : 0
        );
    }

    get fileReferences(): ArchiveFileReference[] {
        const refs = new Array<ArchiveFileReference>(this.fileIds.length);
        for (let i = 0; i < this.fileIds.length; i++) {
            const ref = this.getFileReference(this.fileIds[i]);
            if (ref) {
                refs[i] = ref;
            }
        }
        return refs;
    }
}
