import { CacheType } from "./CacheType";
import { SectorCluster } from "./store/SectorCluster";

export class CacheFiles {
    static DAT_FILE_NAME = "main_file_cache.dat";
    static DAT2_FILE_NAME = "main_file_cache.dat2";

    static INDEX_FILE_PREFIX = "main_file_cache.idx";

    static META_FILE_NAME = "main_file_cache.idx255";

    static DAT_INDEX_COUNT = 5;

    static fetchFiles(
        cacheType: CacheType,
        baseUrl: string,
        name: string,
        shared: boolean = false,
        signal?: AbortSignal,
        progressListener?: ProgressListener,
    ): Promise<CacheFiles> {
        switch (cacheType) {
            case "legacy":
                return CacheFiles.fetchLegacy(baseUrl, name, shared, signal, progressListener);
            case "dat":
                return CacheFiles.fetchDat(baseUrl, name, shared, signal, progressListener);
            case "dat2":
                return CacheFiles.fetchDat2(baseUrl, name, [], shared, signal, progressListener);
        }
        throw new Error("Not implemented");
    }

    static async fetchLegacy(
        baseUrl: string,
        cacheName: string,
        shared: boolean = false,
        signal?: AbortSignal,
        progressListener?: ProgressListener,
    ): Promise<CacheFiles> {
        const files = new Map<string, ArrayBuffer>();

        const cache = await caches.open(cacheName);

        const modelsFilePromise = fetchCachedFile(
            baseUrl,
            "models",
            shared,
            false,
            cache,
            signal,
            progressListener,
        );

        const fileNames = ["title", "config", "media", "textures"];
        const filePromises = fileNames.map((name) =>
            fetchCachedFile(baseUrl, name, shared, false, cache, signal),
        );

        let mapNames: string[] = [];
        try {
            mapNames = await fetch(baseUrl + "maps.json").then((resp) => resp.json());
        } catch (e) {}

        for (const mapName of mapNames) {
            filePromises.push(
                fetchCachedFile(baseUrl, "maps/" + mapName, shared, false, cache, signal),
            );
        }

        const cachedFiles = await Promise.all([modelsFilePromise, ...filePromises]);

        for (const file of cachedFiles) {
            files.set(file.name, file.data);
        }

        return new CacheFiles(files);
    }

    static async fetchDat(
        baseUrl: string,
        cacheName: string,
        shared: boolean = false,
        signal?: AbortSignal,
        progressListener?: ProgressListener,
    ): Promise<CacheFiles> {
        const files = new Map<string, ArrayBuffer>();

        const cache = await caches.open(cacheName);

        const dataFilePromise = fetchCachedFile(
            baseUrl,
            CacheFiles.DAT_FILE_NAME,
            shared,
            true,
            cache,
            signal,
            progressListener,
        );
        const indexFilePromises: Promise<CachedFile>[] = [];
        for (let i = 0; i < CacheFiles.DAT_INDEX_COUNT; i++) {
            indexFilePromises.push(
                fetchCachedFile(baseUrl, CacheFiles.INDEX_FILE_PREFIX + i, shared, false, cache),
            );
        }

        const dataAndIndices = await Promise.all([dataFilePromise, ...indexFilePromises]);
        for (const file of dataAndIndices) {
            files.set(file.name, file.data);
        }

        return new CacheFiles(files);
    }

    static async fetchDat2(
        baseUrl: string,
        cacheName: string,
        indicesToLoad: number[] = [],
        shared: boolean = false,
        signal?: AbortSignal,
        progressListener?: ProgressListener,
    ): Promise<CacheFiles> {
        const files = new Map<string, ArrayBuffer>();

        const cache = await caches.open(cacheName);

        const dataFilePromise = fetchCachedFile(
            baseUrl,
            CacheFiles.DAT2_FILE_NAME,
            shared,
            true,
            cache,
            signal,
            progressListener,
        );
        const metaFile = await fetchCachedFile(
            baseUrl,
            CacheFiles.META_FILE_NAME,
            shared,
            false,
            cache,
        );
        const indexCount = metaFile.data.byteLength / SectorCluster.SIZE;

        if (indicesToLoad.length === 0) {
            indicesToLoad = Array.from({ length: indexCount }, (_, i) => i);
        }

        const indexPromises = indicesToLoad.map((indexId) =>
            fetchCachedFile(
                baseUrl,
                CacheFiles.INDEX_FILE_PREFIX + indexId,
                shared,
                false,
                cache,
            ).catch(console.error),
        );

        const dataAndIndices = await Promise.all([dataFilePromise, ...indexPromises]);
        for (const file of dataAndIndices) {
            if (file) {
                files.set(file.name, file.data);
            }
        }
        files.set(metaFile.name, metaFile.data);

        return new CacheFiles(files);
    }

    constructor(readonly files: Map<string, ArrayBuffer>) {}
}

