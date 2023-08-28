import { expose, Transfer } from "threads/worker";
import { TransferDescriptor } from "threads";
import { Bzip2 } from "../../rs/compression/Bzip2";
import { Gzip } from "../../rs/compression/Gzip";
import { LoadedCache } from "../Caches";
import { CacheSystem } from "../../rs/cache/CacheSystem";
import { RenderDataLoader, renderDataLoaderSerializer } from "./RenderDataLoader";
import { registerSerializer } from "threads";
import {
    CacheLoaderFactory,
    getCacheLoaderFactory,
} from "../../rs/cache/loader/CacheLoaderFactory";
import { LocModelLoader } from "../../rs/config/loctype/LocModelLoader";
import { LandscapeLoadType, SceneBuilder } from "../../rs/scene/SceneBuilder";
import { TextureLoader } from "../../rs/texture/TextureLoader";
import { MapImageRenderer } from "../../rs/map/MapImageRenderer";
import { loadMinimapBlob, MinimapData } from "../data/MinimapData";
import { Scene } from "../../rs/scene/Scene";
import { VarManager } from "../../rs/config/vartype/VarManager";
import { Hasher } from "../../util/Hasher";
import { ObjModelLoader } from "../../rs/config/objtype/ObjModelLoader";
import { LocTypeLoader } from "../../rs/config/loctype/LocTypeLoader";
import { ObjTypeLoader } from "../../rs/config/objtype/ObjTypeLoader";
import { SeqTypeLoader } from "../../rs/config/seqtype/SeqTypeLoader";
import { ObjSpawn } from "../data/obj/ObjSpawn";
import { NpcSpawn } from "../data/npc/NpcSpawn";
import { NpcModelLoader } from "../../rs/config/npctype/NpcModelLoader";
import { SeqFrameLoader } from "../../rs/model/seq/SeqFrameLoader";
import { BasTypeLoader } from "../../rs/config/bastype/BasTypeLoader";
import { NpcTypeLoader } from "../../rs/config/npctype/NpcTypeLoader";
import { SkeletalSeqLoader } from "../../rs/model/skeletal/SkeletalSeqLoader";

registerSerializer(renderDataLoaderSerializer);

const compressionPromise = Promise.all([Bzip2.initWasm(), Gzip.initWasm()]);
const hasherPromise = Hasher.init();

export type WorkerState = {
    cache: LoadedCache;
    cacheSystem: CacheSystem;
    cacheLoaderFactory: CacheLoaderFactory;

    locTypeLoader: LocTypeLoader;
    objTypeLoader: ObjTypeLoader;
    npcTypeLoader: NpcTypeLoader;

    seqTypeLoader: SeqTypeLoader;
    basTypeLoader: BasTypeLoader;

    textureLoader: TextureLoader;
    seqFrameLoader: SeqFrameLoader;
    skeletalSeqLoader: SkeletalSeqLoader | undefined;

    locModelLoader: LocModelLoader;
    objModelLoader: ObjModelLoader;
    npcModelLoader: NpcModelLoader;

    sceneBuilder: SceneBuilder;

    varManager: VarManager;
    mapImageRenderer: MapImageRenderer;

    objSpawns: ObjSpawn[];
    npcSpawns: NpcSpawn[];
};

let workerStatePromise: Promise<WorkerState> | undefined;

