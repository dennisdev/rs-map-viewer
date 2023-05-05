import { Archive } from "../Archive";
import { NpcDefinition } from "../definition/NpcDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class NpcLoader extends ArchiveDefinitionLoader<NpcDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, NpcDefinition, revision);
    }
}

export class CachedNpcLoader extends CachedArchiveDefinitionLoader<NpcDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, NpcDefinition, revision);
    }
}
