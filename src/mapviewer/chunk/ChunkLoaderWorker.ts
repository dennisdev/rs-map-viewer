import { expose, Transfer } from "threads/worker";
import { ConfigType, ConfigTypeDat } from "../../client/fs/ConfigType";
import { loadFromStore, loadFromStoreDat } from "../../client/fs/FileSystem";
import { IndexType, IndexTypeDat } from "../../client/fs/IndexType";
import {
    CachedObjectDat2Loader,
    ObjectDatLoader,
} from "../../client/fs/loader/ObjectLoader";
import {
    CachedOverlayDat2Loader,
    FloorDatLoader,
} from "../../client/fs/loader/OverlayLoader";
import { CachedUnderlayDat2Loader } from "../../client/fs/loader/UnderlayLoader";
import {
    MemoryStoreDat,
    MemoryStoreDat2,
} from "../../client/fs/store/MemoryStore";
import { RegionLoader } from "../../client/RegionLoader";
import {
    TextureDat2Loader,
    TextureDatLoader,
} from "../../client/fs/loader/TextureLoader";
import { Compression } from "../../client/util/Compression";
import { ChunkDataLoader } from "./ChunkDataLoader";
import { IndexModelLoader } from "../../client/fs/loader/model/ModelLoader";
import { Hasher } from "../util/Hasher";
import {
    AnimationDatLoader,
    CachedAnimationDat2Loader,
} from "../../client/fs/loader/AnimationLoader";
import { CachedSkeletonLoader } from "../../client/fs/loader/SkeletonLoader";
import { ObjectModelLoader } from "../../client/fs/loader/model/ObjectModelLoader";
import {
    CachedVarbitDat2Loader,
    VarbitDatLoader,
} from "../../client/fs/loader/VarbitLoader";
import { VarpManager } from "../../client/VarpManager";
import { NpcModelLoader } from "../../client/fs/loader/model/NpcModelLoader";
import {
    CachedNpcDat2Loader,
    NpcDatLoader,
} from "../../client/fs/loader/NpcLoader";
import { NpcSpawn } from "../npc/NpcSpawn";
import { LoadedCache } from "../Caches";
import { ItemModelLoader } from "../../client/fs/loader/model/ItemModelLoader";
import {
    CachedItemDat2Loader,
    ItemDatLoader,
} from "../../client/fs/loader/ItemLoader";
import { ItemSpawn } from "../item/ItemSpawn";
import { MapImageLoader } from "../../client/scene/MapImageLoader";
import { GraphicDefaults } from "../../client/fs/definition/GraphicDefaults";
import { SpriteLoader } from "../../client/sprite/SpriteLoader";
import { TransferDescriptor } from "threads";
import { ChunkData } from "./ChunkData";
import { MinimapData } from "./MinimapData";
import { MapIndexDat, MapIndexDat2 } from "../../client/MapIndex";
import {
    AnimationFrameDat2Loader,
    AnimationFrameDatLoader,
} from "../../client/fs/loader/AnimationFrameLoader";
import { CacheType } from "../../client/fs/Types";
import { IndexedSprite } from "../../client/sprite/IndexedSprite";

let chunkDataLoaderPromise: Promise<ChunkDataLoader> | undefined;

const wasmCompressionPromise = Compression.initWasm();
const hasherPromise = Hasher.init();

function initChunkDataLoader(
    cache: LoadedCache,
    npcSpawns: NpcSpawn[],
    itemSpawns: ItemSpawn[]
): ChunkDataLoader {
    if (cache.store instanceof MemoryStoreDat) {
        return initChunkDataLoaderDat(
            cache,
            npcSpawns,
            itemSpawns,
            cache.store
        );
    } else {
        return initChunkDataLoaderDat2(
            cache,
            npcSpawns,
            itemSpawns,
            cache.store
        );
    }
}