export type DownloadProgress = {
    total: number;
    current: number;
    part: Uint8Array;
};

export type ProgressListener = (progress: DownloadProgress) => void;

function ReadableBufferStream(ab: ArrayBuffer): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(new Uint8Array(ab));
            controller.close();
        },
    });
}

async function toBufferParts(
    response: Response,
    offset: number,
    progressListener?: ProgressListener,
): Promise<Uint8Array[]> {
    if (!response.body) {
        return [];
    }
    const contentLength = offset + Number(response.headers.get("Content-Length") || 0);

    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let currentLength = offset;

    if (progressListener) {
        progressListener({
            total: contentLength,
            current: currentLength,
            part: new Uint8Array(0),
        });
    }

    for (let res = await reader.read(); !res.done && res.value; res = await reader.read()) {
        parts.push(res.value);
        currentLength += res.value.byteLength;
        if (progressListener) {
            progressListener({
                total: contentLength,
                current: currentLength,
                part: res.value,
            });
        }
    }
    return parts;
}

function partsToBuffer(parts: Uint8Array[], shared: boolean): ArrayBuffer {
    let totalLength = 0;
    for (const part of parts) {
        totalLength += part.byteLength;
    }

    const sab = shared ? new SharedArrayBuffer(totalLength) : new ArrayBuffer(totalLength);
    const u8 = new Uint8Array(sab);
    let offset = 0;
    for (const buffer of parts) {
        u8.set(buffer, offset);
        offset += buffer.byteLength;
    }
    return sab;
}

type CachedFile = {
    name: string;
    data: ArrayBuffer;
};

async function fetchCachedFile(
    baseUrl: string,
    name: string,
    shared: boolean,
    incremental: boolean,
    cache: Cache,
    signal?: AbortSignal,
    progressListener?: ProgressListener,
): Promise<CachedFile> {
    const path = baseUrl + name;
    const cachedResp = await cache.match(path);
    if (cachedResp) {
        const parts = await toBufferParts(cachedResp, 0, progressListener);
        return {
            name,
            data: partsToBuffer(parts, shared),
        };
    }
    const partUrls: RequestInfo[] = [];
    const partBuffers: Uint8Array[][] = [];
    if (incremental) {
        const partResponses = await cache.matchAll(path + "/part/", {
            ignoreSearch: true,
        });
        for (const partResp of partResponses) {
            const index = parseInt(partResp.headers.get("Cache-Part") || "0");
            partUrls.push(path + "/part/?p=" + index);
            partBuffers[index] = await toBufferParts(partResp, 0);
        }
    }

    const parts: Uint8Array[] = [];
    let partCount = 0;
    let offset = 0;
    for (let i = 0; i < partBuffers.length; i++) {
        const partBuffer = partBuffers[i];
        if (!partBuffer) {
            break;
        }
        partCount++;
        for (const part of partBuffer) {
            parts.push(part);
            offset += part.byteLength;
        }
    }

    const headers: HeadersInit = {};

    if (offset > 0) {
        headers["Range"] = `bytes=${offset}-${Number.MAX_SAFE_INTEGER}`;
    }

    const resp = await fetch(path, {
        headers,
        signal,
    });
    if (resp.status !== 200 && resp.status !== 206) {
        throw new Error("Failed downloading " + path + ", " + resp.status);
    }
    const cacheUpdates: Promise<void>[] = [];
    let partCache: Uint8Array[] = [];
    let partCacheLength = 0;
    const partProgressListener = (progress: DownloadProgress) => {
        if (incremental && progress.part.byteLength > 0) {
            partCache.push(progress.part);
            partCacheLength += progress.part.byteLength;

            // cache every 1% of the total file size
            const partCacheThreshold = Math.max(progress.total * 0.01, 1000 * 1024);

            if (partCacheLength > partCacheThreshold) {
                const partUrl = path + "/part/?p=" + partCount;
                partUrls.push(partUrl);
                const partResp = new Response(
                    ReadableBufferStream(partsToBuffer(partCache, false)),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/octet-stream",
                            "Content-Length": partCacheLength.toString(),
                            "Cache-Part": partCount.toString(),
                        },
                    },
                );
                Object.defineProperty(partResp, "url", { value: partUrl });
                const update = cache.put(partUrl, partResp);
                cacheUpdates.push(update);
                partCount++;

                partCache = [];
                partCacheLength = 0;
            }
        }
        if (progressListener) {
            progressListener(progress);
        }
    };
    const newParts = await toBufferParts(resp, offset, partProgressListener);
    for (const part of newParts) {
        parts.push(part);
    }

    const buffer = partsToBuffer(parts, shared);

    cache.put(
        path,
        new Response(ReadableBufferStream(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": buffer.byteLength.toString(),
            },
        }),
    );

    if (incremental) {
        await Promise.all(cacheUpdates);
        for (const url of partUrls) {
            cache.delete(url);
        }
    }

    return {
        name,
        data: buffer,
    };
}
