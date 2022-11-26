import { FileStore } from "./FileStore";
import { SectorCluster } from "./SectorCluster";
import { Index, IndexAsync, IndexSync, load, loadSync } from "./Index";
import { Store, StoreAsync, StoreSync } from "./Store";
import { MemoryStore } from "./MemoryStore";
import { IndexType } from "./IndexType";

export class FileSystem<T, S extends Store<T>, I extends Index<T, S>> {
    protected readonly indexMap: Map<IndexType, I> = new Map();

    constructor(
        public readonly store: S,
        indices: I[]
    ) {
        indices.forEach(index => {
            this.indexMap.set(index.id, index);
        });
    }

    indexExists(indexId: IndexType): boolean {
        return this.indexMap.has(indexId);
    }

    getIndex(id: IndexType): I {
        const index = this.indexMap.get(id);
        if (!index) {
            throw new Error('Failed to load ' + IndexType[id] + ' index');
        }
        return index;
    }

    get indices(): I[] {
        return Array.from(this.indexMap.values());
    }
}

// export class FileSystemAsync<S extends StoreAsync, I extends IndexAsync<S>> extends FileSystem<Promise<Int8Array>, S, I> {
//     constructor(
//         store: S,
//         indices: I[]
//     ) {
//         super(store, indices);
//     }
// }

// export class FileSystemSync<S extends StoreSync, I extends IndexSync<S>> extends FileSystem<Int8Array, S, I> {
//     constructor(
//         store: S,
//         indices: I[]
//     ) {
//         super(store, indices);
//     }
// }

export type FileSystemAsync<S extends StoreAsync> = FileSystem<Promise<Int8Array>, S, IndexAsync<S>>;

export type FileSystemSync<S extends StoreSync> = FileSystem<Int8Array, S, IndexSync<S>>;

export type FileFileSystem = FileSystemAsync<FileStore>;

export type MemoryFileSystem = FileSystemSync<MemoryStore>;

// TODO: turn into async function
export function open(files: FileList, indicesToLoad?: number[]): Promise<FileFileSystem> {
    return new Promise<FileFileSystem>((resolve, reject) => {
        const filesArr: File[] = Array.from(files);
        const dataFile = filesArr.find(file => file.name.endsWith('.dat2'));
        if (typeof (dataFile) === 'undefined') {
            reject("main_file_cache.dat2 file not found");
            return;
        }
        const metaFile = filesArr.find(file => file.name.endsWith('.idx255'));
        if (typeof (metaFile) === 'undefined') {
            reject('main_file_cache.idx255 file not found');
            return;
        }
        const indexCount = metaFile.size / SectorCluster.SIZE;
        const indexFiles = new Array<{ id: number, file: File }>(indexCount);

        for (let idx = 0; idx < indexCount; idx++) {
            if (indicesToLoad && indicesToLoad.indexOf(idx) < 0) {
                continue;
            }
            const indexFile = filesArr.find(file => file.name.endsWith('.idx' + idx));
            if (typeof (indexFile) === 'undefined') {
                reject(`main_file_cache.idx${idx} file not found`);
                return;
            }
            indexFiles[idx] = {
                id: idx,
                file: indexFile
            };
        }
        const fileStore = new FileStore(dataFile, indexFiles.map(indexFile => indexFile.file), metaFile);
        const indexPromises = indexFiles.map(indexFile => load(indexFile.id, fileStore));
        Promise.all(indexPromises).then(indices => {
            resolve(new FileSystem(fileStore, indices));
        }).catch(reject);
    });
}

export type DownloadProgress = {
    total: number,
    current: number,
    part: Uint8Array
};

type ProgressListener = (progress: DownloadProgress) => void;

function ReadableBufferStream(ab: ArrayBuffer): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(new Uint8Array(ab));
            controller.close();
        }
    });
}

