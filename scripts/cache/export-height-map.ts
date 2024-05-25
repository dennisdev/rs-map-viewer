import fs from "fs";
import sharp from "sharp";

import { CacheSystem } from "../../src/rs/cache/CacheSystem";
import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { LocModelLoader } from "../../src/rs/config/loctype/LocModelLoader";
import { LocLoadType, SceneBuilder } from "../../src/rs/scene/SceneBuilder";
import { loadCache, loadCacheInfos, loadCacheList } from "./load-util";

function saveHeightMapToPng(
    heightMap: Uint8Array,
    width: number,
    height: number,
    outputPath: string,
) {
    const rgbaPixels = new Uint8Array(heightMap.length * 4);
    for (let i = 0; i < heightMap.length; i++) {
        const height = heightMap[i];
        rgbaPixels[i * 4 + 0] = height;
        rgbaPixels[i * 4 + 1] = height;
        rgbaPixels[i * 4 + 2] = height;
        rgbaPixels[i * 4 + 3] = 0xff;
    }

    // Convert to PNG using sharp
    sharp(rgbaPixels, {
        raw: {
            width: width,
            height: height,
            channels: 4,
        },
    })
        .toFile(outputPath)
        .catch((err) => console.error(err));
}

const caches = loadCacheInfos();
const cacheList = loadCacheList(caches);

const cacheInfo = cacheList.latest;

const loadedCache = loadCache(cacheInfo);

const cacheSystem = CacheSystem.fromFiles(loadedCache.type, loadedCache.files);
const loaderFactory = getCacheLoaderFactory(cacheInfo, cacheSystem);

const underlayTypeLoader = loaderFactory.getUnderlayTypeLoader();
const overlayTypeLoader = loaderFactory.getOverlayTypeLoader();

const locTypeLoader = loaderFactory.getLocTypeLoader();

const modelLoader = loaderFactory.getModelLoader();
const textureLoader = loaderFactory.getTextureLoader();

const seqTypeLoader = loaderFactory.getSeqTypeLoader();
const seqFrameLoader = loaderFactory.getSeqFrameLoader();
const skeletalSeqLoader = loaderFactory.getSkeletalSeqLoader();

const mapFileLoader = loaderFactory.getMapFileLoader();

const locModelLoader = new LocModelLoader(
    locTypeLoader,
    modelLoader,
    textureLoader,
    seqTypeLoader,
    seqFrameLoader,
    skeletalSeqLoader,
);

const sceneBuilder = new SceneBuilder(
    loadedCache.info,
    mapFileLoader,
    underlayTypeLoader,
    overlayTypeLoader,
    locTypeLoader,
    locModelLoader,
    loadedCache.xteas,
);

function exportHeightMap() {
    const level = 0;
    const baseX = 1024;
    const baseY = 2496;
    const endX = 3967;
    const endY = 4159;
    const sizeX = endX - baseX;
    const sizeY = endY - baseY;

    const maxHeight = 2040;

    const scene = sceneBuilder.buildScene(baseX, baseY, sizeX, sizeY, false, LocLoadType.NO_MODELS);

    const heightMap = new Uint8Array(sizeX * sizeY);
    for (let y = 0; y < sizeY; y++) {
        for (let x = 0; x < sizeX; x++) {
            const index = (sizeY - y) * sizeX + x;
            const height = Math.min((-scene.tileHeights[level][x][y] / maxHeight) * 0xff, 0xff);
            heightMap[index] = height;
        }
    }

    saveHeightMapToPng(heightMap, sizeX, sizeY, `./height-map.png`);
}

exportHeightMap();
