import { CacheInfo } from "../client/fs/CacheInfo";
import { fetchMemoryStore, ProgressListener } from "../client/fs/FileSystem";
import { IndexType } from "../client/fs/IndexType";
import { MemoryStore } from "../client/fs/MemoryStore";
import { fetchXteas, Xteas } from "./util/Xteas";

export async function fetchCacheList(): Promise<CacheInfo[]> {
    const resp = await fetch("/caches/caches.json");
    return resp.json();
}

export function sortCachesNewToOld(caches: CacheInfo[]): void {
    caches.sort((a, b) => {
        const isOsrsA = a.game === "oldschool";
        const isOsrsB = b.game === "oldschool";
        const dateA = Date.parse(a.timestamp);
        const dateB = Date.parse(b.timestamp);
        return (
            (isOsrsB ? 1 : 0) - (isOsrsA ? 1 : 0) ||
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

export type LoadedCache = {
    info: CacheInfo;
    store: MemoryStore;
    xteas: Xteas;
};

export async function loadCache(
    info: CacheInfo,
    progressListener?: ProgressListener
): Promise<LoadedCache> {
    const cachePath = "/caches/" + info.name + "/";
    const indices = [
        IndexType.ANIMATIONS,
        IndexType.SKELETONS,
        IndexType.CONFIGS,
        IndexType.MAPS,
        IndexType.MODELS,
        IndexType.SPRITES,
        IndexType.TEXTURES,
    ];
    if (info.game === "oldschool" && info.revision >= 174) {
        indices.push(IndexType.GRAPHIC_DEFAULTS);
    }
    const [store, xteas] = await Promise.all([
        fetchMemoryStore(cachePath, info.name, indices, true, progressListener),
        fetchXteas(cachePath + "keys.json"),
    ]);

    return {
        info,
        store,
        xteas,
    };
}

export async function deleteOldCaches(cacheInfos: CacheInfo[]) {
    const cacheNames = new Set(cacheInfos.map((c) => c.name));

    const cacheKeys = await caches.keys();

    for (const key of cacheKeys) {
        if (!cacheNames.has(key)) {
            caches.delete(key);
        }
    }
}
