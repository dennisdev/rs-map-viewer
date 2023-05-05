import { Archive } from "../Archive";
import { Definition } from "../definition/Definition";

export class ArchiveDefinitionLoader<T extends Definition> {
    archive: Archive;

    defType: { new (id: number, revision: number): T };

    revision: number;

    constructor(
        archive: Archive,
        defType: { new (id: number, revision: number): T },
        revision: number
    ) {
        this.archive = archive;
        this.defType = defType;
        this.revision = revision;
    }

    getDefinition(id: number): T {
        const def = new this.defType(id, this.revision);
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
        defType: { new (id: number, revision: number): T },
        revision: number
    ) {
        super(archive, defType, revision);
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
