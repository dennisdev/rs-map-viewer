import { AnimationFrame } from "../../model/animation/AnimationFrame";
import { AnimationFrameMap } from "../../model/animation/AnimationFrameMap";
import { GenericIndexDat, GenericIndexDat2 } from "../Index";
import { SkeletonLoader } from "./SkeletonLoader";

export interface AnimationFrameLoader {
    getFrame(id: number): AnimationFrame | undefined;

    resetCache(): void;
}

export class AnimationFrameDatLoader implements AnimationFrameLoader {
    frames: Map<number, AnimationFrame>;

    static load(frameMapIndex: GenericIndexDat): AnimationFrameDatLoader {
        const frames: Map<number, AnimationFrame> = new Map();

        for (let i = 0; i < frameMapIndex.getArchiveCount(); i++) {
            const file = frameMapIndex.getFile(i, 0);
            if (!file) {
                continue;
            }
            AnimationFrame.loadDat(frames, file.data);
        }

        return new AnimationFrameDatLoader(frames);
    }

    constructor(frames: Map<number, AnimationFrame>) {
        this.frames = frames;
    }

    getFrame(id: number): AnimationFrame | undefined {
        return this.frames.get(id);
    }

    resetCache(): void {}
}

export class AnimationFrameDat2Loader implements AnimationFrameLoader {
    frameMapIndex: GenericIndexDat2;
    skeletonLoader: SkeletonLoader;

    frameMaps: Map<number, AnimationFrameMap>;

    constructor(
        frameMapIndex: GenericIndexDat2,
        skeletonLoader: SkeletonLoader
    ) {
        this.frameMapIndex = frameMapIndex;
        this.skeletonLoader = skeletonLoader;
        this.frameMaps = new Map();
    }

    getFrame(id: number): AnimationFrame | undefined {
        const frameMapId = id >> 16;
        const frameId = id & 0xffff;

        let frameMap = this.frameMaps.get(frameMapId);
        if (!frameMap) {
            const archive = this.frameMapIndex.getArchive(frameMapId);

            const frames: AnimationFrame[] = new Array(archive.lastFileId);

            for (const file of archive.files) {
                frames[file.id] = AnimationFrame.loadDat2(
                    this.skeletonLoader,
                    file.data
                );
            }

            frameMap = new AnimationFrameMap(frames);
            this.frameMaps.set(frameMapId, frameMap);
        }

        return frameMap.frames[frameId];
    }

    resetCache(): void {
        this.skeletonLoader.resetCache();
        this.frameMaps.clear();
    }
}
