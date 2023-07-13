import { Skeleton } from "../../model/animation/Skeleton";
import { GenericIndexDat2 } from "../Index";

export class SkeletonLoader {
    skeletonIndex: GenericIndexDat2;

    constructor(skeletonIndex: GenericIndexDat2) {
        this.skeletonIndex = skeletonIndex;
    }

    getSkeleton(id: number): Skeleton | undefined {
        const file = this.skeletonIndex.getFile(id, 0);
        return file && Skeleton.loadDat2(id, file.data);
    }

    resetCache(): void {}
}

export class CachedSkeletonLoader extends SkeletonLoader {
    cache: Map<number, Skeleton>;

    constructor(skeletonIndex: GenericIndexDat2) {
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

    override resetCache(): void {
        this.cache.clear();
    }
}
