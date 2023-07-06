import { Archive } from "../Archive";
import { CacheInfo } from "../CacheInfo";
import { Definition } from "../definition/Definition";

export class ArchiveDefinitionLoader<T extends Definition> {
    archive: Archive;

    defType: { new (id: number, cacheInfo: CacheInfo): T };

    cacheInfo: CacheInfo;

    constructor(
        archive: Archive,
        defType: { new (id: number, cacheInfo: CacheInfo): T },
        cacheInfo: CacheInfo
    ) {
        this.archive = archive;
        this.defType = defType;
        this.cacheInfo = cacheInfo;
    }

    getDefinition(id: number): T {
        const def = new this.defType(id, this.cacheInfo);
        const file = this.archive.getFile(id);
        if (file) {
            def.decode(file.getDataAsBuffer());
            def.post();
        }
        return def;
    }
}

export class CachedArchiveDefinitionLoader<
    T extends Definition
> extends ArchiveDefinitionLoader<T> {
    cache: Map<number, T>;

    constructor(
        archive: Archive,
        defType: { new (id: number, cacheInfo: CacheInfo): T },
        cacheInfo: CacheInfo
    ) {
        super(archive, defType, cacheInfo);
        this.cache = new Map();
    }

    override getDefinition(id: number): T {
        let def = this.cache.get(id);
        if (!def) {
            def = super.getDefinition(id);
            this.cache.set(id, def);
        }
        return def;
    }
}
