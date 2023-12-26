import fs from "fs";

import { CacheList, LoadedCache, XteaMap } from "../../src/mapviewer/Caches";
import { CacheFiles } from "../../src/rs/cache/CacheFiles";
import { CacheInfo, getLatestCache } from "../../src/rs/cache/CacheInfo";
import { detectCacheType } from "../../src/rs/cache/CacheType";

export function loadCacheInfos(): CacheInfo[] {
    const json = fs.readFileSync("./caches/caches.json", "utf8");
    return JSON.parse(json);
}

export function loadCacheList(caches: CacheInfo[]): CacheList {
    const latest = getLatestCache(caches);
    if (!latest) {
        throw new Error("No latest cache");
    }
    return {
        caches,
        latest,
    };
}

export function loadCacheFiles(cache: CacheInfo): CacheFiles {
    const cachePath = "./caches/" + cache.name + "/";

    const files = new Map<string, ArrayBuffer>();

    fs.readdirSync(cachePath).forEach((fileName: string) => {
        const buffer = fs.readFileSync(cachePath + fileName);

        const newBuffer = new ArrayBuffer(buffer.byteLength);
        const newView = new Uint8Array(newBuffer);
        for (let i = 0; i < buffer.byteLength; i++) {
            newView[i] = buffer[i];
        }

        files.set(fileName, newBuffer);
    });

    return new CacheFiles(files);
}

export function loadCache(info: CacheInfo): LoadedCache {
    const files = loadCacheFiles(info);
    const xteas = loadXteas(info);
    return {
        info,
        type: detectCacheType(info),
        files,
        xteas,
    };
}

export function loadXteas(cache: CacheInfo): XteaMap {
    const cachePath = "./caches/" + cache.name + "/";
    const json = fs.readFileSync(cachePath + "keys.json", "utf8");
    const data: Record<string, number[]> = JSON.parse(json);
    return new Map(Object.keys(data).map((key) => [parseInt(key), data[key]]));
}
