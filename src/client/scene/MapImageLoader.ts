import { ObjectLoader } from "../fs/loader/ObjectLoader";
import { getIdFromEntityTag, isEntityInteractive } from "./EntityTag";
import { ObjectType } from "./ObjectType";
import { Scene } from "./Scene";

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

export class MapImageLoader {
    objectLoader: ObjectLoader;

    constructor(objectLoader: ObjectLoader) {
        this.objectLoader = objectLoader;
    }

    createMinimapPixels(scene: Scene, plane: number): Int32Array {
        const width = Scene.MAP_SIZE * 4;
        const pixels = new Int32Array(width * width);
        const view = new DataView(pixels.buffer);

        for (let tileY = 0; tileY < Scene.MAP_SIZE; tileY++) {
            let offset = (Scene.MAP_SIZE - 1 - tileY) * width * 4;

            for (let tileX = 0; tileX < Scene.MAP_SIZE; tileX++) {
                if ((scene.tileRenderFlags[plane][tileX][tileY] & 0x18) === 0) {
                    this.drawTileMinimap(
                        scene,
                        view,
                        offset,
                        width,
                        plane,
                        tileX,
                        tileY
                    );
                }

                if (
                    plane < 3 &&
                    (scene.tileRenderFlags[plane + 1][tileX][tileY] & 0x8) !== 0
                ) {
                    this.drawTileMinimap(
                        scene,
                        view,
                        offset,
                        width,
                        plane + 1,
                        tileX,
                        tileY
                    );
                }

                offset += 4;
            }
        }

        const wallRgb = 0xeeeeee;
        const wallInteractiveRgb = 0xee0000;

        for (let tileX = 0; tileX < Scene.MAP_SIZE; tileX++) {
            for (let tileY = 0; tileY < Scene.MAP_SIZE; tileY++) {
                if ((scene.tileRenderFlags[plane][tileX][tileY] & 0x18) === 0) {
                    this.drawObject(
                        scene,
                        view,
                        width,
                        plane,
                        tileX,
                        tileY,
                        wallRgb,
                        wallInteractiveRgb
                    );
                }

                if (
                    plane < 3 &&
                    (scene.tileRenderFlags[plane + 1][tileX][tileY] & 0x8) !== 0
                ) {
                    this.drawObject(
                        scene,
                        view,
                        width,
                        plane + 1,
                        tileX,
                        tileY,
                        wallRgb,
                        wallInteractiveRgb
                    );
                }
            }
        }

        return pixels;
    }

    drawTileMinimap(
        scene: Scene,
        pixels: DataView,
        offset: number,
        width: number,
        plane: number,
        tileX: number,
        tileY: number
    ) {
        const tile = scene.tiles[plane][tileX][tileY];
        if (!tile || !tile.tileModel) {
            return;
        }

        const model = tile.tileModel;
        const underlayRgb = model.underlayRgb;
        const overlayRgb = model.overlayRgb;
        const shape2d = tileShape2D[model.shape];
        const rot2d = tileRotation2D[model.rotation];

        let index = 0;
        if (underlayRgb !== 0) {
            for (let i = 0; i < 4; i++) {
                const rgb0 =
                    shape2d[rot2d[index++]] === 0 ? underlayRgb : overlayRgb;
                const rgb1 =
                    shape2d[rot2d[index++]] === 0 ? underlayRgb : overlayRgb;
                const rgb2 =
                    shape2d[rot2d[index++]] === 0 ? underlayRgb : overlayRgb;
                const rgb3 =
                    shape2d[rot2d[index++]] === 0 ? underlayRgb : overlayRgb;
                pixels.setUint32(offset * 4, (rgb0 << 8) | 0xff);
                pixels.setUint32((offset + 1) * 4, (rgb1 << 8) | 0xff);
                pixels.setUint32((offset + 2) * 4, (rgb2 << 8) | 0xff);
                pixels.setUint32((offset + 3) * 4, (rgb3 << 8) | 0xff);
                offset += width;
            }
        } else {
            for (let i = 0; i < 4; i++) {
                if (shape2d[rot2d[index++]] !== 0) {
                    pixels.setUint32(offset * 4, (overlayRgb << 8) | 0xff);
                }

                if (shape2d[rot2d[index++]] !== 0) {
                    pixels.setUint32(
                        (offset + 1) * 4,
                        (overlayRgb << 8) | 0xff
                    );
                }

                if (shape2d[rot2d[index++]] !== 0) {
                    pixels.setUint32(
                        (offset + 2) * 4,
                        (overlayRgb << 8) | 0xff
                    );
                }

                if (shape2d[rot2d[index++]] !== 0) {
                    pixels.setUint32(
                        (offset + 3) * 4,
                        (overlayRgb << 8) | 0xff
                    );
                }

                offset += width;
            }
        }
    }

