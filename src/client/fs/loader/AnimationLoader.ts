import { Archive } from "../Archive";
import { AnimationDefinition } from "../definition/AnimationDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class AnimationLoader extends ArchiveDefinitionLoader<AnimationDefinition> {
    constructor(archive: Archive) {
        super(archive, AnimationDefinition);
    }
}

export class CachedAnimationLoader extends CachedArchiveDefinitionLoader<AnimationDefinition> {
    constructor(archive: Archive) {
        super(archive, AnimationDefinition);
    }
}
