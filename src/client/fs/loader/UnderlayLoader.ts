import { Archive } from "../Archive";
import { UnderlayDefinition } from "../definition/UnderlayDefinition";
import { ArchiveDefinitionLoader, CachedArchiveDefinitionLoader } from "./DefinitionLoader";

export class UnderlayLoader extends ArchiveDefinitionLoader<UnderlayDefinition> {
    constructor(archive: Archive) {
        super(archive, UnderlayDefinition);
    }
}

export class CachedUnderlayLoader extends CachedArchiveDefinitionLoader<UnderlayDefinition> {
    constructor(archive: Archive) {
        super(archive, UnderlayDefinition);
    }
}
