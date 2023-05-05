import { Archive } from "../Archive";
import { AnimationDefinition } from "../definition/AnimationDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class AnimationLoader extends ArchiveDefinitionLoader<AnimationDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, AnimationDefinition, revision);
    }
}

export class CachedAnimationLoader extends CachedArchiveDefinitionLoader<AnimationDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, AnimationDefinition, revision);
    }
}
