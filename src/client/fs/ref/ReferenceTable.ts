import { ArchiveReference } from "./ArchiveReference";
import { ByteBuffer } from "../../util/ByteBuffer";
import { Djb2 } from "../../util/Djb2";

export class ReferenceTable {
    public static decode(buffer: ByteBuffer): ReferenceTable {
        const protocol = buffer.readUnsignedByte();
        if (protocol < 5 || protocol > 7) {
            throw new Error("Invalid protocol: " + protocol);
        }
        const revision = protocol > 5 ? buffer.readInt() : 0;
        const flag = buffer.readUnsignedByte();
        const named = (flag & 0x1) !== 0;
        const usesWhirlpool = (flag & 0x2) !== 0;
        const archiveCount =
            protocol === 7 ? buffer.readBigSmart() : buffer.readUnsignedShort();

        let lastArchiveId = 0;
        const archiveIds = new Int32Array(archiveCount);
        const archiveIdIndexMap: Map<number, number> = new Map();
        if (protocol === 7) {
            for (let i = 0; i < archiveCount; i++) {
                lastArchiveId += buffer.readBigSmart();
                archiveIds[i] = lastArchiveId;
                archiveIdIndexMap.set(lastArchiveId, i);
            }
        } else {
            for (let i = 0; i < archiveCount; i++) {
                lastArchiveId += buffer.readUnsignedShort();
                archiveIds[i] = lastArchiveId;
                archiveIdIndexMap.set(lastArchiveId, i);
            }
        }

        const archiveNameHashes = new Int32Array(archiveCount);
        if (named) {
            for (let i = 0; i < archiveCount; i++) {
                archiveNameHashes[i] = buffer.readInt();
            }
        }

        const archiveWhirlpools = new Array<Int8Array>(archiveCount);
        if (usesWhirlpool) {
            for (let i = 0; i < archiveCount; i++) {
                archiveWhirlpools[i] = buffer.readBytes(64);
            }
        }

        const archiveCrcs = new DataView(
            buffer.data.buffer,
            buffer.offset,
            archiveCount * 4
        );
        buffer.offset += archiveCrcs.byteLength;

        const archiveRevisions = new DataView(
            buffer.data.buffer,
            buffer.offset,
            archiveCount * 4
        );
        buffer.offset += archiveRevisions.byteLength;

        const archiveFileCounts = new Int32Array(archiveCount);
        for (let i = 0; i < archiveCount; i++) {
            archiveFileCounts[i] =
                protocol === 7
                    ? buffer.readBigSmart()
                    : buffer.readUnsignedShort();
        }

        const archiveFileIds = new Array<Int32Array>(archiveCount);
        const archiveLastFileIds = new Int32Array(archiveCount);
        for (let i = 0; i < archiveCount; i++) {
            archiveFileIds[i] = new Int32Array(archiveFileCounts[i]);
        }
        for (let archiveIdx = 0; archiveIdx < archiveCount; archiveIdx++) {
            let lastFileId = 0;
            for (
                let fileIdx = 0;
                fileIdx < archiveFileCounts[archiveIdx];
                fileIdx++
            ) {
                lastFileId +=
                    protocol === 7
                        ? buffer.readBigSmart()
                        : buffer.readUnsignedShort();
                archiveFileIds[archiveIdx][fileIdx] = lastFileId;
            }
            archiveLastFileIds[archiveIdx] = lastFileId;
        }

        const archiveFileNameHashes = new Array<Int32Array>(archiveCount);
        if (named) {
            for (let i = 0; i < archiveCount; i++) {
                archiveFileNameHashes[i] = new Int32Array(archiveFileCounts[i]);
            }
            for (let archiveIdx = 0; archiveIdx < archiveCount; archiveIdx++) {
                for (
                    let fileIdx = 0;
                    fileIdx < archiveFileCounts[archiveIdx];
                    fileIdx++
                ) {
                    archiveFileNameHashes[archiveIdx][fileIdx] =
                        buffer.readInt();
                }
            }
        }

        return new ReferenceTable(
            protocol,
            revision,
            named,
            usesWhirlpool,
            archiveCount,
            lastArchiveId,
            archiveIdIndexMap,
            archiveIds,
            archiveNameHashes,
            archiveWhirlpools,
            archiveCrcs,
            archiveRevisions,
            archiveFileCounts,
            archiveLastFileIds,
            archiveFileIds,
            archiveFileNameHashes
        );
    }

    constructor(
        public readonly protocol: number,
        public readonly revision: number,
        public readonly named: boolean,
        public readonly usesWhirlpool: boolean,
        public readonly archiveCount: number,
        public readonly lastArchiveId: number,
        private readonly _archiveIdIndexMap: Map<number, number>,
        private readonly _archiveIds: Int32Array,
        private readonly _archiveNameHashes: Int32Array,
        private readonly _archiveWhirlpools: Int8Array[],
        private readonly _archiveCrcs: DataView,
        private readonly _archiveRevisions: DataView,
        private readonly _archiveFileCounts: Int32Array,
        private readonly _archiveLastFileIds: Int32Array,
        private readonly _archiveFileIds: Int32Array[],
        private readonly _archiveFileNameHashes: Int32Array[],
        private readonly _archiveNameHashIdMap: Map<number, number> = new Map()
    ) {
        if (named) {
            for (let i = 0; i < this._archiveIds.length; i++) {
                this._archiveNameHashIdMap.set(
                    this._archiveNameHashes[i],
                    this._archiveIds[i]
                );
            }
        }
    }

    getArchiveId(name: string): number | undefined {
        return this._archiveNameHashIdMap.get(Djb2.hash(name));
    }

    getArchiveReference(id: number): ArchiveReference | undefined {
        const i = this._archiveIdIndexMap.get(id);
        if (i === undefined) {
            return undefined;
        }

        const nameHash = this._archiveNameHashes[i];
        const whirlpool = this._archiveWhirlpools[i];
        const crc = this._archiveCrcs.getInt32(i * 4, false);
        const revision = this._archiveRevisions.getInt32(i * 4, false);
        const fileCount = this._archiveFileCounts[i];
        const lastFileId = this._archiveLastFileIds[i];
        const fileIds = this._archiveFileIds[i];
        const fileNameHashes = this._archiveFileNameHashes[i];

        const fileIdIndexMap: Map<number, number> = new Map();
        for (let fileIdx = 0; fileIdx < fileCount; fileIdx++) {
            fileIdIndexMap.set(fileIds[fileIdx], fileIdx);
        }
        return new ArchiveReference(
            id,
            nameHash,
            whirlpool,
            crc,
            revision,
            fileCount,
            lastFileId,
            fileIdIndexMap,
            fileIds,
            fileNameHashes
        );
    }

    get archiveIds(): Int32Array {
        return this._archiveIds;
    }

    get archiveReferences(): ArchiveReference[] {
        const refs = new Array<ArchiveReference>(this.archiveIds.length);
        for (let i = 0; i < this._archiveIds.length; i++) {
            const ref = this.getArchiveReference(this._archiveIds[i]);
            if (ref) {
                refs[i] = ref;
            }
        }
        return refs;
    }
}

export const INVALID_TABLE = new ReferenceTable(
    -1,
    -1,
    false,
    false,
    0,
    -1,
    new Map(),
    new Int32Array(),
    new Int32Array(),
    [],
    new DataView(new ArrayBuffer(0)),
    new DataView(new ArrayBuffer(0)),
    new Int32Array(),
    new Int32Array(),
    [],
    []
);
