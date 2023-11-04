import fs from "fs";
import { loadCache, loadCacheInfos, loadCacheList } from "./load-util";
import { CacheSystem } from "../../src/rs/cache/CacheSystem";
import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import sharp from "sharp";

function saveArgbArrayToPng(pixels: Int32Array, width: number, height: number, outputPath: string) {
    // Convert ARGB to RGBA
    const rgbaPixels = new Uint8Array(pixels.length * 4);
    for (let i = 0; i < pixels.length; i++) {
        rgbaPixels[i * 4 + 0] = (pixels[i] >> 16) & 0xff; // R
        rgbaPixels[i * 4 + 1] = (pixels[i] >> 8) & 0xff; // G
        rgbaPixels[i * 4 + 2] = pixels[i] & 0xff; // B
        rgbaPixels[i * 4 + 3] = (pixels[i] >> 24) & 0xff; // A
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

const SIZE = 128;

const caches = loadCacheInfos();
const cacheList = loadCacheList(caches);

const cacheInfo = cacheList.latest;

const loadedCache = loadCache(cacheInfo);

const cacheSystem = CacheSystem.fromFiles(loadedCache.type, loadedCache.files);
const cacheLoaderFactory = getCacheLoaderFactory(cacheInfo, cacheSystem);

const textureLoader = cacheLoaderFactory.getTextureLoader();

fs.mkdirSync("./textures", { recursive: true });

for (const id of textureLoader.getTextureIds()) {
    const pixels = textureLoader.getPixelsArgb(id, SIZE, false, 1.0);

    const outputPath = `./textures/${id}.png`;
    saveArgbArrayToPng(pixels, SIZE, SIZE, outputPath);
}