    drawObject(
        scene: Scene,
        pixels: DataView,
        width: number,
        plane: number,
        tileX: number,
        tileY: number,
        wallRgb: number,
        wallInteractiveRgb: number
    ) {
        const wallObjectTag = scene.getWallObjectTag(plane, tileX, tileY);
        if (wallObjectTag !== 0n) {
            const objectFlags = scene.getObjectFlags(
                plane,
                tileX,
                tileY,
                wallObjectTag
            );
            const rotation = (objectFlags >> 6) & 0x3;
            const type = objectFlags & 0x1f;

            const objectId = getIdFromEntityTag(wallObjectTag);
            const objectDef = this.objectLoader.getDefinition(objectId);

            if (objectDef.mapSceneId !== -1) {
                // draw map scene
            } else {
                let rgb = wallRgb;
                if (isEntityInteractive(wallObjectTag)) {
                    rgb = wallInteractiveRgb;
                }

                const rgba = (rgb << 8) | 0xff;

                const offset =
                    tileX * 4 + (Scene.MAP_SIZE - 1 - tileY) * width * 4;
                if (
                    type === ObjectType.WALL ||
                    type === ObjectType.WALL_CORNER
                ) {
                    if (rotation === 0) {
                        pixels.setUint32(offset * 4, rgba);
                        pixels.setUint32((offset + width) * 4, rgba);
                        pixels.setUint32((offset + width * 2) * 4, rgba);
                        pixels.setUint32((offset + width * 3) * 4, rgba);
                    } else if (rotation === 1) {
                        pixels.setUint32(offset * 4, rgba);
                        pixels.setUint32((offset + 1) * 4, rgba);
                        pixels.setUint32((offset + 2) * 4, rgba);
                        pixels.setUint32((offset + 3) * 4, rgba);
                    } else if (rotation === 2) {
                        pixels.setUint32((offset + 3) * 4, rgba);
                        pixels.setUint32((offset + width + 3) * 4, rgba);
                        pixels.setUint32((offset + width * 2 + 3) * 4, rgba);
                        pixels.setUint32((offset + width * 3 + 3) * 4, rgba);
                    } else if (rotation === 3) {
                        pixels.setUint32((offset + width * 3) * 4, rgba);
                        pixels.setUint32((offset + width * 3 + 1) * 4, rgba);
                        pixels.setUint32((offset + width * 3 + 2) * 4, rgba);
                        pixels.setUint32((offset + width * 3 + 3) * 4, rgba);
                    }
                }

                if (type === ObjectType.WALL_RECT_CORNER) {
                    if (rotation === 0) {
                        pixels.setUint32(offset * 4, rgba);
                    } else if (rotation === 1) {
                        pixels.setUint32((offset + 3) * 4, rgba);
                    } else if (rotation === 2) {
                        pixels.setUint32((offset + width * 3 + 3) * 4, rgba);
                    } else if (rotation === 3) {
                        pixels.setUint32((offset + width * 3) * 4, rgba);
                    }
                }

                if (type === ObjectType.WALL_CORNER) {
                    if (rotation === 3) {
                        pixels.setUint32(offset * 4, rgba);
                        pixels.setUint32((offset + width) * 4, rgba);
                        pixels.setUint32((offset + width * 2) * 4, rgba);
                        pixels.setUint32((offset + width * 3) * 4, rgba);
                    } else if (rotation === 0) {
                        pixels.setUint32(offset * 4, rgba);
                        pixels.setUint32((offset + 1) * 4, rgba);
                        pixels.setUint32((offset + 2) * 4, rgba);
                        pixels.setUint32((offset + 3) * 4, rgba);
                    } else if (rotation === 1) {
                        pixels.setUint32((offset + 3) * 4, rgba);
                        pixels.setUint32((offset + width + 3) * 4, rgba);
                        pixels.setUint32((offset + width * 2 + 3) * 4, rgba);
                        pixels.setUint32((offset + width * 3 + 3) * 4, rgba);
                    } else if (rotation === 2) {
                        pixels.setUint32((offset + width * 3) * 4, rgba);
                        pixels.setUint32((offset + width * 3 + 1) * 4, rgba);
                        pixels.setUint32((offset + width * 3 + 2) * 4, rgba);
                        pixels.setUint32((offset + width * 3 + 3) * 4, rgba);
                    }
                }
            }
        }

        const gameObjectTag = scene.getGameObjectTag(plane, tileX, tileY);
        if (gameObjectTag !== 0n) {
            const objectFlags = scene.getObjectFlags(
                plane,
                tileX,
                tileY,
                gameObjectTag
            );
            const rotation = (objectFlags >> 6) & 0x3;
            const type = objectFlags & 0x1f;

            const objectId = getIdFromEntityTag(gameObjectTag);
            const objectDef = this.objectLoader.getDefinition(objectId);

            if (objectDef.mapSceneId !== -1) {
                // draw map scene
            } else if (type === ObjectType.WALL_DIAGONAL) {
                let rgb = wallRgb;
                if (isEntityInteractive(wallObjectTag)) {
                    rgb = wallInteractiveRgb;
                }

                const rgba = (rgb << 8) | 0xff;

                const offset =
                    tileX * 4 + (Scene.MAP_SIZE - 1 - tileY) * width * 4;
                if (rotation !== 0 && rotation !== 2) {
                    pixels.setUint32(offset * 4, rgba);
                    pixels.setUint32((offset + width + 1) * 4, rgba);
                    pixels.setUint32((offset + width * 2 + 2) * 4, rgba);
                    pixels.setUint32((offset + width * 3 + 3) * 4, rgba);
                } else {
                    pixels.setUint32((offset + width * 3) * 4, rgba);
                    pixels.setUint32((offset + width * 2 + 1) * 4, rgba);
                    pixels.setUint32((offset + width + 2) * 4, rgba);
                    pixels.setUint32((offset + 3) * 4, rgba);
                }
            }
        }
    }
}
