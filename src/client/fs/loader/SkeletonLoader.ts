import { Skeleton } from "../../model/animation/Skeleton";
import { IndexSync } from "../Index";
import { StoreSync } from "../Store";

export class SkeletonLoader {
    skeletonIndex: IndexSync<StoreSync>;

    constructor(skeletonIndex: IndexSync<StoreSync>) {
        this.skeletonIndex = skeletonIndex;
    }

    getSkeleton(id: number): Skeleton | undefined {
        const file = this.skeletonIndex.getFile(id, 0);
        return file && new Skeleton(id, file.data);
    }
}

export class CachedSkeletonLoader extends SkeletonLoader {
    cache: Map<number, Skeleton>;

    constructor(skeletonIndex: IndexSync<StoreSync>) {
        super(skeletonIndex);
        this.cache = new Map();
    }

    override getSkeleton(id: number): Skeleton | undefined {
        let skeleton = this.cache.get(id);
        if (!skeleton) {
            skeleton = super.getSkeleton(id);
            if (skeleton) {
                this.cache.set(id, skeleton);
            }
        }
        return skeleton;
    }
}
