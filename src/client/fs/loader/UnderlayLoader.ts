import { Archive } from "../Archive";
import { CacheInfo } from "../Types";
import { UnderlayDefinition } from "../definition/floor/UnderlayDefinition";
import {
    ArchiveDefinitionLoader,
    CachedDefinitionLoader,
    DefinitionLoader,
} from "./DefinitionLoader";

export type UnderlayLoader = DefinitionLoader<UnderlayDefinition>;

export class UnderlayDat2Loader extends ArchiveDefinitionLoader<UnderlayDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, UnderlayDefinition, cacheInfo);
    }
}

export class CachedUnderlayDat2Loader extends CachedDefinitionLoader<UnderlayDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(new UnderlayDat2Loader(archive, cacheInfo));
    }
}
