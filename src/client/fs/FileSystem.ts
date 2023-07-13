import { FileStore } from "./store/FileStore";
import { SectorCluster } from "./store/SectorCluster";
import { MemoryStoreDat, MemoryStoreDat2 } from "./store/MemoryStore";
import { IndexType } from "./IndexType";
import { ApiType, CacheType } from "./Types";
import { BaseStore } from "./store/Store";
import {
    BaseIndex,
    IndexDat,
    IndexDat2,
    IndexDat2Async,
    IndexDatAsync,
    loadDat,
    loadDat2,
    loadDat2Async,
} from "./Index";

export class BaseFileSystem<
    A extends ApiType,
    T extends CacheType,
    S extends BaseStore<A, T>,
    I extends BaseIndex<A, T, S>
> {
    protected readonly indexMap: Map<number, I> = new Map();

    constructor(public readonly store: S, public readonly indices: I[]) {
        indices.forEach((index) => {
            this.indexMap.set(index.id, index);
        });
    }

    indexExists(indexId: number): boolean {
        return this.indexMap.has(indexId);
    }

    getIndex(id: number): I {
        const index = this.indexMap.get(id);
        if (!index) {
            throw new Error("Failed to load index: " + id);
        }
        return index;
    }
}

export type FileSystem<I> = I extends BaseIndex<infer A, infer T, infer S>
    ? BaseFileSystem<A, T, S, I>
    : never;

export type FileSystemDat<S extends BaseStore<ApiType.SYNC, CacheType.DAT>> =
    FileSystem<IndexDat<S>>;
export type FileSystemDat2<S extends BaseStore<ApiType.SYNC, CacheType.DAT2>> =
    FileSystem<IndexDat2<S>>;

export type FileSystemDatAsync<
    S extends BaseStore<ApiType.ASYNC, CacheType.DAT>
> = FileSystem<IndexDatAsync<S>>;
export type FileSystemDat2Async<
    S extends BaseStore<ApiType.ASYNC, CacheType.DAT2>
> = FileSystem<IndexDat2Async<S>>;

export type FileFsDat2 = FileSystemDat2Async<FileStore>;

export type MemoryFsDat = FileSystemDat<MemoryStoreDat>;
export type MemoryFsDat2 = FileSystemDat2<MemoryStoreDat2>;

