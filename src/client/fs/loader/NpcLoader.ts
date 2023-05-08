import { CacheInfo } from "../../../mapviewer/CacheInfo";
import { Archive } from "../Archive";
import { NpcDefinition } from "../definition/NpcDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class NpcLoader extends ArchiveDefinitionLoader<NpcDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, NpcDefinition, cacheInfo);
    }
}

export class CachedNpcLoader extends CachedArchiveDefinitionLoader<NpcDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, NpcDefinition, cacheInfo);
    }
}
