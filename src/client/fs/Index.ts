import { Container } from "./Container";
import { ByteBuffer } from "../util/ByteBuffer";
import { ReferenceTable, INVALID_TABLE } from "./ref/ReferenceTable";
import { Archive } from "./Archive";
import { ArchiveReference } from "./ref/ArchiveReference";
import { ArchiveFile } from "./ArchiveFile";
import { BaseStore, Store, StoreAsync } from "./store/Store";
import { ApiType, CacheType } from "./Types";

export abstract class BaseIndex<
    A extends ApiType,
    T extends CacheType,
    S extends BaseStore<A, T>
> {
    constructor(public readonly id: number, public readonly store: S) {}

    read(archiveId: number) {
        return this.store.read(this.id, archiveId);
    }

    abstract getArchiveIds(): Int32Array;

    getArchiveCount(): number {
        return this.getArchiveIds().length;
    }

    abstract getArchive(
        id: number,
        key?: number[]
    ): A extends ApiType.SYNC ? Archive : Promise<Archive>;

    abstract getFile(
        archiveId: number,
        fileId: number,
        key?: number[]
    ): A extends ApiType.SYNC
        ? ArchiveFile | undefined
        : Promise<ArchiveFile | undefined>;
}

export abstract class BaseIndexDat<
    A extends ApiType,
    S extends BaseStore<A, CacheType.DAT>
> extends BaseIndex<A, CacheType.DAT, S> {
    constructor(id: number, store: S, public readonly archiveIds: Int32Array) {
        super(id, store);
    }

    override getArchiveIds(): Int32Array {
        return this.archiveIds;
    }
}

export class IndexDat<
    S extends BaseStore<ApiType.SYNC, CacheType.DAT>
> extends BaseIndexDat<ApiType.SYNC, S> {
    override getArchive(id: number, key?: number[]): Archive {
        const data = this.read(id);
        return Archive.decodeDat(this.id, id, data);
    }

    override getFile(
        archiveId: number,
        fileId: number,
        key?: number[]
    ): ArchiveFile | undefined {
        return this.getArchive(archiveId, key).getFile(fileId);
    }
}

export type GenericIndexDat = IndexDat<Store<CacheType.DAT>>;

export class IndexDatAsync<
    S extends BaseStore<ApiType.ASYNC, CacheType.DAT>
> extends BaseIndexDat<ApiType.ASYNC, S> {
    override async getArchive(id: number, key?: number[]): Promise<Archive> {
        const data = await this.read(id);
        return Archive.decodeDat(this.id, id, data);
    }

    override async getFile(
        archiveId: number,
        fileId: number,
        key?: number[]
    ): Promise<ArchiveFile | undefined> {
        const archive = await this.getArchive(archiveId, key);
        return archive.getFile(fileId);
    }
}

export abstract class BaseIndexDat2<
    A extends ApiType,
    S extends BaseStore<A, CacheType.DAT2>
> extends BaseIndex<A, CacheType.DAT2, S> {
    constructor(id: number, store: S, public readonly table: ReferenceTable) {
        super(id, store);
    }

    getArchiveIds(): Int32Array {
        return this.table.archiveIds;
    }

    getArchiveReference(archiveId: number): ArchiveReference | undefined {
        return this.table.getArchiveReference(archiveId);
    }

    getArchiveId(name: string): number {
        return this.table.getArchiveId(name) ?? -1;
    }
}

export class IndexDat2<
    S extends BaseStore<ApiType.SYNC, CacheType.DAT2>
> extends BaseIndexDat2<ApiType.SYNC, S> {
    getArchive(id: number, key?: number[] | undefined): Archive {
        const archiveRef = this.getArchiveReference(id);
        if (!archiveRef) {
            throw new Error("Archive reference not found for: " + id);
        }
        const data = this.read(id);
        const container = Container.decode(new ByteBuffer(data), key);
        return Archive.decodeDat2(
            id,
            archiveRef.lastFileId,
            archiveRef.fileCount,
            archiveRef.fileIds,
            archiveRef.fileNameHashes,
            new ByteBuffer(container.data)
        );
    }

    getFile(
        archiveId: number,
        fileId: number,
        key?: number[] | undefined
    ): ArchiveFile | undefined {
        return this.getArchive(archiveId, key).getFile(fileId);
    }
}

export type GenericIndexDat2 = IndexDat2<Store<CacheType.DAT2>>;

export class IndexDat2Async<
    S extends BaseStore<ApiType.ASYNC, CacheType.DAT2>
> extends BaseIndexDat2<ApiType.ASYNC, S> {
    override async getArchive(
        id: number,
        key?: number[] | undefined
    ): Promise<Archive> {
        const archiveRef = this.getArchiveReference(id);
        if (!archiveRef) {
            throw new Error("Archive reference not found for: " + id);
        }
        const data = await this.read(id);
        const container = Container.decode(new ByteBuffer(data), key);
        return Archive.decodeDat2(
            id,
            archiveRef.lastFileId,
            archiveRef.fileCount,
            archiveRef.fileIds,
            archiveRef.fileNameHashes,
            new ByteBuffer(container.data)
        );
    }

    override async getFile(
        archiveId: number,
        fileId: number,
        key?: number[] | undefined
    ): Promise<ArchiveFile | undefined> {
        const archive = await this.getArchive(archiveId, key);
        return archive.getFile(fileId);
    }
}

export type GenericIndex = GenericIndexDat | GenericIndexDat2;

export function loadDat<S extends Store<CacheType.DAT>>(
    id: number,
    store: S,
    archiveIds: Int32Array
): IndexDat<S> {
    return new IndexDat(id, store, archiveIds);
}

function decodeTable(data: Int8Array): ReferenceTable {
    if (data.length) {
        const container = Container.decode(new ByteBuffer(data));
        return ReferenceTable.decode(new ByteBuffer(container.data));
    }
    return INVALID_TABLE;
}

export function loadDat2<S extends Store<CacheType.DAT2>>(
    id: number,
    store: S
): IndexDat2<S> {
    const data = store.read(255, id);
    return new IndexDat2(id, store, decodeTable(data));
}

export async function loadDat2Async<S extends StoreAsync<CacheType.DAT2>>(
    id: number,
    store: S
) {
    const data = await store.read(255, id);
    return new IndexDat2Async(id, store, decodeTable(data));
}
