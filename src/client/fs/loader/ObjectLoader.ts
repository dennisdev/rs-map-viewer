import { Archive } from "../Archive";
import { ObjectDefinition } from "../definition/ObjectDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class ObjectLoader extends ArchiveDefinitionLoader<ObjectDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, ObjectDefinition, revision);
    }
}

export class CachedObjectLoader extends CachedArchiveDefinitionLoader<ObjectDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, ObjectDefinition, revision);
    }
}
