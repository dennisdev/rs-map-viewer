import { Archive } from "../Archive";
import { UnderlayDefinition } from "../definition/UnderlayDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class UnderlayLoader extends ArchiveDefinitionLoader<UnderlayDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, UnderlayDefinition, revision);
    }
}

export class CachedUnderlayLoader extends CachedArchiveDefinitionLoader<UnderlayDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, UnderlayDefinition, revision);
    }
}
