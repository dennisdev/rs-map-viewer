import { CacheInfo } from "../../../mapviewer/CacheInfo";
import { Archive } from "../Archive";
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
