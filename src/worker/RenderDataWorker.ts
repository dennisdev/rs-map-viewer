import JSZip from "jszip";
import { TransferDescriptor } from "threads";
import { registerSerializer } from "threads";
import { Transfer, expose } from "threads/worker";

import { EditorMapData } from "../mapeditor/webgl/loader/EditorMapData";
import {
    loadEditorMapData,
    loadEditorMapTerrainData,
} from "../mapeditor/webgl/loader/EditorMapDataLoader";
import { EditorMapTerrainData } from "../mapeditor/webgl/loader/EditorMapTerrainData";
import { LoadedCache } from "../mapviewer/Caches";
import { NpcSpawn } from "../mapviewer/data/npc/NpcSpawn";
import { ObjSpawn } from "../mapviewer/data/obj/ObjSpawn";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { ConfigType } from "../rs/cache/ConfigType";
import { IndexType } from "../rs/cache/IndexType";
import { CacheLoaderFactory, getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";
import { Bzip2 } from "../rs/compression/Bzip2";
import { Gzip } from "../rs/compression/Gzip";
import { BasTypeLoader } from "../rs/config/bastype/BasTypeLoader";
import { LocModelLoader } from "../rs/config/loctype/LocModelLoader";
import { LocTypeLoader } from "../rs/config/loctype/LocTypeLoader";
import { NpcModelLoader } from "../rs/config/npctype/NpcModelLoader";
import { NpcTypeLoader } from "../rs/config/npctype/NpcTypeLoader";
import { ObjModelLoader } from "../rs/config/objtype/ObjModelLoader";
import { ObjTypeLoader } from "../rs/config/objtype/ObjTypeLoader";
import { SeqTypeLoader } from "../rs/config/seqtype/SeqTypeLoader";
import { VarManager } from "../rs/config/vartype/VarManager";
import { getMapSquareId } from "../rs/map/MapFileIndex";
import { MapImageRenderer } from "../rs/map/MapImageRenderer";
import { SeqFrameLoader } from "../rs/model/seq/SeqFrameLoader";
import { SkeletalSeqLoader } from "../rs/model/skeletal/SkeletalSeqLoader";
import { Scene } from "../rs/scene/Scene";
import { LocLoadType, SceneBuilder } from "../rs/scene/SceneBuilder";
import { IndexedSprite } from "../rs/sprite/IndexedSprite";
import { SpriteLoader } from "../rs/sprite/SpriteLoader";
import { TextureLoader } from "../rs/texture/TextureLoader";
import { Hasher } from "../util/Hasher";
import { MinimapData, loadMinimapBlob } from "./MinimapData";
import { RenderDataLoader, renderDataLoaderSerializer } from "./RenderDataLoader";

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
    mapImageCache: Cache;

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

    const mapFileLoader = loaderFactory.getMapFileLoader();

    const varManager = new VarManager(varBitTypeLoader);
    const questTypeLoader = loaderFactory.getQuestTypeLoader();
    if (questTypeLoader) {
        varManager.setQuestsCompleted(questTypeLoader);
    }

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
        mapFileLoader,
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
        loaderFactory.getMapFunctions(),
    );

    const mapImageCache = await caches.open("map-images");

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
        mapImageCache,

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
    async loadEditorMapData(
        mapX: number,
        mapY: number,
    ): Promise<TransferDescriptor<EditorMapData | undefined>> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }

        return loadEditorMapData(workerState, mapX, mapY);
    },
    async loadEditorMapTerrainData(
        mapX: number,
        mapY: number,
        heightMapTextureData: Float32Array,
    ): Promise<EditorMapTerrainData | undefined> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }

        return loadEditorMapTerrainData(workerState, mapX, mapY, heightMapTextureData);
    },
    async loadTexture(
        id: number,
        size: number,
        flipH: boolean,
        brightness: number,
    ): Promise<TransferDescriptor<Int32Array>> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }

        const pixels = workerState.textureLoader.getPixelsArgb(id, size, flipH, brightness);

        return Transfer(pixels, [pixels.buffer]);
    },
    async loadMapImage(
        mapX: number,
        mapY: number,
        level: number,
        drawMapFunctions: boolean,
    ): Promise<MinimapData | undefined> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }

        const borderSize = 6;

        const baseX = mapX * Scene.MAP_SQUARE_SIZE - borderSize;
        const baseY = mapY * Scene.MAP_SQUARE_SIZE - borderSize;
        const mapSize = Scene.MAP_SQUARE_SIZE + borderSize * 2;

        const scene = workerState.sceneBuilder.buildScene(
            baseX,
            baseY,
            mapSize,
            mapSize,
            true,
            false,
            LocLoadType.NO_MODELS,
        );

        const minimapBlob = await loadMinimapBlob(
            workerState.mapImageRenderer,
            scene,
            level,
            borderSize,
            drawMapFunctions,
        );

        return {
            mapX,
            mapY,
            level,
            cacheInfo: workerState.cache.info,
            minimapBlob,
        };
    },
    async setVars(values: Int32Array): Promise<void> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }
        workerState.varManager.set(values);
    },
    async loadCachedMapImages(): Promise<Map<number, string>> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }
        const keys = await workerState.mapImageCache.keys();
        const mapImageUrls = new Map<number, string>();
        const promises: Promise<void>[] = [];
        for (const key of keys) {
            if (key.headers.get("RS-Cache-Name") !== workerState.cache.info.name) {
                continue;
            }
            promises.push(initCachedMapImage(workerState.mapImageCache, mapImageUrls, key));
        }
        await Promise.all(promises);
        return mapImageUrls;
    },
    async exportSpritesToZip(): Promise<Blob> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }

        const zip = new JSZip();

        const cacheType = workerState.cache.type;

        if (cacheType === "dat2") {
            await exportSpritesToZip(workerState.cacheSystem, zip);
        } else if (cacheType === "dat") {
            await exportDatSpritesToZip(workerState.cacheSystem, zip);
        }

        return zip.generateAsync({ type: "blob" });
    },
    async exportTexturesToZip(): Promise<Blob> {
        const workerState = await workerStatePromise;
        if (!workerState) {
            throw new Error("Worker not initialized");
        }

        const zip = new JSZip();

        const textureLoader = workerState.textureLoader;

        const textureSize = 128;

        for (const id of textureLoader.getTextureIds()) {
            try {
                const pixels = textureLoader.getPixelsArgb(id, textureSize, true, 1.0);

                const canvas = new OffscreenCanvas(textureSize, textureSize);
                const ctx = canvas.getContext("2d")!;

                const imageData = ctx.createImageData(textureSize, textureSize);

                const rgbaPixels = imageData.data;
                for (let i = 0; i < pixels.length; i++) {
                    rgbaPixels[i * 4 + 0] = (pixels[i] >> 16) & 0xff; // R
                    rgbaPixels[i * 4 + 1] = (pixels[i] >> 8) & 0xff; // G
                    rgbaPixels[i * 4 + 2] = pixels[i] & 0xff; // B
                    rgbaPixels[i * 4 + 3] = (pixels[i] >> 24) & 0xff; // A
                }

                ctx.putImageData(imageData, 0, 0);

                const dataUrl = await offscreenCanvasToPng(canvas);

                const pngData = atob(dataUrl.split(",")[1]);
                zip.file(id + ".png", pngData, { binary: true });
            } catch (e) {
                console.error("Failed to export texture", id, e);
            }
        }

        return zip.generateAsync({ type: "blob" });
    },
};

