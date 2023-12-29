import { CacheInfo } from "../../rs/cache/CacheInfo";
import { MapImageRenderer } from "../../rs/map/MapImageRenderer";
import { Scene } from "../../rs/scene/Scene";

export type MinimapData = {
    mapX: number;
    mapY: number;
    level: number;
    cacheInfo: CacheInfo;

    minimapBlob: Blob;
};

export async function loadMinimapBlob(
    mapImageRenderer: MapImageRenderer,
    scene: Scene,
    level: number,
    borderSize: number,
    drawMapFunctions: boolean,
): Promise<Blob> {
    const minimapPixels = mapImageRenderer.renderMinimapHd(scene, level, drawMapFunctions);

    const minimapView = new DataView(minimapPixels.buffer);
    for (let i = 0; i < minimapPixels.length; i++) {
        minimapView.setUint32(i * 4, (minimapPixels[i] << 8) | 0xff);
    }

    const widthExclBorder = (scene.sizeX - borderSize * 2) * 4;
    const heightExclBorder = (scene.sizeY - borderSize * 2) * 4;
    const canvas = new OffscreenCanvas(widthExclBorder, heightExclBorder);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Could not get canvas context");
    }

    const pixelWidth = scene.sizeX * 4;
    const pixelHeight = scene.sizeY * 4;
    const imageData = new ImageData(pixelWidth, pixelHeight);
    imageData.data.set(new Uint8ClampedArray(minimapPixels.buffer));

    ctx.putImageData(imageData, -borderSize * 4, -borderSize * 4);

    return canvas.convertToBlob();
}
