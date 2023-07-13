export enum ApiType {
    SYNC,
    ASYNC,
}

export enum CacheType {
    // <= 377
    DAT,
    // >= 410
    DAT2,
}

export type GameType = "runescape" | "oldschool";

export type CacheInfo = {
    name: string;
    game: GameType;
    revision: number;
    timestamp: string;
    size: number;
};

export function getCacheType(cacheInfo: CacheInfo): CacheType {
    if (cacheInfo.game === "runescape" && cacheInfo.revision <= 377) {
        return CacheType.DAT;
    } else {
        return CacheType.DAT2;
    }
}
