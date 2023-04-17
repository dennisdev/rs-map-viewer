import { Archive } from "../Archive";
import { VarbitDefinition } from "../definition/VarbitDefinition";
import { ArchiveDefinitionLoader, CachedArchiveDefinitionLoader } from "./DefinitionLoader";

export class VarbitLoader extends ArchiveDefinitionLoader<VarbitDefinition> {
    constructor(archive: Archive) {
        super(archive, VarbitDefinition);
    }
}

export class CachedVarbitLoader extends CachedArchiveDefinitionLoader<VarbitDefinition> {
    constructor(archive: Archive) {
        super(archive, VarbitDefinition);
    }
}
