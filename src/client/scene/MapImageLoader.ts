import { ObjectLoader } from "../fs/loader/ObjectLoader";
import { IndexedSprite } from "../sprite/IndexedSprite";
import { SpritePixels } from "../sprite/SpritePixels";
import { getIdFromTag, isEntityInteractive } from "./EntityTag";
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

    mapScenes: IndexedSprite[];

    constructor(objectLoader: ObjectLoader, mapScenes: IndexedSprite[]) {
        this.objectLoader = objectLoader;
        this.mapScenes = mapScenes;
    }

    createMinimapPixels(scene: Scene, plane: number): Int32Array {
        const width = Scene.MAP_SIZE * 4;
        const spritePixels = SpritePixels.fromDimensions(width, width);
        const pixels = spritePixels.pixels;

        for (let tileY = 0; tileY < Scene.MAP_SIZE; tileY++) {
            let offset = (Scene.MAP_SIZE - 1 - tileY) * width * 4;

            for (let tileX = 0; tileX < Scene.MAP_SIZE; tileX++) {
                if ((scene.tileRenderFlags[plane][tileX][tileY] & 0x18) === 0) {
                    this.drawTile(
                        scene,
                        pixels,
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
                    this.drawTile(
                        scene,
                        pixels,
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

        spritePixels.setRaster();

        for (let tileX = 0; tileX < Scene.MAP_SIZE; tileX++) {
            for (let tileY = 0; tileY < Scene.MAP_SIZE; tileY++) {
                if ((scene.tileRenderFlags[plane][tileX][tileY] & 0x18) === 0) {
                    this.drawObject(
                        scene,
                        pixels,
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
                        pixels,
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

        return spritePixels.pixels;
    }

    drawTile(
        scene: Scene,
        pixels: Int32Array,
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

    drawObject(
        scene: Scene,
        pixels: Int32Array,
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

            const objectId = getIdFromTag(wallObjectTag);
            const objectDef = this.objectLoader.getDefinition(objectId);

            if (objectDef.mapSceneId !== -1) {
                const mapScene = this.mapScenes[objectDef.mapSceneId];

                const x = ((objectDef.sizeX * 4 - mapScene.subWidth) / 2) | 0;
                const y = ((objectDef.sizeY * 4 - mapScene.subHeight) / 2) | 0;
                mapScene.drawAt(
                    tileX * 4 + x,
                    y + (Scene.MAP_SIZE - tileY - objectDef.sizeY) * 4
                );
            } else {
                let rgb = wallRgb;
                if (isEntityInteractive(wallObjectTag)) {
                    rgb = wallInteractiveRgb;
                }

                const offset =
                    tileX * 4 + (Scene.MAP_SIZE - 1 - tileY) * width * 4;
                if (
                    type === ObjectType.WALL ||
                    type === ObjectType.WALL_CORNER
                ) {
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

                if (type === ObjectType.WALL_RECT_CORNER) {
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

                if (type === ObjectType.WALL_CORNER) {
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

            const objectId = getIdFromTag(gameObjectTag);
            const objectDef = this.objectLoader.getDefinition(objectId);

            if (objectDef.mapSceneId !== -1) {
                const mapScene = this.mapScenes[objectDef.mapSceneId];

                const x = ((objectDef.sizeX * 4 - mapScene.subWidth) / 2) | 0;
                const y = ((objectDef.sizeY * 4 - mapScene.subHeight) / 2) | 0;
                mapScene.drawAt(
                    tileX * 4 + x,
                    (Scene.MAP_SIZE - tileY - objectDef.sizeY) * 4 + y
                );
            } else if (type === ObjectType.WALL_DIAGONAL) {
                let rgb = wallRgb;
                if (isEntityInteractive(gameObjectTag)) {
                    rgb = wallInteractiveRgb;
                }

                const offset =
                    tileX * 4 + (Scene.MAP_SIZE - 1 - tileY) * width * 4;
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

        const floorDecorationTag = scene.getFloorDecorationTag(
            plane,
            tileX,
            tileY
        );
        if (floorDecorationTag !== 0n) {
            const objectId = getIdFromTag(floorDecorationTag);
            const objectDef = this.objectLoader.getDefinition(objectId);

            if (objectDef.mapSceneId !== -1) {
                const mapScene = this.mapScenes[objectDef.mapSceneId];

                const x = (objectDef.sizeX * 4 - mapScene.subWidth) / 2;
                const y = (objectDef.sizeY * 4 - mapScene.subHeight) / 2;
                mapScene.drawAt(
                    tileX * 4 + x,
                    y + (Scene.MAP_SIZE - tileY - objectDef.sizeY) * 4
                );
            }
        }
    }
}
