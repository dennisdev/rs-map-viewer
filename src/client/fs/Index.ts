import { Container } from "./Container";
import { ByteBuffer } from "../util/ByteBuffer";
import { ReferenceTable, INVALID_TABLE } from "./ref/ReferenceTable";
import { Archive } from "./Archive";
import { ArchiveReference } from "./ref/ArchiveReference";
import { ArchiveFileReference } from "./ref/ArchiveFileReference";
import { ArchiveFile } from "./ArchiveFile";
import { Store, StoreAsync, StoreSync } from "./store/Store";
import { IndexType } from "./IndexType";

export abstract class Index<T, S extends Store<T>> {
    constructor(
        public readonly id: IndexType,
        public readonly table: ReferenceTable,
        public readonly store: S
    ) {}

    archiveExists(archiveId: number): boolean {
        return this.getArchiveIds().indexOf(archiveId) >= 0;
    }

    getArchiveIds(): Int32Array {
        return this.table.archiveIds;
    }

    getArchiveCount(): number {
        return this.table.archiveCount;
    }

    getLastArchiveId(): number {
        const ids = this.getArchiveIds();
        if (ids.length) {
            return this.table.lastArchiveId;
        } else {
            return -1;
        }
    }

    getArchiveReferences(): ArchiveReference[] {
        return this.table.archiveReferences;
    }

    getArchiveReference(archiveId: number): ArchiveReference | undefined {
        return this.table.getArchiveReference(archiveId);
    }

    getArchiveId(archiveName: string): number {
        const id = this.table.getArchiveId(archiveName);
        if (id !== undefined) {
            return id;
        } else {
            return -1;
        }
    }

    getFileCount(archiveId: number): number {
        const archiveRef = this.getArchiveReference(archiveId);
        if (archiveRef) {
            return archiveRef.fileCount;
        } else {
            return 0;
        }
    }

    getFileIds(archiveId: number): Int32Array {
        const archiveRef = this.getArchiveReference(archiveId);
        if (archiveRef) {
            return archiveRef.fileIds;
        } else {
            return new Int32Array();
        }
    }

    fileExists(archiveId: number, fileId: number): boolean {
        return this.getFileIds(archiveId).indexOf(fileId) >= 0;
    }

    getFileReferences(archiveId: number): ArchiveFileReference[] {
        const archiveRef = this.getArchiveReference(archiveId);
        if (archiveRef) {
            return archiveRef.fileReferences;
        } else {
            return [];
        }
    }

    getFileReference(
        archiveId: number,
        fileId: number
    ): ArchiveFileReference | undefined {
        return this.getFileReferences(archiveId).find(
            (ref) => ref.id === fileId
        );
    }

    getLastFileId(archiveId: number): number {
        const archiveRef = this.getArchiveReference(archiveId);
        if (archiveRef) {
            return archiveRef.lastFileId;
        } else {
            return -1;
        }
    }

    read(archiveId: number): T {
        return this.store.read(this.id, archiveId);
    }
}

export class IndexAsync<S extends StoreAsync> extends Index<
    Promise<Int8Array>,
    S
> {
    async getArchive(id: number, key: number[] = []): Promise<Archive> {
        const archiveRef = this.getArchiveReference(id);
        if (!archiveRef) {
            throw new Error(
                "Archive reference not found for: " + this.id + ", " + id
            );
        }
        const data = await this.read(id);
        const container = Container.decode(new ByteBuffer(data), key);
        return Archive.decode(
            id,
            archiveRef.lastFileId,
            archiveRef.fileCount,
            archiveRef.fileIds,
            new ByteBuffer(container.data)
        );
    }

    async getFile(
        archiveId: number,
        fileId: number,
        key: number[] = []
    ): Promise<ArchiveFile | undefined> {
        const archive = await this.getArchive(archiveId, key);
        return archive.getFile(fileId);
    }
}

export class IndexSync<S extends StoreSync> extends Index<Int8Array, S> {
    getArchive(id: number, key: number[] = []): Archive {
        const archiveRef = this.getArchiveReference(id);
        if (!archiveRef) {
            throw new Error("Archive reference not found for: " + id);
        }
        const data = this.read(id);
        const container = Container.decode(new ByteBuffer(data), key);
        return Archive.decode(
            id,
            archiveRef.lastFileId,
            archiveRef.fileCount,
            archiveRef.fileIds,
            new ByteBuffer(container.data)
        );
    }

    getFile(
        archiveId: number,
        fileId: number,
        key: number[] = []
    ): ArchiveFile | undefined {
        return this.getArchive(archiveId, key).getFile(fileId);
    }
}

function decodeTable(data: Int8Array): ReferenceTable {
    if (data.length) {
        const container = Container.decode(new ByteBuffer(data));
        return ReferenceTable.decode(new ByteBuffer(container.data));
    }
    return INVALID_TABLE;
}

export async function load<S extends StoreAsync>(
    id: IndexType,
    store: S
): Promise<IndexAsync<S>> {
    const data = await store.read(255, id);
    return new IndexAsync(id, decodeTable(data), store);
}

export function loadSync<S extends StoreSync>(
    id: IndexType,
    store: S
): IndexSync<S> {
    const data = store.read(255, id);
    return new IndexSync(id, decodeTable(data), store);
}