async function toBufferParts(response: Response, offset: number, progressListener?: ProgressListener): Promise<Uint8Array[]> {
    if (!response.body) {
        return [];
    }
    const contentLength = offset + Number(response.headers.get('Content-Length') || 0);


    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let currentLength = offset;

    if (progressListener) {
        progressListener({ total: contentLength, current: currentLength, part: new Uint8Array(0) });
    }

    for (let res = await reader.read(); !res.done && res.value; res = await reader.read()) {
        parts.push(res.value);
        currentLength += res.value.byteLength;
        if (progressListener) {
            progressListener({ total: contentLength, current: currentLength, part: res.value });
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

type CacheIndexFile = {
    id: IndexType,
    data: ArrayBuffer
}

async function fetchCacheFile(cache: Cache, input: RequestInfo, shared: boolean, incremental: boolean, progressListener?: ProgressListener): Promise<ArrayBuffer> {
    const cachedResp = await cache.match(input);
    if (cachedResp) {
        const parts = await toBufferParts(cachedResp, 0, progressListener);
        return partsToBuffer(parts, shared);
    }
    const partUrls: RequestInfo[] = [];
    const partBuffers: Uint8Array[][] = [];
    if (incremental) {
        const partResponses = await cache.matchAll(input + '/part/', { ignoreSearch: true });
        for (const partResp of partResponses) {
            const index = parseInt(partResp.headers.get('Cache-Part') || '0');
            partUrls.push(input + '/part/?p=' + index);
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
        headers['Range'] = `bytes=${offset}-${Number.MAX_SAFE_INTEGER}`;
    }

    const resp = await fetch(input, {
        headers
    });
    if (resp.status !== 200 && resp.status !== 206) {
        throw new Error('Failed downloading ' + input + ', ' + resp.status);
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
                const partUrl = input + '/part/?p=' + partCount;
                partUrls.push(partUrl);
                const partResp = new Response(ReadableBufferStream(partsToBuffer(partCache, false)), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Content-Length': partCacheLength.toString(),
                        'Cache-Part': partCount.toString()
                    }
                });
                Object.defineProperty(partResp, 'url', { value: partUrl });
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

    cache.put(input, new Response(ReadableBufferStream(buffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': buffer.byteLength.toString()
        }
    }));

    if (incremental) {
        await Promise.all(cacheUpdates);
        for (const url of partUrls) {
            cache.delete(url);
        }
    }

    return buffer;
}

async function fetchCacheIndex(cache: Cache, baseUrl: string, id: IndexType, shared: boolean, incremental: boolean): Promise<CacheIndexFile> {
    const data = await fetchCacheFile(cache, baseUrl + 'main_file_cache.idx' + id, shared, incremental);
    return { id, data };
}

export async function fetchMemoryStore(baseUrl: string, indicesToLoad: IndexType[] = [], shared: boolean = false, progressListener?: ProgressListener): Promise<MemoryStore> {
    console.time('fetch');
    const cache = await caches.open('cache-files');
    const [dataFile, metaFile] = await Promise.all([
        fetchCacheFile(cache, baseUrl + 'main_file_cache.dat2', shared, true, progressListener),
        fetchCacheFile(cache, baseUrl + 'main_file_cache.idx255', shared, false)
    ]);

    const indexCount = metaFile.byteLength / SectorCluster.SIZE;
    const allIndexIds = Array.from(Array(indexCount).keys());

    if (!indicesToLoad.length) {
        indicesToLoad = allIndexIds;
    }

    const indexFilePromises = indicesToLoad.map(id => fetchCacheIndex(cache, baseUrl, id, shared, false));

    const indexFiles = await Promise.all(indexFilePromises);
    console.timeEnd('fetch');
    const indexFileDatas = allIndexIds
        .map(id => indexFiles.find(file => file.id === id))
        .map(file => file && file.data);
    return new MemoryStore(dataFile, indexFileDatas, metaFile);
}

export async function openFromUrl(baseUrl: string, indicesToLoad: IndexType[] = [], shared: boolean = false): Promise<MemoryFileSystem> {
    const store = await fetchMemoryStore(baseUrl, indicesToLoad, shared);
    return loadFromStore(store);
}

export function loadFromStore(store: MemoryStore): MemoryFileSystem {
    console.time('load fs');
    const indices = store.indexFiles
        .map((data, id) => data && loadSync(id, store))
        .filter((index): index is IndexSync<MemoryStore> => !!index);
    console.timeEnd('load fs');
    return new FileSystem(store, indices);
}
