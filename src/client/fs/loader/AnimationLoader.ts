import { Archive } from "../Archive";
import { CacheInfo } from "../Types";
import { AnimationDefinition } from "../definition/AnimationDefinition";
import {
    ArchiveDefinitionLoader,
    CachedDefinitionLoader,
    DefinitionLoader,
} from "./DefinitionLoader";

export type AnimationLoader = DefinitionLoader<AnimationDefinition>;

export class AnimationDat2Loader extends ArchiveDefinitionLoader<AnimationDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, AnimationDefinition, cacheInfo);
    }
}

export class CachedAnimationDat2Loader extends CachedDefinitionLoader<AnimationDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(new AnimationDat2Loader(archive, cacheInfo));
    }
}

export class AnimationDatLoader
    implements DefinitionLoader<AnimationDefinition>
{
    animations: AnimationDefinition[];

    static load(
        configArchive: Archive,
        cacheInfo: CacheInfo
    ): AnimationDatLoader {
        const file = configArchive.getFileNamed("seq.dat");
        if (!file) {
            throw new Error("seq.dat not found");
        }
        const buffer = file.getDataAsBuffer();

        const count = buffer.readUnsignedShort();
        const animations = new Array<AnimationDefinition>(count);
        for (let i = 0; i < count; i++) {
            const animation = (animations[i] = new AnimationDefinition(
                i,
                cacheInfo
            ));
            animation.decode(buffer);
            animation.post();
        }

        return new AnimationDatLoader(animations);
    }

    constructor(animations: AnimationDefinition[]) {
        this.animations = animations;
    }

    getDefinition(id: number): AnimationDefinition {
        return this.animations[id];
    }

    resetCache(): void {}
}
