import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import { Dat2SeqFrameBase, SeqFrameBase } from "./SeqFrameBase";

export interface SeqFrameBaseLoader {
    load(id: number): SeqFrameBase | undefined;
}

export class IndexSeqFrameBaseLoader implements SeqFrameBaseLoader {
    constructor(
        readonly cacheInfo: CacheInfo,
        readonly index: CacheIndex,
    ) {}

    load(id: number): SeqFrameBase | undefined {
        const file = this.index.getFile(id, 0);
        return file && Dat2SeqFrameBase.load(this.cacheInfo, id, file.data);
    }
}
