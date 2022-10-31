import { FileReference } from "./FileReference";

export class ArchiveReference {
    constructor(
        public readonly id: number,
        public readonly nameHash: number,
        private readonly _whirlpool: Int8Array,
        public readonly crc: number,
        public readonly revision: number,
        public readonly fileCount: number,
        public readonly lastFileId: number,
        private readonly _fileIdIndexMap: Map<number, number>,
        private readonly _fileIds: Int32Array,
        private readonly _fileNameHashes: Int32Array
    ) {
    }

    getFileReference(id: number): FileReference | undefined {
        const i = this._fileIdIndexMap.get(id);
        if (i === undefined) {
            return undefined;
        }

        return new FileReference(
            this._fileIds[i],
            id,
            this._fileNameHashes ? this._fileNameHashes[i] : 0
        );
    }

    get whirlpool(): Int8Array {
        return this._whirlpool;
    }

    get fileIds(): Int32Array {
        return this._fileIds;
    }

    get fileReferences(): FileReference[] {
        const refs = new Array<FileReference>(this._fileIds.length);
        for (let i = 0; i < this._fileIds.length; i++) {
            const ref = this.getFileReference(this._fileIds[i]);
            if (ref) {
                refs[i] = ref;
            }
        }
        return refs;
    }
}
