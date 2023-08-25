import { CacheInfo } from "./CacheInfo";

export type CacheType = "classic" | "legacy" | "dat" | "dat2";

export function detectCacheType(cacheInfo: CacheInfo): CacheType {
    switch (cacheInfo.game) {
        case "classic":
            return "classic";
        case "runescape":
            if (cacheInfo.revision < 234) {
                return "legacy";
            } else if (cacheInfo.revision < 410) {
                return "dat";
            } else {
                return "dat2";
            }
        case "oldschool":
            return "dat2";
        default:
            throw new Error("Unknown game type: " + cacheInfo.game);
    }
}
