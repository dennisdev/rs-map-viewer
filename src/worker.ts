import { expose, Transfer } from "threads/worker";
import { ConfigType } from "./client/fs/ConfigType";
import { loadFromStore } from "./client/fs/FileSystem";
import { IndexSync } from "./client/fs/Index";
import { IndexType } from "./client/fs/IndexType";
import { CachedObjectLoader } from "./client/fs/loader/ObjectLoader";
import { CachedOverlayLoader } from "./client/fs/loader/OverlayLoader";
import { CachedUnderlayLoader } from "./client/fs/loader/UnderlayLoader";
import { MemoryStore } from "./client/fs/MemoryStore";
import { RegionLoader } from "./client/RegionLoader";
import { TextureLoader } from "./client/fs/loader/TextureLoader";
import { Compression } from "./client/util/Compression";
import { ChunkDataLoader } from "./ChunkDataLoader";
import { CachedModelLoader, IndexModelLoader } from "./client/fs/loader/ModelLoader";
import { ObjectModelLoader, Scene2 } from "./client/scene/Scene";

type MemoryStoreProperties = {
    dataFile: ArrayBuffer,
    indexFiles: (ArrayBuffer | undefined)[],
    metaFile: ArrayBuffer
};

let chunkDataLoader: ChunkDataLoader | undefined;

const wasmCompressionPromise = Compression.initWasm();

expose({
    async init(memoryStoreProperties: MemoryStoreProperties, xteasMap: Map<number, number[]>) {
        // await wasmCompressionPromise;

        const store = new MemoryStore(memoryStoreProperties.dataFile, memoryStoreProperties.indexFiles, memoryStoreProperties.metaFile);

        const fileSystem = loadFromStore(store);

        const configIndex = fileSystem.getIndex(IndexType.CONFIGS);
        const mapIndex = fileSystem.getIndex(IndexType.MAPS);
        const spriteIndex = fileSystem.getIndex(IndexType.SPRITES);
        const textureIndex = fileSystem.getIndex(IndexType.TEXTURES);
        const modelIndex = fileSystem.getIndex(IndexType.MODELS);

        const underlayArchive = configIndex.getArchive(ConfigType.UNDERLAY);
        const overlayArchive = configIndex.getArchive(ConfigType.OVERLAY);
        const objectArchive = configIndex.getArchive(ConfigType.OBJECT);

        const underlayLoader = new CachedUnderlayLoader(underlayArchive);
        const overlayLoader = new CachedOverlayLoader(overlayArchive);
        const objectLoader = new CachedObjectLoader(objectArchive);

        const regionLoader = new RegionLoader(mapIndex, underlayLoader, overlayLoader, objectLoader, xteasMap);

        const modelLoader = new CachedModelLoader(modelIndex);

        const textureProvider = TextureLoader.load(textureIndex, spriteIndex);
        for (const texture of textureProvider.definitions.values()) {
            textureProvider.loadFromDef(texture, 1.0, 128);
        }

        chunkDataLoader = new ChunkDataLoader(regionLoader, modelLoader, textureProvider);
        console.log('init worker', fileSystem);
    },
    load(regionX: number, regionY: number) {
        if (!chunkDataLoader) {
            throw new Error('ChunkLoaderWorker not initialized');
        }
        console.time(`load chunk ${regionX}_${regionY}`);
        const chunkData = chunkDataLoader.load2(regionX, regionY);
        console.timeEnd(`load chunk ${regionX}_${regionY}`);
        console.log('model caches: ', chunkDataLoader.objectModelLoader.modelDataCache.size, chunkDataLoader.objectModelLoader.modelCache.size)


        // const regionLoader = chunkDataLoader.regionLoader;
        // const objectModelLoader = new ObjectModelLoader(new IndexModelLoader(chunkDataLoader.modelLoader.modelIndex));

        // const region = regionLoader.getRegion(regionX, regionY);


        // const landscapeData = regionLoader.getLandscapeData(regionX, regionY);
        // if (landscapeData && region) {
        //     const scene = new Scene2(4, 64, 64, region.tileHeights);
        //     console.time('scenetile');
        //     scene.decodeLandscape(regionLoader, objectModelLoader, landscapeData);

        //     scene.applyLighting(-50, -10, -50);

        //     console.timeEnd('scenetile');
        //     console.log(scene);
        // }



        chunkDataLoader.regionLoader.regions.clear();
        chunkDataLoader.regionLoader.blendedUnderlayColors.clear();
        chunkDataLoader.regionLoader.lightLevels.clear();

        chunkDataLoader.modelLoader.cache.clear();
        chunkDataLoader.objectModelLoader.modelDataCache.clear();
        chunkDataLoader.objectModelLoader.modelCache.clear();

        if (chunkData) {
            const transferables: Transferable[] = [
                chunkData.vertices.buffer,
                chunkData.indices.buffer,
                chunkData.perModelTextureData.buffer, 
                chunkData.heightMapTextureData.buffer
            ];
            return Transfer(chunkData, transferables);
        }

        return undefined;
    }
});
