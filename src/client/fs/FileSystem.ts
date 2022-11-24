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
        if (typeof(dataFile) === 'undefined') {
            reject("main_file_cache.dat2 file not found");
            return;
        }
        const metaFile = filesArr.find(file => file.name.endsWith('.idx255'));
        if (typeof(metaFile) === 'undefined') {
            reject('main_file_cache.idx255 file not found');
            return;
        }
        const indexCount = metaFile.size / SectorCluster.SIZE;
        const indexFiles = new Array<{id: number, file: File}>(indexCount);

        for (let idx = 0; idx < indexCount; idx++) {
            if (indicesToLoad && indicesToLoad.indexOf(idx) < 0) {
                continue;
            }
            const indexFile = filesArr.find(file => file.name.endsWith('.idx' + idx));
            if (typeof(indexFile) === 'undefined') {
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
};

type ProgressListener = (progress: DownloadProgress) => void;

async function toArrayBuffer(response: Response, shared: boolean, progressListener?: ProgressListener) {
    if (!response.body) {
        return new ArrayBuffer(0);
    }
    const contentLength = Number(response.headers.get('Content-Length') || 0);

    if (progressListener) {
        progressListener({total: contentLength, current: 0});
    }

    const reader = response.body.getReader();
    const parts = [];
    let currentLength = 0;
    for (let res = await reader.read(); !res.done && res.value; res = await reader.read()) {
        parts.push(res.value);
        currentLength += res.value.byteLength;
        if (progressListener) {
            progressListener({total: contentLength, current: currentLength});
        }
    }
    const sab = shared ? new SharedArrayBuffer(currentLength) : new ArrayBuffer(currentLength);
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

async function fetchCacheFile(input: RequestInfo): Promise<Response> {
    const cache = await caches.open('cache-files');
    let resp = await cache.match(input);
    if (resp) {
        return resp;
    }
    resp = await fetch(input);
    cache.put(input, resp.clone());
    return resp;
}

async function fetchCacheIndex(baseUrl: string, id: IndexType, shared: boolean): Promise<CacheIndexFile> {
    const resp = await fetchCacheFile(baseUrl + 'main_file_cache.idx' + id);
    const data = await toArrayBuffer(resp, shared);
    return {id, data};
}

export async function fetchMemoryStore(baseUrl: string, indicesToLoad: IndexType[] = [], shared: boolean = false, progressListener?: ProgressListener): Promise<MemoryStore> {
    console.time('fetch');
    const [dataFile, metaFile] = await Promise.all([
        fetchCacheFile(baseUrl + 'main_file_cache.dat2').then(resp => toArrayBuffer(resp, shared, progressListener)),
        fetchCacheFile(baseUrl + 'main_file_cache.idx255').then(resp => toArrayBuffer(resp, shared))
    ]);

    const indexCount = metaFile.byteLength / SectorCluster.SIZE;
    const allIndexIds = Array.from(Array(indexCount).keys());

    if (!indicesToLoad.length) {
        indicesToLoad = allIndexIds;
    }

    const indexFilePromises = indicesToLoad.map(id => fetchCacheIndex(baseUrl, id, shared));

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