async function initWorker(
    cache: LoadedCache,
    objSpawns: ObjSpawn[],
    npcSpawns: NpcSpawn[],
): Promise<WorkerState> {
    await compressionPromise;
    await hasherPromise;
    const cacheSystem = CacheSystem.fromFiles(cache.type, cache.files);

    const loaderFactory = getCacheLoaderFactory(cache.info, cacheSystem);
    const underlayTypeLoader = loaderFactory.getUnderlayTypeLoader();
    const overlayTypeLoader = loaderFactory.getOverlayTypeLoader();

    const varBitTypeLoader = loaderFactory.getVarBitTypeLoader();

    const locTypeLoader = loaderFactory.getLocTypeLoader();
    const objTypeLoader = loaderFactory.getObjTypeLoader();
    const npcTypeLoader = loaderFactory.getNpcTypeLoader();

    const basTypeLoader = loaderFactory.getBasTypeLoader();

    const modelLoader = loaderFactory.getModelLoader();
    const textureLoader = loaderFactory.getTextureLoader();

    const seqTypeLoader = loaderFactory.getSeqTypeLoader();
    const seqFrameLoader = loaderFactory.getSeqFrameLoader();
    const skeletalSeqLoader = loaderFactory.getSkeletalSeqLoader();

    const mapFileIndex = loaderFactory.getMapFileIndex();
    const mapIndex = loaderFactory.getMapIndex();

    const varManager = new VarManager(varBitTypeLoader);

    const locModelLoader = new LocModelLoader(
        locTypeLoader,
        modelLoader,
        textureLoader,
        seqTypeLoader,
        seqFrameLoader,
        skeletalSeqLoader,
    );

    const objModelLoader = new ObjModelLoader(objTypeLoader, modelLoader, textureLoader);

    const npcModelLoader = new NpcModelLoader(
        npcTypeLoader,
        modelLoader,
        textureLoader,
        seqTypeLoader,
        seqFrameLoader,
        skeletalSeqLoader,
        varManager,
    );

    const sceneBuilder = new SceneBuilder(
        cache.info,
        mapFileIndex,
        mapIndex,
        underlayTypeLoader,
        overlayTypeLoader,
        locTypeLoader,
        locModelLoader,
        cache.xteas,
    );

    const mapImageRenderer = new MapImageRenderer(
        textureLoader,
        locTypeLoader,
        loaderFactory.getMapScenes(),
    );

    return {
        cache,
        cacheSystem,
        cacheLoaderFactory: loaderFactory,

        locTypeLoader,
        objTypeLoader,
        npcTypeLoader,

        seqTypeLoader,
        basTypeLoader,

        textureLoader,
        seqFrameLoader,
        skeletalSeqLoader,

        locModelLoader,
        objModelLoader,
        npcModelLoader,

        sceneBuilder,

        varManager,
        mapImageRenderer,

        objSpawns,
        npcSpawns,
    };
}

function clearCache(workerState: WorkerState): void {
    workerState.locModelLoader.clearCache();
    workerState.objModelLoader.clearCache();
    workerState.npcModelLoader.clearCache();
    workerState.seqFrameLoader.clearCache();
    workerState.skeletalSeqLoader?.clearCache();
}

const worker = {
    initCache(cache: LoadedCache, objSpawns: ObjSpawn[], npcSpawns: NpcSpawn[]) {
        console.log("init worker", cache.info);
        workerStatePromise = initWorker(cache, objSpawns, npcSpawns);
    },
    initDataLoader<I, D>(dataLoader: RenderDataLoader<I, D>) {
        dataLoader.init();
    },
    resetDataLoader<I, D>(dataLoader: RenderDataLoader<I, D>) {
        dataLoader.reset();
    },
    async load<I, D>(
        dataLoader: RenderDataLoader<I, D>,
        input: I,
    ): Promise<TransferDescriptor<D> | undefined> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }

        const { data, transferables } = await dataLoader.load(workerState, input);

        clearCache(workerState);

        if (!data) {
            return undefined;
        }
        return Transfer<D>(data, transferables);
    },
    async loadMinimap(mapX: number, mapY: number, level: number): Promise<MinimapData | undefined> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }

        const borderSize = 5;

        const baseX = mapX * Scene.MAP_SQUARE_SIZE - borderSize;
        const baseY = mapY * Scene.MAP_SQUARE_SIZE - borderSize;
        const mapSize = Scene.MAP_SQUARE_SIZE + borderSize * 2;

        const scene = workerState.sceneBuilder.buildScene(
            baseX,
            baseY,
            mapSize,
            mapSize,
            LandscapeLoadType.NO_MODELS,
            false,
        );

        const minimapBlob = await loadMinimapBlob(
            workerState.mapImageRenderer,
            scene,
            level,
            borderSize,
        );

        return {
            mapX,
            mapY,
            level,
            cacheInfo: workerState.cache.info,
            minimapBlob,
        };
    },
};

export type RenderDataWorker = typeof worker;

expose(worker);
