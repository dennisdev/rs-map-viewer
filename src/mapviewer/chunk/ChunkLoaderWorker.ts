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
import { IndexModelLoader } from "../../client/fs/loader/model/ModelLoader";
import { Hasher } from "../util/Hasher";
import { CachedAnimationLoader } from "../../client/fs/loader/AnimationLoader";
import { CachedSkeletonLoader } from "../../client/fs/loader/SkeletonLoader";
import { CachedAnimationFrameMapLoader } from "../../client/fs/loader/AnimationFrameMapLoader";
import { ObjectModelLoader } from "../../client/fs/loader/model/ObjectModelLoader";
import { CachedVarbitLoader } from "../../client/fs/loader/VarbitLoader";
import { VarpManager } from "../../client/VarpManager";
import { NpcModelLoader } from "../../client/fs/loader/model/NpcModelLoader";
import { CachedNpcLoader } from "../../client/fs/loader/NpcLoader";
import { NpcSpawn } from "../npc/NpcSpawn";
import { LoadedCache } from "../CacheInfo";
import { ItemModelLoader } from "../../client/fs/loader/model/ItemModelLoader";
import { CachedItemLoader } from "../../client/fs/loader/ItemLoader";
import { ItemSpawn } from "../item/ItemSpawn";
import { MapImageLoader } from "../../client/scene/MapImageLoader";
import { GraphicDefaults } from "../../client/fs/definition/GraphicDefaults";
import { SpriteLoader } from "../../client/sprite/SpriteLoader";
import { TransferDescriptor } from "threads";
import { ChunkData } from "./ChunkData";
import { MinimapData } from "./MinimapData";

let chunkDataLoaderPromise: Promise<ChunkDataLoader> | undefined;

const wasmCompressionPromise = Compression.initWasm();
const hasherPromise = Hasher.init();

async function init0(
    cache: LoadedCache,
    npcSpawns: NpcSpawn[],
    itemSpawns: ItemSpawn[]
) {
    await wasmCompressionPromise;

    // Create new store because it is a structured clone
    const store = new MemoryStore(
        cache.store.dataFile,
        cache.store.indexFiles,
        cache.store.metaFile
    );

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
    const itemArchive = configIndex.getArchive(ConfigType.ITEM);
    // console.timeEnd('load config archives');

    const animationArchive = configIndex.getArchive(ConfigType.SEQUENCE);

    const varbitArchive = configIndex.getArchive(ConfigType.VARBIT);

    const underlayLoader = new CachedUnderlayLoader(
        underlayArchive,
        cache.info
    );
    const overlayLoader = new CachedOverlayLoader(overlayArchive, cache.info);
    const objectLoader = new CachedObjectLoader(objectArchive, cache.info);
    const npcLoader = new CachedNpcLoader(npcArchive, cache.info);
    const itemLoader = new CachedItemLoader(itemArchive, cache.info);

    const animationLoader = new CachedAnimationLoader(
        animationArchive,
        cache.info
    );

    const varbitLoader = new CachedVarbitLoader(varbitArchive, cache.info);

    const skeletonLoader = new CachedSkeletonLoader(skeletonIndex);
    const frameMapLoader = new CachedAnimationFrameMapLoader(
        frameMapIndex,
        skeletonLoader
    );

    const varpManager = new VarpManager(varbitLoader);

    const modelLoader = new IndexModelLoader(modelIndex);

    const objectModelLoader = new ObjectModelLoader(
        objectLoader,
        modelLoader,
        animationLoader,
        frameMapLoader
    );
    const npcModelLoader = new NpcModelLoader(
        varpManager,
        modelLoader,
        animationLoader,
        frameMapLoader,
        npcLoader
    );
    const itemModelLoader = new ItemModelLoader(modelLoader, itemLoader);

    const regionLoader = new RegionLoader(
        cache.info,
        mapIndex,
        underlayLoader,
        overlayLoader,
        objectLoader,
        objectModelLoader,
        cache.xteas,
        varpManager
    );

    // console.time('load textures');
    const textureProvider = TextureLoader.load(
        textureIndex,
        spriteIndex,
        cache.info
    );

    const graphicDefaults = GraphicDefaults.load(fileSystem, cache.info);
    const mapScenes = SpriteLoader.loadIntoIndexedSprites(
        spriteIndex,
        graphicDefaults.mapScenes
    );
    if (!mapScenes) {
        throw new Error("Failed to load map scenes");
    }

    const mapImageLoader = new MapImageLoader(objectLoader, mapScenes);

    // console.timeEnd('load textures');
    // console.time('load textures sprites');
    // for (const texture of textureProvider.definitions.values()) {
    //     textureProvider.loadFromDef(texture, 1.0, 128);
    // }
    // console.timeEnd('load textures sprites');

    console.log("init worker", performance.now());
    return new ChunkDataLoader(
        cache.info,
        regionLoader,
        objectModelLoader,
        npcModelLoader,
        itemModelLoader,
        textureProvider,
        mapImageLoader,
        npcSpawns,
        itemSpawns
    );
}

