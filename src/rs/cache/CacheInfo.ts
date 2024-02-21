export type GameType = "classic" | "runescape" | "oldschool";

export type CacheInfo = {
    name: string;
    game: GameType;
    environment: string;
    revision: number;
    timestamp: string;
    size: number;
};

export function sortCachesNewToOld(caches: CacheInfo[]): void {
    caches.sort((a, b) => {
        const isOsrsA = a.game === "oldschool";
        const isOsrsB = b.game === "oldschool";
        const isLiveA = a.environment === "live";
        const isLiveB = b.environment === "live";
        const dateA = Date.parse(a.timestamp);
        const dateB = Date.parse(b.timestamp);
        return (
            (isOsrsB ? 1 : 0) - (isOsrsA ? 1 : 0) ||
            (isLiveB ? 1 : 0) - (isLiveA ? 1 : 0) ||
            b.revision - a.revision ||
            dateB - dateA
        );
    });
}

export function getLatestCache(caches: CacheInfo[]): CacheInfo | undefined {
    if (caches.length === 0) {
        return undefined;
    }

    sortCachesNewToOld(caches);

    return caches[0];
}
