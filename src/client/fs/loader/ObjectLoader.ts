import { Archive } from "../Archive";
import { CacheInfo } from "../CacheInfo";
import { ObjectDefinition } from "../definition/ObjectDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class ObjectLoader extends ArchiveDefinitionLoader<ObjectDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, ObjectDefinition, cacheInfo);
    }
}

export class CachedObjectLoader extends CachedArchiveDefinitionLoader<ObjectDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, ObjectDefinition, cacheInfo);
    }
}
