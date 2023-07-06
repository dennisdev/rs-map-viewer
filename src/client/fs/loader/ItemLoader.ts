import { Archive } from "../Archive";
import { CacheInfo } from "../CacheInfo";
import { ItemDefinition } from "../definition/ItemDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class ItemLoader extends ArchiveDefinitionLoader<ItemDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, ItemDefinition, cacheInfo);
    }
}

export class CachedItemLoader extends CachedArchiveDefinitionLoader<ItemDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, ItemDefinition, cacheInfo);
    }
}
