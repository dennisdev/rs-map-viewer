import { Archive } from "../Archive";
import { NpcDefinition } from "../definition/NpcDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class NpcLoader extends ArchiveDefinitionLoader<NpcDefinition> {
    constructor(archive: Archive) {
        super(archive, NpcDefinition);
    }
}

export class CachedNpcLoader extends CachedArchiveDefinitionLoader<NpcDefinition> {
    constructor(archive: Archive) {
        super(archive, NpcDefinition);
    }
}