// console.log('start worker', performance.now());

// self.onmessage = (event) => {
//     console.log('on msg', event, performance.now());
// }

function clearCache(chunkDataLoader: ChunkDataLoader) {
    chunkDataLoader.regionLoader.regions.clear();

    chunkDataLoader.objectModelLoader.modelDataCache.clear();
    chunkDataLoader.objectModelLoader.modelCache.clear();

    chunkDataLoader.npcModelLoader.modelCache.clear();

    chunkDataLoader.itemModelLoader.modelCache.clear();
}

expose({
    init(cache: LoadedCache, npcSpawns: NpcSpawn[], itemSpawns: ItemSpawn[]) {
        chunkDataLoaderPromise = init0(cache, npcSpawns, itemSpawns);
    },
    async load(
        regionX: number,
        regionY: number,
        minimizeDrawCalls: boolean,
        loadNpcs: boolean,
        loadItems: boolean,
        maxPlane: number
    ): Promise<TransferDescriptor<ChunkData> | undefined> {
        // console.log('request', regionX, regionY);
        if (!chunkDataLoaderPromise) {
            throw new Error(
                "ChunkDataLoaderWorker has not been initialized yet"
            );
        }
        const chunkDataLoader = await chunkDataLoaderPromise;
        await hasherPromise;

        console.time(`load chunk ${regionX}_${regionY}`);
        const chunkData = await chunkDataLoader.load(regionX, regionY, {
            loadItems,
            loadNpcs,
            maxPlane,
            minimizeDrawCalls,
        });
        console.timeEnd(`load chunk ${regionX}_${regionY}`);
        console.log(
            "model caches: ",
            chunkDataLoader.objectModelLoader.modelDataCache.size,
            chunkDataLoader.objectModelLoader.modelCache.size
        );

        clearCache(chunkDataLoader);

        if (chunkData) {
            const transferables: Transferable[] = [
                chunkData.vertices.buffer,
                chunkData.indices.buffer,
                chunkData.modelTextureData.buffer,
                chunkData.modelTextureDataAlpha.buffer,
                chunkData.modelTextureDataInteract.buffer,
                chunkData.modelTextureDataInteractAlpha.buffer,
                chunkData.heightMapTextureData.buffer,
                ...chunkData.collisionDatas.map((c) => c.flags.buffer),
            ];
            return Transfer(chunkData, transferables);
        }

        return undefined;
    },
    async loadMinimap(
        regionX: number,
        regionY: number,
        plane: number
    ): Promise<MinimapData | undefined> {
        if (!chunkDataLoaderPromise) {
            throw new Error(
                "ChunkDataLoaderWorker has not been initialized yet"
            );
        }
        const chunkDataLoader = await chunkDataLoaderPromise;

        console.time("create minimap " + regionX + "," + regionY);
        const minimapBlob = await chunkDataLoader.loadMinimap(
            regionX,
            regionY,
            plane
        );
        console.timeEnd("create minimap " + regionX + "," + regionY);

        clearCache(chunkDataLoader);

        return (
            minimapBlob && {
                regionX,
                regionY,
                plane,
                cacheInfo: chunkDataLoader.cacheInfo,
                minimapBlob,
            }
        );
    },
});
