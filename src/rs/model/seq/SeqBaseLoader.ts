import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import { Dat2SeqBase, SeqBase } from "./SeqBase";

export interface SeqBaseLoader {
    load(id: number): SeqBase | undefined;

    clearCache(): void;
}

export class IndexSeqBaseLoader implements SeqBaseLoader {
    bases: Map<number, SeqBase> = new Map();

    constructor(
        readonly cacheInfo: CacheInfo,
        readonly index: CacheIndex,
    ) {}

    load(id: number): SeqBase | undefined {
        const cached = this.bases.get(id);
        if (cached) {
            return cached;
        }

        const file = this.index.getFile(id, 0);
        if (!file) {
            return undefined;
        }
        const base = Dat2SeqBase.load(this.cacheInfo, id, file.data);
        this.bases.set(id, base);
        return base;
    }

    clearCache(): void {
        this.bases.clear();
    }
}
