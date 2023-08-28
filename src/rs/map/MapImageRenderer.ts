/*
 * Copyright (c) 2023, dennisdev
 * Copyright (c) 2022, Abex
 * Copyright (c) 2022, Mark
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { LocModelType } from "../config/loctype/LocModelType";
import { LocTypeLoader } from "../config/loctype/LocTypeLoader";
import { Rasterizer3D } from "../graphics/Rasterizer3D";
import { Scene } from "../scene/Scene";
import { getIdFromTag, isEntityInteractive } from "../scene/entity/EntityTag";
import { IndexedSprite } from "../sprite/IndexedSprite";
import { SpritePixels } from "../sprite/SpritePixels";
import { TextureLoader } from "../texture/TextureLoader";
import { INVALID_HSL_COLOR } from "../util/ColorUtil";

const tileShape2D = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1],
];

const tileRotation2D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [12, 8, 4, 0, 13, 9, 5, 1, 14, 10, 6, 2, 15, 11, 7, 3],
    [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    [3, 7, 11, 15, 2, 6, 10, 14, 1, 5, 9, 13, 0, 4, 8, 12],
];

export class MapImageRenderer {
    static tmpScreenX = new Int32Array(6);
    static tmpScreenY = new Int32Array(6);

    constructor(
        readonly textureLoader: TextureLoader,
        readonly locTypeLoader: LocTypeLoader,
        readonly mapScenes: IndexedSprite[],
    ) {}

    renderMinimap(scene: Scene, level: number): Int32Array {
        const width = scene.sizeX * 4;
        const height = scene.sizeY * 4;
        const spritePixels = SpritePixels.fromDimensions(width, height);
        const pixels = spritePixels.pixels;

        for (let tileY = 0; tileY < scene.sizeY; tileY++) {
            let offset = (scene.sizeY - 1 - tileY) * width * 4;

            for (let tileX = 0; tileX < scene.sizeX; tileX++) {
                let realLevel = level;
                if ((scene.tileRenderFlags[1][tileX][tileY] & 0x2) === 2) {
                    realLevel++;
                }
                if ((scene.tileRenderFlags[level][tileX][tileY] & 0x18) === 0) {
                    this.drawTile(scene, pixels, offset, width, realLevel, tileX, tileY);
                }

                if (
                    level < 3 &&
                    realLevel < 3 &&
                    (scene.tileRenderFlags[level + 1][tileX][tileY] & 0x8) !== 0
                ) {
                    this.drawTile(scene, pixels, offset, width, realLevel + 1, tileX, tileY);
                }

                offset += 4;
            }
        }

        const wallRgb = 0xeeeeee;
        const wallInteractiveRgb = 0xee0000;

        spritePixels.setRaster();

        for (let tileX = 0; tileX < scene.sizeX; tileX++) {
            for (let tileY = 0; tileY < scene.sizeY; tileY++) {
                let realLevel = level;
                if ((scene.tileRenderFlags[1][tileX][tileY] & 0x2) === 2) {
                    realLevel++;
                }
                if ((scene.tileRenderFlags[level][tileX][tileY] & 0x18) === 0) {
                    this.drawLoc(
                        scene,
                        pixels,
                        width,
                        realLevel,
                        tileX,
                        tileY,
                        wallRgb,
                        wallInteractiveRgb,
                    );
                }

                if (
                    level < 3 &&
                    realLevel < 3 &&
                    (scene.tileRenderFlags[level + 1][tileX][tileY] & 0x8) !== 0
                ) {
                    this.drawLoc(
                        scene,
                        pixels,
                        width,
                        realLevel + 1,
                        tileX,
                        tileY,
                        wallRgb,
                        wallInteractiveRgb,
                    );
                }
            }
        }

        return spritePixels.pixels;
    }

    renderMinimapHd(scene: Scene, playerLevel: number): Int32Array {
        const width = scene.sizeX * 4;
        const height = scene.sizeY * 4;
        const spritePixels = SpritePixels.fromDimensions(width, height);
        const pixels = spritePixels.pixels;

        spritePixels.setRaster();

        Rasterizer3D.setClip();
        Rasterizer3D.rasterGouraudLowRes = false;

        const wallRgb = 0xeeeeee;
        const wallInteractiveRgb = 0xee0000;

        for (let level = playerLevel; level <= 3; level++) {
            for (let tileY = 0; tileY < scene.sizeY; tileY++) {
                for (let tileX = 0; tileX < scene.sizeX; tileX++) {
                    if (!scene.isPlayerLevel(level, tileX, tileY, playerLevel)) {
                        continue;
                    }
                    this.drawTileHd(scene, level, tileX, tileY);
                }
            }
            for (let tileY = 0; tileY < scene.sizeY; tileY++) {
                for (let tileX = 0; tileX < scene.sizeX; tileX++) {
                    if (!scene.isPlayerLevel(level, tileX, tileY, playerLevel)) {
                        continue;
                    }
                    this.drawLoc(
                        scene,
                        pixels,
                        width,
                        level,
                        tileX,
                        tileY,
                        wallRgb,
                        wallInteractiveRgb,
                    );
                }
            }
        }

        return spritePixels.pixels;
    }

    drawTile(
        scene: Scene,
        pixels: Int32Array,
        offset: number,
        width: number,
        level: number,
        tileX: number,
        tileY: number,
    ): void {
        const tile = scene.tiles[level][tileX][tileY];
        if (!tile || !tile.tileModel) {
            return;
        }

        const model = tile.tileModel;
        const underlayRgb = model.underlayRgb;
        const overlayRgb = model.overlayRgb;
        // const overlayRgb = 0;
        const shape2d = tileShape2D[model.shape];
        const rot2d = tileRotation2D[model.rotation];

        let index = 0;
        if (underlayRgb !== 0) {
            for (let i = 0; i < 4; i++) {
                const rgb0 = shape2d[rot2d[index++]] === 0 ? underlayRgb : overlayRgb;
                const rgb1 = shape2d[rot2d[index++]] === 0 ? underlayRgb : overlayRgb;
                const rgb2 = shape2d[rot2d[index++]] === 0 ? underlayRgb : overlayRgb;
                const rgb3 = shape2d[rot2d[index++]] === 0 ? underlayRgb : overlayRgb;
                pixels[offset] = rgb0;
                pixels[offset + 1] = rgb1;
                pixels[offset + 2] = rgb2;
                pixels[offset + 3] = rgb3;
                offset += width;
            }
        } else {
            for (let i = 0; i < 4; i++) {
                if (shape2d[rot2d[index++]] !== 0) {
                    pixels[offset] = overlayRgb;
                }

                if (shape2d[rot2d[index++]] !== 0) {
                    pixels[offset + 1] = overlayRgb;
                }

                if (shape2d[rot2d[index++]] !== 0) {
                    pixels[offset + 2] = overlayRgb;
                }

                if (shape2d[rot2d[index++]] !== 0) {
                    pixels[offset + 3] = overlayRgb;
                }

                offset += width;
            }
        }
    }

    drawTileHd(scene: Scene, level: number, tileX: number, tileY: number): void {
        const tile = scene.tiles[level][tileX][tileY];
        if (!tile || !tile.tileModel) {
            return;
        }

        const model = tile.tileModel;

        const vertexX = model.vertexX;
        const vertexZ = model.vertexZ;

        const facesA = model.facesA;
        const facesB = model.facesB;
        const facesC = model.facesC;

        const colorsA = model.minimapFaceColorsA;
        const colorsB = model.minimapFaceColorsB;
        const colorsC = model.minimapFaceColorsC;

        const LOCAL_COORD_BITS = 7;
        const LOCAL_TILE_SIZE = 1 << LOCAL_COORD_BITS;

        const localX = tileX << LOCAL_COORD_BITS;
        const localY = tileY << LOCAL_COORD_BITS;

        const px0 = tileX * 4;
        const py0 = (scene.sizeY - tileY - 1) * 4;
        const px1 = px0 + 4;
        const py1 = py0 + 4;

        const w = px1 - px0;
        const h = py1 - py0;

        for (let vert = 0; vert < vertexX.length; vert++) {
            MapImageRenderer.tmpScreenX[vert] =
                px0 + (((vertexX[vert] - localX) * w) >> LOCAL_COORD_BITS);
            MapImageRenderer.tmpScreenY[vert] =
                py0 + (((LOCAL_TILE_SIZE - (vertexZ[vert] - localY)) * h) >> LOCAL_COORD_BITS);
        }

        for (let f = 0; f < facesA.length; f++) {
            const a = facesA[f];
            const b = facesB[f];
            const c = facesC[f];

            const colorA = colorsA[f];
            const colorB = colorsB[f];
            const colorC = colorsC[f];

            if (colorA !== INVALID_HSL_COLOR) {
                Rasterizer3D.rasterGouraud(
                    MapImageRenderer.tmpScreenY[a],
                    MapImageRenderer.tmpScreenY[b],
                    MapImageRenderer.tmpScreenY[c],
                    MapImageRenderer.tmpScreenX[a],
                    MapImageRenderer.tmpScreenX[b],
                    MapImageRenderer.tmpScreenX[c],
                    colorA,
                    colorB,
                    colorC,
                );
            }
        }
    }

    drawLoc(
        scene: Scene,
        pixels: Int32Array,
        width: number,
        level: number,
        tileX: number,
        tileY: number,
        wallRgb: number,
        wallInteractiveRgb: number,
    ): void {
        const wallTag = scene.getWallTag(level, tileX, tileY);
        if (wallTag !== 0n) {
            const locFlags = scene.getLocFlags(level, tileX, tileY, wallTag);
            const rotation = (locFlags >> 6) & 0x3;
            const type = locFlags & 0x1f;

            const locId = getIdFromTag(wallTag);
            const locType = this.locTypeLoader.load(locId);

            if (locType.mapSceneId !== -1) {
                const mapScene = this.mapScenes[locType.mapSceneId];
                if (mapScene) {
                    const x = ((locType.sizeX * 4 - mapScene.subWidth) / 2) | 0;
                    const y = ((locType.sizeY * 4 - mapScene.subHeight) / 2) | 0;
                    mapScene.drawAt(tileX * 4 + x, y + (scene.sizeY - tileY - locType.sizeY) * 4);
                }
            } else {
                let rgb = wallRgb;
                if (isEntityInteractive(wallTag)) {
                    rgb = wallInteractiveRgb;
                }

                const offset = tileX * 4 + (scene.sizeY - 1 - tileY) * width * 4;
                if (type === LocModelType.WALL || type === LocModelType.WALL_CORNER) {
                    if (rotation === 0) {
                        pixels[offset] = rgb;
                        pixels[offset + width] = rgb;
                        pixels[offset + width * 2] = rgb;
                        pixels[offset + width * 3] = rgb;
                    } else if (rotation === 1) {
                        pixels[offset] = rgb;
                        pixels[offset + 1] = rgb;
                        pixels[offset + 2] = rgb;
                        pixels[offset + 3] = rgb;
                    } else if (rotation === 2) {
                        pixels[offset + 3] = rgb;
                        pixels[offset + width + 3] = rgb;
                        pixels[offset + width * 2 + 3] = rgb;
                        pixels[offset + width * 3 + 3] = rgb;
                    } else if (rotation === 3) {
                        pixels[offset + width * 3] = rgb;
                        pixels[offset + width * 3 + 1] = rgb;
                        pixels[offset + width * 3 + 2] = rgb;
                        pixels[offset + width * 3 + 3] = rgb;
                    }
                }

                if (type === LocModelType.WALL_RECT_CORNER) {
                    if (rotation === 0) {
                        pixels[offset] = rgb;
                    } else if (rotation === 1) {
                        pixels[offset + 3] = rgb;
                    } else if (rotation === 2) {
                        pixels[offset + width * 3 + 3] = rgb;
                    } else if (rotation === 3) {
                        pixels[offset + width * 3] = rgb;
                    }
                }

                if (type === LocModelType.WALL_CORNER) {
                    if (rotation === 3) {
                        pixels[offset] = rgb;
                        pixels[offset + width] = rgb;
                        pixels[offset + width * 2] = rgb;
                        pixels[offset + width * 3] = rgb;
                    } else if (rotation === 0) {
                        pixels[offset] = rgb;
                        pixels[offset + 1] = rgb;
                        pixels[offset + 2] = rgb;
                        pixels[offset + 3] = rgb;
                    } else if (rotation === 1) {
                        pixels[offset + 3] = rgb;
                        pixels[offset + width + 3] = rgb;
                        pixels[offset + width * 2 + 3] = rgb;
                        pixels[offset + width * 3 + 3] = rgb;
                    } else if (rotation === 2) {
                        pixels[offset + width * 3] = rgb;
                        pixels[offset + width * 3 + 1] = rgb;
                        pixels[offset + width * 3 + 2] = rgb;
                        pixels[offset + width * 3 + 3] = rgb;
                    }
                }
            }
        }

        const locTag = scene.getLocTag(level, tileX, tileY);
        if (locTag !== 0n) {
            const locFlags = scene.getLocFlags(level, tileX, tileY, locTag);
            const rotation = (locFlags >> 6) & 0x3;
            const type = locFlags & 0x1f;

            const locId = getIdFromTag(locTag);
            const locType = this.locTypeLoader.load(locId);

            if (locType.mapSceneId !== -1) {
                const mapScene = this.mapScenes[locType.mapSceneId];
                if (mapScene) {
                    const x = ((locType.sizeX * 4 - mapScene.subWidth) / 2) | 0;
                    const y = ((locType.sizeY * 4 - mapScene.subHeight) / 2) | 0;
                    mapScene.drawAt(tileX * 4 + x, (scene.sizeY - tileY - locType.sizeY) * 4 + y);
                }
            } else if (type === LocModelType.WALL_DIAGONAL) {
                let rgb = wallRgb;
                if (isEntityInteractive(locTag)) {
                    rgb = wallInteractiveRgb;
                }

                const offset = tileX * 4 + (scene.sizeY - 1 - tileY) * width * 4;
                if (rotation !== 0 && rotation !== 2) {
                    pixels[offset] = rgb;
                    pixels[offset + width + 1] = rgb;
                    pixels[offset + width * 2 + 2] = rgb;
                    pixels[offset + width * 3 + 3] = rgb;
                } else {
                    pixels[offset + width * 3] = rgb;
                    pixels[offset + width * 2 + 1] = rgb;
                    pixels[offset + width + 2] = rgb;
                    pixels[offset + 3] = rgb;
                }
            }
        }

        const floorDecorationTag = scene.getFloorDecorationTag(level, tileX, tileY);
        if (floorDecorationTag !== 0n) {
            const locId = getIdFromTag(floorDecorationTag);
            const locType = this.locTypeLoader.load(locId);

            if (locType.mapSceneId !== -1) {
                const mapScene = this.mapScenes[locType.mapSceneId];
                if (mapScene) {
                    const x = (locType.sizeX * 4 - mapScene.subWidth) / 2;
                    const y = (locType.sizeY * 4 - mapScene.subHeight) / 2;
                    mapScene.drawAt(tileX * 4 + x, y + (scene.sizeY - tileY - locType.sizeY) * 4);
                }
            }
        }
    }
}
