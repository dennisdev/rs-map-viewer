export type CacheInfo = {
    name: string;
    revision: number;
    timestamp: string;
    size: number;
};

export async function getCacheList(): Promise<CacheInfo[]> {
    const resp = await fetch("/caches/caches.json");
    return resp.json();
}

export function getLatestCache(caches: CacheInfo[]): CacheInfo | undefined {
    if (caches.length === 0) {
        return undefined;
    }

    // sort new to old
    caches.sort((a, b) => {
        const dateA = Date.parse(a.timestamp);
        const dateB = Date.parse(b.timestamp);
        return b.revision - a.revision || dateB - dateA;
    });

    return caches[0];
}
