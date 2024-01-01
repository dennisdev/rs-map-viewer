import { ModuleThread, Pool, spawn } from "threads";
import { QueuedTask } from "threads/dist/master/pool";
import { WorkerDescriptor } from "threads/dist/master/pool-types";
import { ObservablePromise } from "threads/dist/observable-promise";

import { EditorMapData } from "../mapeditor/webgl/loader/EditorMapData";
import { LoadedCache } from "../mapviewer/Caches";
import { NpcSpawn } from "../mapviewer/data/npc/NpcSpawn";
import { ObjSpawn } from "../mapviewer/data/obj/ObjSpawn";
import { MinimapData } from "./MinimapData";
import { RenderDataLoader } from "./RenderDataLoader";
import { RenderDataWorker } from "./RenderDataWorker";

type RenderDataWorkerThread = ModuleThread<RenderDataWorker>;

function spawnWorker(): Promise<RenderDataWorkerThread> {
    const worker = new Worker(new URL("./RenderDataWorker", import.meta.url));
    return spawn<RenderDataWorker>(worker);
}

export class RenderDataWorkerPool {
    static create(size: number): RenderDataWorkerPool {
        const pool = Pool(() => spawnWorker(), size);
        const workers = pool["workers"] as WorkerDescriptor<RenderDataWorkerThread>[];
        return new RenderDataWorkerPool(pool, workers, size);
    }

    constructor(
        readonly pool: Pool<RenderDataWorkerThread>,
        readonly workers: WorkerDescriptor<RenderDataWorkerThread>[],
        readonly size: number,
    ) {}

    initCache(cache: LoadedCache, objSpawns: ObjSpawn[], npcSpawns: NpcSpawn[]): void {
        for (const worker of this.workers) {
            worker.init.then((w) => w.initCache(cache, objSpawns, npcSpawns));
        }
    }

    async runAll(task: (w: RenderDataWorkerThread) => any): Promise<void> {
        await Promise.all(this.workers.map((desc) => desc.init.then(task)));
    }

    initLoader(loader: RenderDataLoader<any, any>): Promise<void> {
        return this.runAll((w) => w.initDataLoader(loader));
    }

    resetLoader(loader: RenderDataLoader<any, any>): Promise<void> {
        return this.runAll((w) => w.resetDataLoader(loader));
    }

    queueLoad<I, D, Loader extends RenderDataLoader<I, D>>(
        loader: Loader,
        input: I,
    ): QueuedTask<RenderDataWorkerThread, D> {
        return this.pool.queue((w) => w.load(loader, input) as ObservablePromise<D>);
    }

    queueLoadEditorMapData(
        mapX: number,
        mapY: number,
    ): QueuedTask<RenderDataWorkerThread, EditorMapData | undefined> {
        return this.pool.queue(
            (w) => w.loadEditorMapData(mapX, mapY) as ObservablePromise<EditorMapData | undefined>,
        );
    }

    queueLoadTexture(
        id: number,
        size: number,
        flipH: boolean,
        brightness: number,
    ): QueuedTask<RenderDataWorkerThread, Int32Array> {
        return this.pool.queue(
            (w) => w.loadTexture(id, size, flipH, brightness) as ObservablePromise<Int32Array>,
        );
    }

    queueMapImage(
        mapX: number,
        mapY: number,
        level: number,
        drawMapFunctions: boolean,
    ): QueuedTask<RenderDataWorkerThread, MinimapData | undefined> {
        return this.pool.queue((w) => w.loadMapImage(mapX, mapY, level, drawMapFunctions));
    }

    loadCachedMapImages(): QueuedTask<RenderDataWorkerThread, Map<number, string>> {
        return this.pool.queue((w) => w.loadCachedMapImages());
    }

    exportSprites(): QueuedTask<RenderDataWorkerThread, Blob> {
        return this.pool.queue((w) => w.exportSpritesToZip());
    }

    exportTextures(): QueuedTask<RenderDataWorkerThread, Blob> {
        return this.pool.queue((w) => w.exportTexturesToZip());
    }

    terminate(): Promise<void> {
        console.log("Terminating worker pool");
        return this.pool.terminate();
    }
}
