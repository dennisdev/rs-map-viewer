import {
    spawn,
    Pool,
    Worker,
    Transfer,
    TransferDescriptor,
    ModuleThread,
} from "threads";
import { MemoryStore } from "../../client/fs/MemoryStore";
import { LoadedCache } from "../CacheInfo";
import { NpcSpawn } from "../npc/NpcSpawn";
import { ChunkData } from "./ChunkDataLoader";

export type ChunkLoaderWorker = {
    init(cache: LoadedCache, npcSpawns: NpcSpawn[]): void;

    load(
        regionX: number,
        regionY: number,
        minimizeDrawCalls: boolean,
        loadNpcs: boolean,
        maxPlane: number
    ): ChunkData | undefined;
};

export class ChunkLoaderWorkerPool {
    pool: Pool<ModuleThread<ChunkLoaderWorker>>;

    workerPromises: Promise<ModuleThread<ChunkLoaderWorker>>[];

    size: number;

    static init(size: number): ChunkLoaderWorkerPool {
        const workerPromises: Promise<ModuleThread<ChunkLoaderWorker>>[] = [];
        const pool = Pool(() => {
            const worker = new Worker(
                new URL("./ChunkLoaderWorker", import.meta.url) as any
            );
            // console.log('post init worker', performance.now());
            const workerPromise = spawn<ChunkLoaderWorker>(worker);
            workerPromises.push(workerPromise);
            return workerPromise;
        }, size);
        return new ChunkLoaderWorkerPool(pool, workerPromises, size);
    }

    constructor(
        pool: Pool<ModuleThread<ChunkLoaderWorker>>,
        workerPromises: Promise<ModuleThread<ChunkLoaderWorker>>[],
        size: number
    ) {
        this.pool = pool;
        this.workerPromises = workerPromises;
        this.size = size;
    }

    init(cache: LoadedCache, npcSpawns: NpcSpawn[]) {
        for (const promise of this.workerPromises) {
            promise.then((worker) => {
                // console.log('send init worker', performance.now());
                worker.init(cache, npcSpawns);
                return worker;
            });
        }
    }
}
