import { CacheInfo } from "../../../mapviewer/CacheInfo";
import { Archive } from "../Archive";
import { OverlayDefinition } from "../definition/OverlayDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class OverlayLoader extends ArchiveDefinitionLoader<OverlayDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, OverlayDefinition, cacheInfo);
    }
}

export class CachedOverlayLoader extends CachedArchiveDefinitionLoader<OverlayDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, OverlayDefinition, cacheInfo);
    }
}
