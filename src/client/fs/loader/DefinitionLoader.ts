import { ByteBuffer } from "../../util/ByteBuffer";
import { Archive } from "../Archive";
import { CacheInfo } from "../Types";
import { Definition } from "../definition/Definition";

export interface DefinitionLoader<T extends Definition> {
    getDefinition(id: number): T;

    resetCache(): void;
}

export abstract class BaseDefinitionLoader<T extends Definition>
    implements DefinitionLoader<T>
{
    constructor(
        public defType: { new (id: number, cacheInfo: CacheInfo): T },
        public cacheInfo: CacheInfo
    ) {}

    abstract getDataBuffer(id: number): ByteBuffer | undefined;

    getDefinition(id: number): T {
        const def = new this.defType(id, this.cacheInfo);
        const buffer = this.getDataBuffer(id);
        if (buffer) {
            def.decode(buffer);
            def.post();
        }
        return def;
    }

    resetCache(): void {}
}

export abstract class ArchiveDefinitionLoader<
    T extends Definition
> extends BaseDefinitionLoader<T> {
    archive: Archive;

    constructor(
        archive: Archive,
        defType: { new (id: number, cacheInfo: CacheInfo): T },
        cacheInfo: CacheInfo
    ) {
        super(defType, cacheInfo);
        this.archive = archive;
    }

    getDataBuffer(id: number): ByteBuffer | undefined {
        return this.archive.getFile(id)?.getDataAsBuffer();
    }
}

export abstract class CachedDefinitionLoader<T extends Definition>
    implements DefinitionLoader<T>
{
    defLoader: DefinitionLoader<T>;

    cache: Map<number, T>;

    constructor(defLoader: DefinitionLoader<T>) {
        this.defLoader = defLoader;
        this.cache = new Map();
    }

    getDefinition(id: number): T {
        let def = this.cache.get(id);
        if (!def) {
            def = this.defLoader.getDefinition(id);
            this.cache.set(id, def);
        }
        return def;
    }

    resetCache(): void {
        this.defLoader.resetCache();
        this.cache.clear();
    }
}