async function initCachedMapImage(
    mapImageCache: Cache,
    mapImageUrls: Map<number, string>,
    key: Request,
): Promise<void> {
    const resp = await mapImageCache.match(key);
    if (!resp) {
        return;
    }
    const fileName = key.url.slice(key.url.lastIndexOf("/") + 1);
    const split = fileName.replace(".png", "").split("_");
    if (split.length !== 2) {
        return;
    }
    const mapX = parseInt(split[0]);
    const mapY = parseInt(split[1]);

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    mapImageUrls.set(getMapSquareId(mapX, mapY), url);
}

async function offscreenCanvasToPng(canvas: OffscreenCanvas): Promise<string> {
    const blob = await canvas.convertToBlob({ type: "image/png" });

    const reader = new FileReader();

    const dataUrlPromise = new Promise<string>((resolve) => {
        reader.onload = () => {
            resolve(reader.result as string);
        };
    });

    reader.readAsDataURL(blob);

    return await dataUrlPromise;
}

async function addSpritesToZip(zip: JSZip, id: number, sprites: IndexedSprite[]) {
    if (sprites.length > 1) {
        zip = zip.folder(id.toString())!;
    }
    for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        sprite.normalize();

        const canvas = sprite.getCanvas();
        const dataUrl = await offscreenCanvasToPng(canvas);

        let fileName = id + ".png";
        if (sprites.length > 1) {
            fileName = i + ".png";
        }

        const pngData = atob(dataUrl.split(",")[1]);
        zip.file(fileName, pngData, { binary: true });
    }
}

async function exportSpritesToZip(cacheSystem: CacheSystem, zip: JSZip): Promise<void> {
    const spriteIndex = cacheSystem.getIndex(IndexType.DAT2.sprites);

    const promises: Promise<any>[] = [];

    for (const id of spriteIndex.getArchiveIds()) {
        const sprites = SpriteLoader.loadIntoIndexedSprites(spriteIndex, id);
        if (!sprites) {
            continue;
        }
        promises.push(addSpritesToZip(zip, id, sprites));
    }

    await Promise.all(promises);
}

async function exportDatSpritesToZip(cacheSystem: CacheSystem, zip: JSZip): Promise<void> {
    const configIndex = cacheSystem.getIndex(IndexType.DAT.configs);
    const mediaArchive = configIndex.getArchive(ConfigType.DAT.media);

    const indexDatId = mediaArchive.getFileId("index.dat");

    const promises: Promise<any>[] = [];

    for (let i = 0; i < mediaArchive.fileIds.length; i++) {
        const fileId = mediaArchive.fileIds[i];
        if (fileId === indexDatId) {
            continue;
        }

        const sprites: IndexedSprite[] = [];
        for (let i = 0; i < 256; i++) {
            try {
                const sprite = SpriteLoader.loadIndexedSpriteDatId(mediaArchive, fileId, i);
                sprites.push(sprite);
            } catch (e) {
                break;
            }
        }
        promises.push(addSpritesToZip(zip, fileId, sprites));
    }

    await Promise.all(promises);
}

export type RenderDataWorker = typeof worker;

expose(worker);
