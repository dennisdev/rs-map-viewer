import { Archive } from "../Archive";
import { VarbitDefinition } from "../definition/VarbitDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class VarbitLoader extends ArchiveDefinitionLoader<VarbitDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, VarbitDefinition, revision);
    }
}

export class CachedVarbitLoader extends CachedArchiveDefinitionLoader<VarbitDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, VarbitDefinition, revision);
    }
}
