import { expose, Transfer } from "threads/worker";
import { ConfigType } from "../../client/fs/ConfigType";
import { loadFromStore } from "../../client/fs/FileSystem";
import { IndexType } from "../../client/fs/IndexType";
import { CachedObjectLoader } from "../../client/fs/loader/ObjectLoader";
import { CachedOverlayLoader } from "../../client/fs/loader/OverlayLoader";
import { CachedUnderlayLoader } from "../../client/fs/loader/UnderlayLoader";
import { MemoryStore } from "../../client/fs/MemoryStore";
import { RegionLoader } from "../../client/RegionLoader";
import { TextureLoader } from "../../client/fs/loader/TextureLoader";
import { Compression } from "../../client/util/Compression";
import { ChunkDataLoader } from "./ChunkDataLoader";
import { IndexModelLoader } from "../../client/fs/loader/ModelLoader";
import { Hasher } from "../../client/util/Hasher";
import { CachedAnimationLoader } from "../../client/fs/loader/AnimationLoader";
import { CachedSkeletonLoader } from "../../client/fs/loader/SkeletonLoader";
import { CachedAnimationFrameMapLoader } from "../../client/fs/loader/AnimationFrameMapLoader";
import { ObjectModelLoader } from "../../client/scene/ObjectModelLoader";
import { CachedVarbitLoader } from "../../client/fs/loader/VarbitLoader";
import { VarpManager } from "../../client/VarpManager";
import { NpcModelLoader } from "../../client/scene/NpcModelLoader";
import { CachedNpcLoader } from "../../client/fs/loader/NpcLoader";

type MemoryStoreProperties = {
    dataFile: ArrayBuffer,
    indexFiles: (ArrayBuffer | undefined)[],
    metaFile: ArrayBuffer
};

let chunkDataLoaderPromise: Promise<ChunkDataLoader> | undefined;

const wasmCompressionPromise = Compression.initWasm();
const hasherPromise = Hasher.init();

const npcListPromise = fetch('/NPCList_OSRS-min.json').then(resp => resp.json());

async function init0(memoryStoreProperties: MemoryStoreProperties, xteasMap: Map<number, number[]>) {
    // console.log('start init worker');
    await wasmCompressionPromise;
    const store = new MemoryStore(memoryStoreProperties.dataFile, memoryStoreProperties.indexFiles, memoryStoreProperties.metaFile);

    const fileSystem = loadFromStore(store);

    const frameMapIndex = fileSystem.getIndex(IndexType.ANIMATIONS);
    const skeletonIndex = fileSystem.getIndex(IndexType.SKELETONS);
    const configIndex = fileSystem.getIndex(IndexType.CONFIGS);
    const mapIndex = fileSystem.getIndex(IndexType.MAPS);
    const spriteIndex = fileSystem.getIndex(IndexType.SPRITES);
    const textureIndex = fileSystem.getIndex(IndexType.TEXTURES);
    const modelIndex = fileSystem.getIndex(IndexType.MODELS);


    // console.time('load config archives');
    const underlayArchive = configIndex.getArchive(ConfigType.UNDERLAY);
    const overlayArchive = configIndex.getArchive(ConfigType.OVERLAY);
    const objectArchive = configIndex.getArchive(ConfigType.OBJECT);
    const npcArchive = configIndex.getArchive(ConfigType.NPC);
    // console.timeEnd('load config archives');

    const animationArchive = configIndex.getArchive(ConfigType.SEQUENCE);

    const varbitArchive = configIndex.getArchive(ConfigType.VARBIT);

    const underlayLoader = new CachedUnderlayLoader(underlayArchive);
    const overlayLoader = new CachedOverlayLoader(overlayArchive);
    const objectLoader = new CachedObjectLoader(objectArchive);
    const npcLoader = new CachedNpcLoader(npcArchive);

    const animationLoader = new CachedAnimationLoader(animationArchive);

    const varbitLoader = new CachedVarbitLoader(varbitArchive);

    const skeletonLoader = new CachedSkeletonLoader(skeletonIndex);
    const frameMapLoader = new CachedAnimationFrameMapLoader(frameMapIndex, skeletonLoader);

    const varpManager = new VarpManager(varbitLoader);

    const modelLoader = new IndexModelLoader(modelIndex);

    const objectModelLoader = new ObjectModelLoader(modelLoader, animationLoader, frameMapLoader);
    const npcModelLoader = new NpcModelLoader(varpManager, modelLoader, animationLoader, frameMapLoader, npcLoader);

    const regionLoader = new RegionLoader(mapIndex, underlayLoader, overlayLoader, objectLoader, objectModelLoader, xteasMap);


    // console.time('load textures');
    const textureProvider = TextureLoader.load(textureIndex, spriteIndex);
    // console.timeEnd('load textures');
    // console.time('load textures sprites');
    // for (const texture of textureProvider.definitions.values()) {
    //     textureProvider.loadFromDef(texture, 1.0, 128);
    // }
    // console.timeEnd('load textures sprites');

    const npcList: any[] = await npcListPromise;

    console.log('init worker', fileSystem, performance.now());
    return new ChunkDataLoader(regionLoader, objectModelLoader, npcModelLoader, textureProvider, npcList);
}

// console.log('start worker', performance.now());

// self.onmessage = (event) => {
//     console.log('on msg', event, performance.now());
// }

expose({
    init(memoryStoreProperties: MemoryStoreProperties, xteasMap: Map<number, number[]>) {
        chunkDataLoaderPromise = init0(memoryStoreProperties, xteasMap);
    },
    async load(regionX: number, regionY: number, minimizeDrawCalls: boolean, loadNpcs: boolean) {
        // console.log('request', regionX, regionY);
        if (!chunkDataLoaderPromise) {
            throw new Error('ChunkDataLoaderWorker has not been initialized yet');
        }
        const chunkDataLoader = await chunkDataLoaderPromise;
        await hasherPromise;

        console.time(`load chunk ${regionX}_${regionY}`);
        const chunkData = chunkDataLoader.load(regionX, regionY, minimizeDrawCalls, loadNpcs);
        console.timeEnd(`load chunk ${regionX}_${regionY}`);
        console.log('model caches: ', chunkDataLoader.objectModelLoader.modelDataCache.size, chunkDataLoader.objectModelLoader.modelCache.size)

        chunkDataLoader.regionLoader.regions.clear();
        chunkDataLoader.regionLoader.blendedUnderlayColors.clear();
        chunkDataLoader.regionLoader.objectLightOcclusionMap.clear();
        chunkDataLoader.regionLoader.objectLightOcclusionMapLoaded.clear();
        chunkDataLoader.regionLoader.lightLevels.clear();

        chunkDataLoader.objectModelLoader.modelDataCache.clear();
        chunkDataLoader.objectModelLoader.modelCache.clear();

        if (chunkData) {
            const transferables: Transferable[] = [
                chunkData.vertices.buffer,
                chunkData.indices.buffer,
                chunkData.modelTextureData.buffer,
                chunkData.heightMapTextureData.buffer
            ];
            return Transfer(chunkData, transferables);
        }

        return undefined;
    }
});