export async function openFromFiles(files: FileList): Promise<FileFsDat2> {
    const filesArr: File[] = Array.from(files);
    const dataFile = filesArr.find((file) => file.name.endsWith(".dat2"));
    if (typeof dataFile === "undefined") {
        throw new Error("main_file_cache.dat2 file not found");
    }
    const metaFile = filesArr.find((file) => file.name.endsWith(".idx255"));
    if (typeof metaFile === "undefined") {
        throw new Error("main_file_cache.idx255 file not found");
    }
    const indexCount = metaFile.size / SectorCluster.SIZE;
    const indexFiles = new Array<{ id: number; file: File }>(indexCount);

    for (let idx = 0; idx < indexCount; idx++) {
        const indexFile = filesArr.find((file) =>
            file.name.endsWith(".idx" + idx)
        );
        if (typeof indexFile === "undefined") {
            throw new Error(`main_file_cache.idx${idx} file not found`);
        }
        indexFiles[idx] = {
            id: idx,
            file: indexFile,
        };
    }
    const fileStore = new FileStore(
        dataFile,
        indexFiles.map((indexFile) => indexFile.file),
        metaFile
    );
    const indexPromises = indexFiles.map((indexFile) =>
        loadDat2Async(indexFile.id, fileStore)
    );
    const indices = await Promise.all(indexPromises);
    return new BaseFileSystem(fileStore, indices);
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
    progressListener?: ProgressListener
): Promise<Uint8Array[]> {
    if (!response.body) {
        return [];
    }
    const contentLength =
        offset + Number(response.headers.get("Content-Length") || 0);

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

    for (
        let res = await reader.read();
        !res.done && res.value;
        res = await reader.read()
    ) {
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

    const sab = shared
        ? new SharedArrayBuffer(totalLength)
        : new ArrayBuffer(totalLength);
    const u8 = new Uint8Array(sab);
    let offset = 0;
    for (const buffer of parts) {
        u8.set(buffer, offset);
        offset += buffer.byteLength;
    }
    return sab;
}

type CacheIndexFile = {
    id: IndexType;
    data: ArrayBuffer;
};

async function fetchCacheFile(
    cache: Cache,
    input: RequestInfo,
    shared: boolean,
    incremental: boolean,
    progressListener?: ProgressListener
): Promise<ArrayBuffer> {
    const cachedResp = await cache.match(input);
    if (cachedResp) {
        const parts = await toBufferParts(cachedResp, 0, progressListener);
        return partsToBuffer(parts, shared);
    }
    const partUrls: RequestInfo[] = [];
    const partBuffers: Uint8Array[][] = [];
    if (incremental) {
        const partResponses = await cache.matchAll(input + "/part/", {
            ignoreSearch: true,
        });
        for (const partResp of partResponses) {
            const index = parseInt(partResp.headers.get("Cache-Part") || "0");
            partUrls.push(input + "/part/?p=" + index);
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

    const resp = await fetch(input, {
        headers,
    });
    if (resp.status !== 200 && resp.status !== 206) {
        throw new Error("Failed downloading " + input + ", " + resp.status);
    }
    const cacheUpdates: Promise<void>[] = [];
    let partCache: Uint8Array[] = [];
    let partCacheLength = 0;
    const partProgressListener = (progress: DownloadProgress) => {
        if (incremental && progress.part.byteLength > 0) {
            partCache.push(progress.part);
            partCacheLength += progress.part.byteLength;

            // cache every 1MB
            if (partCacheLength > 1000 * 1024) {
                const partUrl = input + "/part/?p=" + partCount;
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
                    }
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
    parts.push(...newParts);

    const buffer = partsToBuffer(parts, shared);

    cache.put(
        input,
        new Response(ReadableBufferStream(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": buffer.byteLength.toString(),
            },
        })
    );

    if (incremental) {
        await Promise.all(cacheUpdates);
        for (const url of partUrls) {
            cache.delete(url);
        }
    }

    return buffer;
}

async function fetchCacheIndex(
    cache: Cache,
    baseUrl: string,
    id: IndexType,
    shared: boolean,
    incremental: boolean
): Promise<CacheIndexFile> {
    const data = await fetchCacheFile(
        cache,
        baseUrl + "main_file_cache.idx" + id,
        shared,
        incremental
    );
    return { id, data };
}

export async function fetchMemoryStoreDat(
    baseUrl: string,
    cacheName: string,
    shared: boolean = false,
    progressListener?: ProgressListener
): Promise<MemoryStoreDat> {
    console.time("fetch dat");
    const cache = await caches.open(cacheName);
    const [dataFile, ...indexFiles] = await Promise.all([
        fetchCacheFile(
            cache,
            baseUrl + "main_file_cache.dat",
            shared,
            true,
            progressListener
        ),
        fetchCacheIndex(cache, baseUrl, 0, shared, false),
        fetchCacheIndex(cache, baseUrl, 1, shared, false),
        fetchCacheIndex(cache, baseUrl, 2, shared, false),
        fetchCacheIndex(cache, baseUrl, 3, shared, false),
        fetchCacheIndex(cache, baseUrl, 4, shared, false),
    ]);

    console.timeEnd("fetch dat");

    const indexFileDatas = indexFiles.map((file) => file.data);
    return new MemoryStoreDat(dataFile, indexFileDatas);
}

export async function fetchMemoryStoreDat2(
    baseUrl: string,
    cacheName: string,
    indicesToLoad: IndexType[] = [],
    shared: boolean = false,
    progressListener?: ProgressListener
): Promise<MemoryStoreDat2> {
    console.time("fetch");
    const cache = await caches.open(cacheName);
    const [dataFile, metaFile] = await Promise.all([
        fetchCacheFile(
            cache,
            baseUrl + "main_file_cache.dat2",
            shared,
            true,
            progressListener
        ),
        fetchCacheFile(
            cache,
            baseUrl + "main_file_cache.idx255",
            shared,
            false
        ),
    ]);

    const indexCount = metaFile.byteLength / SectorCluster.SIZE;
    const allIndexIds = Array.from(Array(indexCount).keys());

    if (!indicesToLoad.length) {
        indicesToLoad = allIndexIds;
    }

    const indexFilePromises = indicesToLoad.map((id) =>
        fetchCacheIndex(cache, baseUrl, id, shared, false)
    );

    const indexFiles = await Promise.all(indexFilePromises);
    console.timeEnd("fetch");
    const indexFileDatas = allIndexIds
        .map((id) => indexFiles.find((file) => file.id === id))
        .map((file) => file && file.data);
    return new MemoryStoreDat2(dataFile, indexFileDatas, metaFile);
}

export async function openFromUrl(
    baseUrl: string,
    cacheName: string,
    indicesToLoad: IndexType[] = [],
    shared: boolean = false
): Promise<MemoryFsDat2> {
    const store = await fetchMemoryStoreDat2(
        baseUrl,
        cacheName,
        indicesToLoad,
        shared
    );
    return loadFromStore(store);
}

export function loadFromStore(store: MemoryStoreDat2): MemoryFsDat2 {
    const indices = store.indexFiles
        .map((data, id) => data && loadDat2(id, store))
        .filter((index): index is IndexDat2<MemoryStoreDat2> => !!index);
    return new BaseFileSystem(store, indices);
}

function getIndexArchiveIds(indexData: ArrayBuffer): Int32Array {
    const archiveCount = indexData.byteLength / SectorCluster.SIZE;
    const archiveIds = new Int32Array(archiveCount);
    for (let i = 0; i < archiveCount; i++) {
        archiveIds[i] = i;
    }
    return archiveIds;
}

export function loadFromStoreDat(store: MemoryStoreDat): MemoryFsDat {
    const indices = store.indexFiles
        .map((data, id) => data && loadDat(id, store, getIndexArchiveIds(data)))
        .filter((index): index is IndexDat<MemoryStoreDat> => !!index);
    return new BaseFileSystem(store, indices);
}
