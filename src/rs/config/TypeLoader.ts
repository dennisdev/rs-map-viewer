import { BIT_MASKS } from "../MathConstants";
import { Archive } from "../cache/Archive";
import { CacheIndex } from "../cache/CacheIndex";
import { CacheInfo } from "../cache/CacheInfo";
import { ByteBuffer } from "../io/ByteBuffer";
import { Type } from "./Type";

export interface TypeLoader<T> {
    load(id: number): T;

    getCount(): number;

    clearCache(): void;
}

export type TypeConstructor<T extends Type> = new (id: number, cacheInfo: CacheInfo) => T;

export class DummyTypeLoader<T extends Type> implements TypeLoader<T> {
    constructor(
        readonly cacheInfo: CacheInfo,
        readonly typeConstructor: TypeConstructor<T>,
    ) {}

    load(id: number): T {
        return new this.typeConstructor(id, this.cacheInfo);
    }

    getCount(): number {
        return 0;
    }

    clearCache(): void {}
}

export abstract class BaseTypeLoader<T extends Type> implements TypeLoader<T> {
    // TODO: maybe don't cache by default
    cache: Map<number, T> = new Map();

    constructor(
        readonly typeConstructor: TypeConstructor<T>,
        readonly cacheInfo: CacheInfo,
    ) {}

    abstract getDataBuffer(id: number): ByteBuffer | undefined;

    load(id: number): T {
        const cached = this.cache.get(id);
        if (cached) {
            return cached;
        }
        const type = new this.typeConstructor(id, this.cacheInfo);
        try {
            const buffer = this.getDataBuffer(id);
            if (buffer) {
                type.decode(buffer);
                type.post();
            }
        } catch (e) {
            console.error("Failed loading type " + id, e);
        }
        this.cache.set(id, type);
        return type;
    }

    abstract getCount(): number;

    clearCache(): void {
        this.cache.clear();
    }
}

export class ArchiveTypeLoader<T extends Type> extends BaseTypeLoader<T> {
    constructor(
        readonly typeConstructor: TypeConstructor<T>,
        readonly cacheInfo: CacheInfo,
        readonly archive: Archive,
    ) {
        super(typeConstructor, cacheInfo);
    }

    override getDataBuffer(id: number): ByteBuffer | undefined {
        return this.archive.getFile(id)?.getDataAsBuffer();
    }

    override getCount(): number {
        return this.archive.fileCount;
    }
}

export class IndexTypeLoader<T extends Type> extends BaseTypeLoader<T> {
    count: number;

    archives: Map<number, Archive> = new Map();

    constructor(
        readonly typeConstructor: new (id: number, cacheInfo: CacheInfo) => T,
        readonly cacheInfo: CacheInfo,
        readonly index: CacheIndex,
        readonly fileIdBits: number = 8,
    ) {
        super(typeConstructor, cacheInfo);
        const filesPerArchive = 1 << fileIdBits;
        this.count =
            Math.max((index.getArchiveCount() - 1) * filesPerArchive, 0) +
            index.getFileCount(index.getLastArchiveId());
    }

    override getDataBuffer(id: number): ByteBuffer | undefined {
        const archiveId = id >> this.fileIdBits;
        const fileId = id & BIT_MASKS[this.fileIdBits - 1];

        let archive = this.archives.get(archiveId);
        if (!archive) {
            archive = this.index.getArchive(archiveId);
            this.archives.set(archiveId, archive);
        }
        return archive.getFile(fileId)?.getDataAsBuffer();
    }

    override getCount(): number {
        return this.count;
    }

    override clearCache(): void {
        super.clearCache();
        this.archives.clear();
    }
}

export class DatTypeLoader<T extends Type> implements TypeLoader<T> {
    static load<T extends Type>(
        typeConstructor: TypeConstructor<T>,
        cacheInfo: CacheInfo,
        configArchive: Archive,
        name: string,
    ): DatTypeLoader<T> {
        const file = configArchive.getFileNamed(name + ".dat");
        if (!file) {
            throw new Error(name + ".dat not found");
        }
        const buffer = file.getDataAsBuffer();

        const count = buffer.readUnsignedShort();
        const types = new Array<T>(count);
        for (let i = 0; i < count; i++) {
            const type = (types[i] = new typeConstructor(i, cacheInfo));
            type.decode(buffer);
            type.post();
        }

        return new DatTypeLoader(types);
    }

    constructor(readonly types: T[]) {}

    load(id: number): T {
        return this.types[id];
    }

    getCount(): number {
        return this.types.length;
    }

    clearCache(): void {}
}

export class IndexedDatTypeLoader<T extends Type> extends BaseTypeLoader<T> {
    static load<T extends Type>(
        typeConstructor: TypeConstructor<T>,
        cacheInfo: CacheInfo,
        configArchive: Archive,
        name: string,
    ): IndexedDatTypeLoader<T> {
        const dataFile = configArchive.getFileNamed(name + ".dat");
        const indexFile = configArchive.getFileNamed(name + ".idx");
        if (!dataFile) {
            throw new Error(name + ".dat not found");
        }
        if (!indexFile) {
            throw new Error(name + ".idx not found");
        }
        const indexBuffer = indexFile.getDataAsBuffer();
        const count = indexBuffer.readUnsignedShort();

        const dataOffsets = new Int32Array(count);

        let offset = indexBuffer.offset;
        for (let i = 0; i < count; i++) {
            dataOffsets[i] = offset;
            offset += indexBuffer.readUnsignedShort();
        }

        return new IndexedDatTypeLoader(
            typeConstructor,
            cacheInfo,
            count,
            dataFile.getDataAsBuffer(),
            dataOffsets,
        );
    }

    constructor(
        typeConstructor: TypeConstructor<T>,
        cacheInfo: CacheInfo,
        readonly count: number,
        readonly dataBuffer: ByteBuffer,
        readonly dataOffsets: Int32Array,
    ) {
        super(typeConstructor, cacheInfo);
    }

    override getDataBuffer(id: number): ByteBuffer | undefined {
        if (id < 0 || id >= this.count) {
            return undefined;
        }
        this.dataBuffer.offset = this.dataOffsets[id];
        return this.dataBuffer;
    }

    getCount(): number {
        return this.count;
    }

    clearCache(): void {}
}
