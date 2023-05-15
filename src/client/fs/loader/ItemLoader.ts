import { CacheInfo } from "../../../mapviewer/CacheInfo";
import { Archive } from "../Archive";
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
