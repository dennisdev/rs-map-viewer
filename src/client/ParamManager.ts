import { Archive } from "./fs/Archive";
import { ParamDefinition } from "./fs/definition/ParamDefinition";

export class ParamManager {
    private readonly archive: Archive;

    // TODO: Use jagex collections
    private definitionCache: Map<number, ParamDefinition>;

    constructor(archive: Archive) {
        this.archive = archive;
        this.definitionCache = new Map();
    }

    getDefinition(id: number) {
        const cached = this.definitionCache.get(id);
        if (cached) {
            return cached;
        }

        const file = this.archive.getFile(id);

        const def = new ParamDefinition(id);
        if (file) {
            def.decode(file.getDataAsBuffer());
        }
        def.post();

        this.definitionCache.set(id, def);
        return def;
    }
}