function initChunkDataLoaderDat(
    cache: LoadedCache,
    npcSpawns: NpcSpawn[],
    itemSpawns: ItemSpawn[],
    store: MemoryStoreDat
): ChunkDataLoader {
    const fileSystem = loadFromStoreDat(store);

    const configIndex = fileSystem.getIndex(IndexTypeDat.CONFIGS);
    const modelIndex = fileSystem.getIndex(IndexTypeDat.MODELS);
    const animIndex = fileSystem.getIndex(IndexTypeDat.ANIMATIONS);
    const mapCacheIndex = fileSystem.getIndex(IndexTypeDat.MAPS);

    const configArchive = configIndex.getArchive(ConfigTypeDat.CONFIGS);
    const mediaArchive = configIndex.getArchive(ConfigTypeDat.MEDIA);
    const versionListArchive = configIndex.getArchive(
        ConfigTypeDat.VERSIONLIST
    );
    const textureArchive = configIndex.getArchive(ConfigTypeDat.TEXTURES);

    const floorLoader = FloorDatLoader.load(configArchive, cache.info);

    const objectLoader = ObjectDatLoader.load(configArchive, cache.info);
    const npcLoader = NpcDatLoader.load(configArchive, cache.info);
    const itemLoader = ItemDatLoader.load(configArchive, cache.info);

    const animationLoader = AnimationDatLoader.load(configArchive, cache.info);
    const varbitLoader = VarbitDatLoader.load(configArchive, cache.info);

    const frameLoader = AnimationFrameDatLoader.load(animIndex);

    const varpManager = new VarpManager(varbitLoader);

    const modelLoader = new IndexModelLoader(modelIndex);

    const objectModelLoader = new ObjectModelLoader(
        objectLoader,
        modelLoader,
        animationLoader,
        frameLoader
    );
    const npcModelLoader = new NpcModelLoader(
        npcLoader,
        modelLoader,
        animationLoader,
        frameLoader,
        varpManager
    );
    const itemModelLoader = new ItemModelLoader(itemLoader, modelLoader);

    const mapIndex = MapIndexDat.load(versionListArchive);
    const regionLoader = new RegionLoader(
        cache.info,
        mapIndex,
        mapCacheIndex,
        floorLoader,
        floorLoader,
        objectLoader,
        objectModelLoader,
        cache.xteas,
        varpManager
    );

    const textureProvider = new TextureDatLoader(textureArchive);

    // TODO: maybe there is a way to check how many mapscenes there are
    const mapScenes = new Array<IndexedSprite>();
    for (let i = 0; i < 100; i++) {
        try {
            mapScenes[i] = SpriteLoader.loadIndexedSpriteDat(
                mediaArchive,
                "mapscene",
                i
            );
        } catch (e) {
            break;
        }
    }
    const mapImageLoader = new MapImageLoader(objectLoader, mapScenes);

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

function initChunkDataLoaderDat2(
    cache: LoadedCache,
    npcSpawns: NpcSpawn[],
    itemSpawns: ItemSpawn[],
    store: MemoryStoreDat2
): ChunkDataLoader {
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

    const underlayLoader = new CachedUnderlayDat2Loader(
        underlayArchive,
        cache.info
    );
    const overlayLoader = new CachedOverlayDat2Loader(
        overlayArchive,
        cache.info
    );
    const objectLoader = new CachedObjectDat2Loader(objectArchive, cache.info);
    const npcLoader = new CachedNpcDat2Loader(npcArchive, cache.info);
    const itemLoader = new CachedItemDat2Loader(itemArchive, cache.info);

    const animationLoader = new CachedAnimationDat2Loader(
        animationArchive,
        cache.info
    );

    const varbitLoader = new CachedVarbitDat2Loader(varbitArchive, cache.info);

    const skeletonLoader = new CachedSkeletonLoader(skeletonIndex);
    const frameLoader = new AnimationFrameDat2Loader(
        frameMapIndex,
        skeletonLoader
    );

    const varpManager = new VarpManager(varbitLoader);

    const modelLoader = new IndexModelLoader(modelIndex);

    const objectModelLoader = new ObjectModelLoader(
        objectLoader,
        modelLoader,
        animationLoader,
        frameLoader
    );
    const npcModelLoader = new NpcModelLoader(
        npcLoader,
        modelLoader,
        animationLoader,
        frameLoader,
        varpManager
    );
    const itemModelLoader = new ItemModelLoader(itemLoader, modelLoader);

    const regionLoader = new RegionLoader(
        cache.info,
        new MapIndexDat2(mapIndex),
        mapIndex,
        underlayLoader,
        overlayLoader,
        objectLoader,
        objectModelLoader,
        cache.xteas,
        varpManager
    );

    // console.time('load textures');
    const textureProvider = TextureDat2Loader.load(
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

async function init0(
    cache: LoadedCache,
    npcSpawns: NpcSpawn[],
    itemSpawns: ItemSpawn[]
): Promise<ChunkDataLoader> {
    await wasmCompressionPromise;

    if (cache.store.cacheType === CacheType.DAT) {
        Object.setPrototypeOf(cache.store, MemoryStoreDat.prototype);
    } else {
        Object.setPrototypeOf(cache.store, MemoryStoreDat2.prototype);
    }

    const chunkDataLoader = initChunkDataLoader(cache, npcSpawns, itemSpawns);

    return chunkDataLoader;
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
