import { ByteBuffer } from "../io/ByteBuffer";
import { StringUtil } from "../util/StringUtil";
import { ApiReturnType, ApiType } from "./ApiType";
import { Archive } from "./Archive";
import { ArchiveFile } from "./ArchiveFile";
import { Container } from "./Container";
import { IndexType } from "./IndexType";
import { ArchiveReference } from "./ref/ArchiveReference";
import { ReferenceTable } from "./ref/ReferenceTable";
import { CacheStore } from "./store/CacheStore";
import { SectorCluster } from "./store/SectorCluster";

export abstract class CacheIndex<A extends ApiType = ApiType.SYNC> {
    static META_INDEX_ID = 255;

    constructor(
        readonly id: number,
        readonly table: ReferenceTable,
    ) {}

    getArchiveIds(): Int32Array {
        return this.table.archiveIds;
    }

    getArchiveCount(): number {
        return this.table.archiveCount;
    }

    getLastArchiveId(): number {
        return this.table.lastArchiveId;
    }

    getArchiveReference(archiveId: number): ArchiveReference | undefined {
        return this.table.getArchiveReference(archiveId);
    }

    getArchiveId(name: string): number {
        return this.table.getArchiveId(name) ?? -1;
    }

    getFileIds(archiveId: number): Int32Array | undefined {
        return this.getArchiveReference(archiveId)?.fileIds;
    }

    archiveExists(archiveId: number): boolean {
        return this.table.archiveExists(archiveId);
    }

    getFileCount(archiveId: number): number {
        return this.table.getArchiveReference(archiveId)?.fileCount ?? 0;
    }

    abstract getArchive(archiveId: number, key?: number[]): ApiReturnType<A, Archive>;

    abstract getFile(
        archiveId: number,
        fileId: number,
        key?: number[],
    ): ApiReturnType<A, ArchiveFile | undefined>;

    getFileSmart(id: number, key?: number[]): ApiReturnType<A, ArchiveFile | undefined> {
        if (this.getArchiveCount() === 1) {
            return this.getFile(0, id, key);
        } else if (this.getFileCount(id) === 1) {
            return this.getFile(id, 0, key);
        }
        throw new Error("Invalid archive");
    }
}

export abstract class CacheStoreIndex<A extends ApiType> extends CacheIndex<A> {
    constructor(
        id: number,
        table: ReferenceTable,
        readonly store: CacheStore<A>,
    ) {
        super(id, table);
    }

    read(archiveId: number): ApiReturnType<A, Int8Array> {
        return this.store.read(this.id, archiveId);
    }
}
export abstract class CacheStoreIndexSync extends CacheStoreIndex<ApiType.SYNC> {
    override getFile(archiveId: number, fileId: number, key?: number[]): ArchiveFile | undefined {
        return this.getArchive(archiveId, key).getFile(fileId);
    }
}
export abstract class CacheStoreIndexAsync extends CacheStoreIndex<ApiType.ASYNC> {
    override async getFile(
        archiveId: number,
        fileId: number,
        key?: number[] | undefined,
    ): Promise<ArchiveFile | undefined> {
        const archive = await this.getArchive(archiveId, key);
        return archive.getFile(fileId);
    }
}

export class CacheIndexDat extends CacheStoreIndexSync {
    static fromStore(
        id: number,
        store: CacheStore<ApiType.SYNC>,
        indexFile: ArrayBuffer,
    ): CacheIndexDat {
        const table = ReferenceTable.fromArchiveCount(indexFile.byteLength / SectorCluster.SIZE);
        return new CacheIndexDat(id, table, store);
    }

    override getArchive(id: number, key?: number[]): Archive {
        const data = this.read(id);
        return Archive.decodeOld(id, data, this.id === IndexType.DAT.configs);
    }
}
export class CacheIndexDatAsync extends CacheStoreIndex<ApiType.ASYNC> {
    override async getArchive(id: number, key?: number[]): Promise<Archive> {
        const data = await this.read(id);
        return Archive.decodeOld(id, data, this.id === IndexType.DAT.configs);
    }

    override async getFile(
        archiveId: number,
        fileId: number,
        key?: number[],
    ): Promise<ArchiveFile | undefined> {
        const archive = await this.getArchive(archiveId, key);
        return archive.getFile(fileId);
    }
}

function decodeTable(data: Int8Array): ReferenceTable {
    if (data.length) {
        const container = Container.decode(new ByteBuffer(data));
        return ReferenceTable.decode(new ByteBuffer(container.data));
    }
    return ReferenceTable.INVALID_TABLE;
}

function decodeArchiveData<A extends ApiType>(
    index: CacheIndex<A>,
    id: number,
    data: Int8Array,
    key?: number[],
): Archive {
    const archiveRef = index.getArchiveReference(id);
    if (!archiveRef) {
        throw new Error("Archive reference not found for: " + id);
    }
    const container = Container.decode(new ByteBuffer(data), key);
    return Archive.decode(
        id,
        archiveRef.lastFileId,
        archiveRef.fileCount,
        archiveRef.fileIds,
        archiveRef.fileNameHashes,
        new ByteBuffer(container.data),
    );
}

export class CacheIndexDat2 extends CacheStoreIndexSync {
    static fromStore(id: number, store: CacheStore<ApiType.SYNC>): CacheIndexDat2 {
        const data = store.read(CacheIndex.META_INDEX_ID, id);
        try {
            const table = decodeTable(data);
            return new CacheIndexDat2(id, table, store);
        } catch (e) {
            console.error(data, e);
            throw new Error("Failed to decode index: " + id);
        }
    }

    override getArchive(id: number, key?: number[] | undefined): Archive {
        const data = this.read(id);
        return decodeArchiveData(this, id, data, key);
    }
}
export class CacheIndexDat2Async extends CacheStoreIndexAsync {
    override async getArchive(id: number, key?: number[] | undefined): Promise<Archive> {
        const data = await this.read(id);
        return decodeArchiveData(this, id, data, key);
    }
}

export class LegacyCacheIndex extends CacheIndex {
    constructor(
        readonly id: number,
        readonly archives: Archive[],
        readonly archiveNameHashes: Map<number, number> = new Map(),
    ) {
        super(id, ReferenceTable.INVALID_TABLE);
    }

    override getArchive(archiveId: number, key?: number[]): Archive {
        return this.archives[archiveId];
    }

    override getArchiveId(name: string): number {
        return this.archiveNameHashes.get(StringUtil.hashOld(name)) ?? -1;
    }

    override getFile(archiveId: number, fileId: number, key?: number[]): ArchiveFile | undefined {
        return this.archives[archiveId]?.getFile(fileId);
    }
}
