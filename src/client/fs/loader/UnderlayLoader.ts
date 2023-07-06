import { Archive } from "../Archive";
import { CacheInfo } from "../CacheInfo";
import { UnderlayDefinition } from "../definition/UnderlayDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class UnderlayLoader extends ArchiveDefinitionLoader<UnderlayDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, UnderlayDefinition, cacheInfo);
    }
}

export class CachedUnderlayLoader extends CachedArchiveDefinitionLoader<UnderlayDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, UnderlayDefinition, cacheInfo);
    }
}
