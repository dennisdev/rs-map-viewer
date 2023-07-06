import { Archive } from "../Archive";
import { CacheInfo } from "../CacheInfo";
import { AnimationDefinition } from "../definition/AnimationDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class AnimationLoader extends ArchiveDefinitionLoader<AnimationDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, AnimationDefinition, cacheInfo);
    }
}

export class CachedAnimationLoader extends CachedArchiveDefinitionLoader<AnimationDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, AnimationDefinition, cacheInfo);
    }
}
