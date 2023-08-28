import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import { Dat2SeqFrame, DatSeqFrame, SeqFrame } from "./SeqFrame";
import { SeqBaseLoader } from "./SeqBaseLoader";
import { SeqFrameMap } from "./SeqFrameMap";

export interface SeqFrameLoader {
    load(id: number): SeqFrame | undefined;

    clearCache(): void;
}

export class DatSeqFrameLoader implements SeqFrameLoader {
    static load(frameMapIndex: CacheIndex): DatSeqFrameLoader {
        const frames: Map<number, SeqFrame> = new Map();

        for (let i = 0; i < frameMapIndex.getArchiveCount(); i++) {
            try {
                const file = frameMapIndex.getFile(i, 0);
                if (!file) {
                    continue;
                }
                DatSeqFrame.load(frames, file.data);
            } catch (e) {
                console.error("Failed loading frame map " + i, e);
            }
        }

        return new DatSeqFrameLoader(frames);
    }

    constructor(readonly frames: Map<number, SeqFrame>) {}

    load(id: number): SeqFrame | undefined {
        return this.frames.get(id);
    }

    clearCache(): void {}
}

export class Dat2SeqFrameLoader implements SeqFrameLoader {
    frameMaps: Map<number, SeqFrameMap> = new Map();

    constructor(
        readonly cacheInfo: CacheInfo,
        readonly animIndex: CacheIndex,
        readonly baseLoader: SeqBaseLoader,
    ) {}

    // changed 610
    load(id: number): SeqFrame | undefined {
        const frameMapId = id >> 16;
        const frameId = id & 0xffff;

        let frameMap = this.frameMaps.get(frameMapId);
        if (!frameMap) {
            const archive = this.animIndex.getArchive(frameMapId);

            const frames: SeqFrame[] = new Array(archive.lastFileId);

            for (const file of archive.files) {
                frames[file.id] = Dat2SeqFrame.load(this.cacheInfo, this.baseLoader, file.data);
            }

            frameMap = new SeqFrameMap(frames);
            this.frameMaps.set(frameMapId, frameMap);
        }

        return frameMap.frames[frameId];
    }

    clearCache(): void {
        this.frameMaps.clear();
        this.baseLoader.clearCache();
    }
}
