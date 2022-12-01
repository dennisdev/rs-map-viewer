import { AnimationFrame } from "../../model/animation/AnimationFrame";
import { AnimationFrameMap } from "../../model/animation/AnimationFrameMap";
import { IndexSync } from "../Index";
import { StoreSync } from "../Store";
import { SkeletonLoader } from "./SkeletonLoader";

export class AnimationFrameMapLoader {
    frameMapIndex: IndexSync<StoreSync>;

    skeletonLoader: SkeletonLoader;

    constructor(frameMapIndex: IndexSync<StoreSync>, skeletonLoader: SkeletonLoader) {
        this.frameMapIndex = frameMapIndex;
        this.skeletonLoader = skeletonLoader;
    }

    getFrameMap(id: number): AnimationFrameMap {
        const archive = this.frameMapIndex.getArchive(id);

        const frames: AnimationFrame[] = new Array(archive.lastFileId);

        for (const file of archive.files) {
            frames[file.id] = AnimationFrame.load(file.data, this.skeletonLoader);
        }

        return new AnimationFrameMap(frames);
    }
}

export class CachedAnimationFrameMapLoader extends AnimationFrameMapLoader {
    cache: Map<number, AnimationFrameMap>;

    constructor(frameMapIndex: IndexSync<StoreSync>, skeletonLoader: SkeletonLoader) {
        super(frameMapIndex, skeletonLoader);
        this.cache = new Map();
    }

    override getFrameMap(id: number): AnimationFrameMap {
        let frameMap = this.cache.get(id);
        if (!frameMap) {
            frameMap = super.getFrameMap(id);
            if (frameMap) {
                this.cache.set(id, frameMap); 
            }
        }
        return frameMap;
    }
}
