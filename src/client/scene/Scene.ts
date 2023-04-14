import { generateHeight } from "../Client";
import { CollisionMap } from "./CollisionMap";
import { ObjectDefinition } from "../fs/definition/ObjectDefinition";
import { Model } from "../model/Model";
import { ModelData } from "../model/ModelData";
import { RegionLoader } from "../RegionLoader";
import { ByteBuffer } from "../util/ByteBuffer";
import { Renderable } from "./Renderable";
import { AnimatedObject } from "./AnimatedObject";
import { SceneTileModel } from "./SceneTileModel";
import { adjustOverlayLight, adjustUnderlayLight, packHsl } from "../util/ColorUtil";
import { TextureLoader } from "../fs/loader/TextureLoader";
import { ObjectType } from "./ObjectType";
import { ObjectModelLoader, ContourGroundInfo } from "./ObjectModelLoader";
import { calculateEntityTag, EntityType, getIdFromEntityTag } from "./EntityTag";

export class SceneTile {
    plane: number;

    x: number;

    y: number;

    tileModel?: SceneTileModel;

    wallObject?: WallObject;

    wallDecoration?: WallDecoration;

    floorDecoration?: FloorDecoration;

    gameObjects: GameObject[];

    constructor(plane: number, x: number, y: number) {
        this.plane = plane;
        this.x = x;
        this.y = y;
        this.gameObjects = [];
    }
}

export interface SceneObject {
    def: ObjectDefinition;
    type: number;
    sceneX: number;
    sceneY: number;
    sceneHeight: number;
    tag: bigint;
}

class FloorDecoration implements SceneObject {
    constructor(
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public renderable: Renderable,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition,
    ) {

    }
}

class WallObject implements SceneObject {
    constructor(
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public renderable0: Renderable | undefined,
        public renderable1: Renderable | undefined,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition,
    ) {

    }
}

class WallDecoration implements SceneObject {
    constructor(
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public renderable0: Renderable,
        public renderable1: Renderable | undefined,
        public offsetX: number,
        public offsetY: number,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition,
    ) {

    }
}

export class GameObject implements SceneObject {
    constructor(
        public plane: number,
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public renderable: Renderable,
        public startX: number,
        public startY: number,
        public endX: number,
        public endY: number,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition,
    ) {

    }
}

export class Scene {
    public static readonly MAX_PLANE = 4;

    public static readonly MAP_SIZE = 64;

    private static readonly displacementX: number[] = [1, 0, -1, 0];
    private static readonly displacementY: number[] = [0, -1, 0, 1];
    private static readonly diagonalDisplacementX: number[] = [1, -1, -1, 1];
    private static readonly diagonalDisplacementY: number[] = [-1, -1, 1, 1];

    regionX: number;

    regionY: number;

    planes: number;

    sizeX: number;

    sizeY: number;

    tiles: SceneTile[][][];

    collisionMaps: CollisionMap[];

    tileHeights: Int32Array[][];

    tileRenderFlags: Uint8Array[][];

    tileUnderlays: Uint16Array[][];

    tileOverlays: Int16Array[][];

    tileShapes: Uint8Array[][];

    tileRotations: Uint8Array[][];

    varps: Map<number, number>;
    varbits: Map<number, number>;

    constructor(regionX: number, regionY: number, planes: number, sizeX: number, sizeY: number) {
        this.regionX = regionX;
        this.regionY = regionY;
        this.planes = planes;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.tiles = new Array(planes);
        this.collisionMaps = new Array(this.planes);
        this.tileHeights = new Array(this.planes);
        this.tileRenderFlags = new Array(this.planes);
        this.tileUnderlays = new Array(this.planes);
        this.tileOverlays = new Array(this.planes);
        this.tileShapes = new Array(this.planes);
        this.tileRotations = new Array(this.planes);
        this.varps = new Map();
        this.varbits = new Map();
        for (let plane = 0; plane < planes; plane++) {
            this.tiles[plane] = new Array(sizeX);
            this.collisionMaps[plane] = new CollisionMap(sizeX, sizeY);
            this.tileHeights[plane] = new Array(this.sizeX + 1);
            this.tileRenderFlags[plane] = new Array(this.sizeX);
            this.tileUnderlays[plane] = new Array(this.sizeX);
            this.tileOverlays[plane] = new Array(this.sizeX);
            this.tileShapes[plane] = new Array(this.sizeX);
            this.tileRotations[plane] = new Array(this.sizeX);
            for (let x = 0; x < sizeX; x++) {
                this.tiles[plane][x] = new Array(sizeY);
                this.tileRenderFlags[plane][x] = new Uint8Array(this.sizeY);
                this.tileUnderlays[plane][x] = new Uint16Array(this.sizeY);
                this.tileOverlays[plane][x] = new Int16Array(this.sizeY);
                this.tileShapes[plane][x] = new Uint8Array(this.sizeY);
                this.tileRotations[plane][x] = new Uint8Array(this.sizeY);
            }
            for (let x = 0; x < sizeX + 1; x++) {
                this.tileHeights[plane][x] = new Int32Array(sizeY);
            }
        }
    }

    ensureTileExists(startPlane: number, endPlane: number, tileX: number, tileY: number) {
        for (let i = startPlane; i <= endPlane; i++) {
            if (!this.tiles[i][tileX][tileY]) {
                this.tiles[i][tileX][tileY] = new SceneTile(i, tileX, tileY);
            }
        }
    }

    newFloorDecoration(plane: number, tileX: number, tileY: number, sceneHeight: number, renderable: Renderable | undefined, tag: bigint,
        type: number, def: ObjectDefinition) {
        if (renderable) {
            const sceneX = tileX * 128 + 64;
            const sceneY = tileY * 128 + 64;

            const floorDec = new FloorDecoration(sceneX, sceneY, sceneHeight, renderable, tag, type, def);

            this.ensureTileExists(plane, plane, tileX, tileY);

            this.tiles[plane][tileX][tileY].floorDecoration = floorDec;
        }
    }

    newWall(plane: number, tileX: number, tileY: number, sceneHeight: number, renderable0: Renderable | undefined, renderable1: Renderable | undefined, tag: bigint,
        type: number, def: ObjectDefinition) {
        if (renderable0 || renderable1) {
            const sceneX = tileX * 128 + 64;
            const sceneY = tileY * 128 + 64;

            const wall = new WallObject(sceneX, sceneY, sceneHeight, renderable0, renderable1, tag, type, def);

            this.ensureTileExists(0, plane, tileX, tileY);

            this.tiles[plane][tileX][tileY].wallObject = wall;
        }
    }

    newWallDecoration(plane: number, tileX: number, tileY: number, sceneHeight: number, renderable0: Renderable | undefined, renderable1: Renderable | undefined,
        offsetX: number, offsetY: number, tag: bigint, type: number, def: ObjectDefinition) {
        if (renderable0) {
            const sceneX = tileX * 128 + 64;
            const sceneY = tileY * 128 + 64;

            const wallDecoration = new WallDecoration(sceneX, sceneY, sceneHeight, renderable0, renderable1, offsetX, offsetY, tag, type, def);

            this.ensureTileExists(0, plane, tileX, tileY);

            this.tiles[plane][tileX][tileY].wallDecoration = wallDecoration;
        }
    }

    newGameObject(plane: number, tileX: number, tileY: number, sceneHeight: number, sizeX: number, sizeY: number, renderable: Renderable | undefined, tag: bigint,
        type: number, def: ObjectDefinition): boolean {
        if (!renderable) {
            return true;
        }
        const sceneX = tileX * 128 + sizeX * 64;
        const sceneY = tileY * 128 + sizeY * 64;

        const startX = tileX;
        const startY = tileY;
        const endX = tileX + sizeX - 1;
        const endY = tileY + sizeY - 1;

        const gameObject = new GameObject(plane, sceneX, sceneY, sceneHeight, renderable, startX, startY, endX, endY, tag, type, def);

        for (let x = tileX; x < tileX + sizeX; x++) {
            for (let y = tileY; y < tileY + sizeY; y++) {
                if (x < 0 || y < 0 || x >= this.sizeX || y >= this.sizeY) {
                    return false;
                }

                this.ensureTileExists(0, plane, x, y);

                this.tiles[plane][x][y].gameObjects.push(gameObject);
            }
        }

        return true;
    }

    updateWallDecorationDisplacement(plane: number, tileX: number, tileY: number, displacement: number) {
        const tile = this.tiles[plane][tileX][tileY];
        if (tile && tile.wallDecoration) {
            const decor = tile.wallDecoration;
            decor.offsetX = (displacement * decor.offsetX / 16) | 0;
            decor.offsetY = (displacement * decor.offsetY / 16) | 0;
        }
    }

    getWallObjectTag(plane: number, tileX: number, tileY: number): bigint {
        const tile = this.tiles[plane][tileX][tileY];
        return (tile && tile.wallObject && tile.wallObject.tag) || 0n;
    }

    transformObject(regionLoader: RegionLoader, def: ObjectDefinition): ObjectDefinition | undefined {
        if (def.transforms && def.transforms.length > 0) {
            let transformIndex: number | undefined = undefined;
            if (def.transformVarbit !== -1) {
                transformIndex = this.varbits.get(def.transformVarbit);
            } else if (def.transformVarp !== -1) {
                transformIndex = this.varps.get(def.transformVarp);
            }
            if (transformIndex === undefined) {
                transformIndex = def.transforms.findIndex(id => id !== -1);
                if (transformIndex !== -1) {
                    if (def.transformVarbit !== -1) {
                        this.varbits.set(def.transformVarbit, transformIndex);
                    } else if (def.transformVarp !== -1) {
                        this.varps.set(def.transformVarp, transformIndex);
                    }
                }
            }
            if (transformIndex === -1) {
                return undefined;
            }
            const transformId = def.transforms[transformIndex];
            if (transformId === -1) {
                return undefined;
            }
            return regionLoader.getObjectDef(transformId);
        }
        return def;
    }

    addObject(regionLoader: RegionLoader, modelLoader: ObjectModelLoader, objOcclusionOnly: boolean, expandedTileHeights: Int32Array[][],
        plane: number, tileX: number, tileY: number, objectId: number, rotation: number, type: number) {

        const def = regionLoader.getObjectDef(objectId);
        const defTransform = this.transformObject(regionLoader, def);

        if (!defTransform) {
            return;
        }

        const baseX = this.regionX * 64;
        const baseY = this.regionY * 64;

        // if (def.animationId === -1) {
        //     return;
        // }

        let sizeX = def.sizeX;
        let sizeY = def.sizeY;
        if (rotation == 1 || rotation == 3) {
            sizeX = def.sizeY;
            sizeY = def.sizeX;
        }

        const heightMapSize = expandedTileHeights[0].length;

        let startX: number;
        let endX: number;
        if (sizeX + tileX < heightMapSize) {
            startX = (sizeX >> 1) + tileX;
            endX = (sizeX + 1 >> 1) + tileX;
        } else {
            startX = tileX;
            endX = tileX + 1;
        }

        let startY: number;
        let endY: number;
        if (sizeY + tileY < heightMapSize) {
            startY = (sizeY >> 1) + tileY;
            endY = tileY + (sizeY + 1 >> 1);
        } else {
            startY = tileY;
            endY = tileY + 1;
        }

        const heightMap = expandedTileHeights[plane];
        const centerHeight = heightMap[endX][endY] + heightMap[startX][endY] + heightMap[startX][startY] + heightMap[endX][startY] >> 2;
        const sceneX = (tileX << 7) + (sizeX << 6);
        const sceneY = (tileY << 7) + (sizeY << 6);

        let tag = 0n;

        if (!objOcclusionOnly) {
            tag = calculateEntityTag(tileX, tileY, EntityType.OBJECT, def.int1 === 0, objectId);
        }

        const isDynamic = def.animationId !== -1 || !!def.transforms;

        const contourGroundInfo: ContourGroundInfo = { heightMap, sceneX, sceneHeight: centerHeight, sceneY };

        if (type === ObjectType.FLOOR_DECORATION) {
            if (!objOcclusionOnly) {
                let renderable: Renderable | undefined;
                if (def.animationId === -1) {
                    renderable = modelLoader.getObjectModel(defTransform, type, rotation, contourGroundInfo);
                } else {
                    renderable = new AnimatedObject(def.id, type, rotation, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                }

                this.newFloorDecoration(plane, tileX, tileY, centerHeight, renderable, tag, type, def);
            }
        } else if (type !== ObjectType.OBJECT && type !== ObjectType.OBJECT_DIAGIONAL) {
            // roofs
            if (type >= ObjectType.ROOF_SLOPED) {
                if (!objOcclusionOnly) {
                    let renderable: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable = modelLoader.getObjectModel(defTransform, type, rotation, contourGroundInfo);
                    } else {
                        renderable = new AnimatedObject(def.id, type, rotation, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    this.newGameObject(plane, tileX, tileY, centerHeight, 1, 1, renderable, tag, type, def);
                }
            } else if (type === ObjectType.WALL) {
                if (!objOcclusionOnly) {
                    let renderable: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable = modelLoader.getObjectModel(defTransform, type, rotation, contourGroundInfo);
                    } else {
                        renderable = new AnimatedObject(def.id, type, rotation, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    this.newWall(plane, tileX, tileY, centerHeight, renderable, undefined, tag, type, def);

                    if (def.decorDisplacement != ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT) {
                        this.updateWallDecorationDisplacement(plane, tileX, tileY, def.decorDisplacement);
                    }
                }

                if (rotation === 0) {
                    if (def.clipped) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX, baseY + tileY, plane, 50);
                        regionLoader.setObjectLightOcclusion(baseX + tileX, baseY + tileY + 1, plane, 50);
                    }
                } else if (rotation === 1) {
                    if (def.clipped) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX, baseY + tileY + 1, plane, 50);
                        regionLoader.setObjectLightOcclusion(baseX + tileX + 1, baseY + tileY + 1, plane, 50);
                    }
                } else if (rotation === 2) {
                    if (def.clipped) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX + 1, baseY + tileY, plane, 50);
                        regionLoader.setObjectLightOcclusion(baseX + tileX + 1, baseY + tileY + 1, plane, 50);
                    }
                } else if (rotation === 3) {
                    if (def.clipped) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX, baseY + tileY, plane, 50);
                        regionLoader.setObjectLightOcclusion(baseX + tileX + 1, baseY + tileY, plane, 50);
                    }
                }
            } else if (type === ObjectType.WALL_TRI_CORNER) {
                if (!objOcclusionOnly) {
                    let renderable: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable = modelLoader.getObjectModel(defTransform, type, rotation, contourGroundInfo);
                    } else {
                        renderable = new AnimatedObject(def.id, type, rotation, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    this.newWall(plane, tileX, tileY, centerHeight, renderable, undefined, tag, type, def);
                }

                if (def.clipped) {
                    if (rotation === 0) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX, baseY + tileY + 1, plane, 50);
                    } else if (rotation === 1) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX + 1, baseY + tileY + 1, plane, 50);
                    } else if (rotation === 2) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX + 1, baseY + tileY, plane, 50);
                    } else if (rotation === 3) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX, baseY + tileY, plane, 50);
                    }
                }
            } else if (type === ObjectType.WALL_CORNER) {
                if (!objOcclusionOnly) {
                    let renderable0: Renderable | undefined;
                    let renderable1: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable0 = modelLoader.getObjectModel(defTransform, type, rotation + 4, contourGroundInfo);
                        renderable1 = modelLoader.getObjectModel(defTransform, type, rotation + 1 & 3, contourGroundInfo);
                    } else {
                        renderable0 = new AnimatedObject(def.id, type, rotation + 4, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                        renderable1 = new AnimatedObject(def.id, type, rotation + 1 & 3, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    this.newWall(plane, tileX, tileY, centerHeight, renderable0, renderable1, tag, type, def);

                    if (def.decorDisplacement != ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT) {
                        this.updateWallDecorationDisplacement(plane, tileX, tileY, def.decorDisplacement);
                    }
                }
            } else if (type === ObjectType.WALL_RECT_CORNER) {
                if (!objOcclusionOnly) {
                    let renderable: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable = modelLoader.getObjectModel(defTransform, type, rotation, contourGroundInfo);
                    } else {
                        renderable = new AnimatedObject(def.id, type, rotation, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    this.newWall(plane, tileX, tileY, centerHeight, renderable, undefined, tag, type, def);
                }

                if (def.clipped) {
                    if (rotation === 0) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX, baseY + tileY + 1, plane, 50);
                    } else if (rotation === 1) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX + 1, baseY + tileY + 1, plane, 50);
                    } else if (rotation === 2) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX + 1, baseY + tileY, plane, 50);
                    } else if (rotation === 3) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX, baseY + tileY, plane, 50);
                    }
                }
            } else if (type === ObjectType.WALL_DIAGONAL) {
                if (!objOcclusionOnly) {
                    let renderable: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable = modelLoader.getObjectModel(defTransform, type, rotation, contourGroundInfo);
                    } else {
                        renderable = new AnimatedObject(def.id, type, rotation, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    this.newGameObject(plane, tileX, tileY, centerHeight, 1, 1, renderable, tag, type, def);

                    if (def.decorDisplacement != ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT) {
                        this.updateWallDecorationDisplacement(plane, tileX, tileY, def.decorDisplacement);
                    }
                }
            } else if (type === ObjectType.WALL_DECORATION_INSIDE) {
                if (!objOcclusionOnly) {
                    let renderable: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable = modelLoader.getObjectModel(defTransform, ObjectType.WALL_DECORATION_INSIDE, rotation, contourGroundInfo);
                    } else {
                        renderable = new AnimatedObject(def.id, ObjectType.WALL_DECORATION_INSIDE, rotation, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    this.newWallDecoration(plane, tileX, tileY, centerHeight, renderable, undefined, 0, 0, tag, type, def);

                    if (def.decorDisplacement != ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT) {
                        this.updateWallDecorationDisplacement(plane, tileX, tileY, def.decorDisplacement);
                    }
                }
            } else if (type === ObjectType.WALL_DECORATION_OUTSIDE) {
                if (!objOcclusionOnly) {
                    let displacement = ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT;
                    const wallTag = this.getWallObjectTag(plane, tileX, tileY);
                    if (wallTag !== 0n) {
                        displacement = regionLoader.getObjectDef(getIdFromEntityTag(wallTag)).decorDisplacement;
                    }

                    let renderable: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable = modelLoader.getObjectModel(defTransform, ObjectType.WALL_DECORATION_INSIDE, rotation, contourGroundInfo);
                    } else {
                        renderable = new AnimatedObject(def.id, ObjectType.WALL_DECORATION_INSIDE, rotation, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    const displacementX = displacement * Scene.displacementX[rotation];
                    const displacementY = displacement * Scene.displacementY[rotation];

                    this.newWallDecoration(plane, tileX, tileY, centerHeight, renderable, undefined, displacementX, displacementY, tag, type, def);
                }
            } else if (type === ObjectType.WALL_DECORATION_DIAGONAL_OUTSIDE) {
                if (!objOcclusionOnly) {
                    let displacement = ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT / 2;
                    const wallTag = this.getWallObjectTag(plane, tileX, tileY);
                    if (wallTag !== 0n) {
                        displacement = regionLoader.getObjectDef(getIdFromEntityTag(wallTag)).decorDisplacement / 2;
                    }

                    let renderable: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable = modelLoader.getObjectModel(defTransform, ObjectType.WALL_DECORATION_INSIDE, rotation + 4, contourGroundInfo);
                    } else {
                        renderable = new AnimatedObject(def.id, ObjectType.WALL_DECORATION_INSIDE, rotation + 4, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    const displacementX = displacement * Scene.diagonalDisplacementX[rotation];
                    const displacementY = displacement * Scene.diagonalDisplacementY[rotation];

                    this.newWallDecoration(plane, tileX, tileY, centerHeight, renderable, undefined, displacementX, displacementY, tag, type, def);
                }
            } else if (type === ObjectType.WALL_DECORATION_DIAGONAL_INSIDE) {
                if (!objOcclusionOnly) {
                    const insideRotation = rotation + 2 & 3;

                    let renderable: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable = modelLoader.getObjectModel(defTransform, ObjectType.WALL_DECORATION_INSIDE, insideRotation + 4, contourGroundInfo);
                    } else {
                        renderable = new AnimatedObject(def.id, ObjectType.WALL_DECORATION_INSIDE, insideRotation + 4, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    this.newWallDecoration(plane, tileX, tileY, centerHeight, renderable, undefined, 0, 0, tag, type, def);
                }
            } else if (type === ObjectType.WALL_DECORATION_DIAGONAL_DOUBLE) {
                if (!objOcclusionOnly) {
                    let displacement = ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT / 2;
                    const wallTag = this.getWallObjectTag(plane, tileX, tileY);
                    if (wallTag !== 0n) {
                        displacement = regionLoader.getObjectDef(getIdFromEntityTag(wallTag)).decorDisplacement / 2;
                    }

                    const insideRotation = rotation + 2 & 3;

                    let renderable0: Renderable | undefined;
                    let renderable1: Renderable | undefined;
                    if (def.animationId === -1) {
                        renderable0 = modelLoader.getObjectModel(defTransform, ObjectType.WALL_DECORATION_INSIDE, rotation + 4, contourGroundInfo);
                        renderable1 = modelLoader.getObjectModel(defTransform, ObjectType.WALL_DECORATION_INSIDE, insideRotation + 4, contourGroundInfo);
                    } else {
                        renderable0 = new AnimatedObject(def.id, ObjectType.WALL_DECORATION_INSIDE, rotation + 4, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                        renderable1 = new AnimatedObject(def.id, ObjectType.WALL_DECORATION_INSIDE, insideRotation + 4, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
                    }

                    const displacementX = displacement * Scene.diagonalDisplacementX[rotation];
                    const displacementY = displacement * Scene.diagonalDisplacementY[rotation];

                    this.newWallDecoration(plane, tileX, tileY, centerHeight, renderable0, renderable1, displacementX, displacementY, tag, type, def);
                }
            }
        } else if (objOcclusionOnly) {
            if (def.clipped && (tileX + sizeX >= 63 || tileY + sizeY >= 63 || tileX <= 1 || tileY <= 1)) {
                let lightOcclusion = 15;

                if (def.animationId === -1 && !def.mergeNormals) {
                    const model = modelLoader.getObjectModel(defTransform, type, rotation, contourGroundInfo);
                    if (model instanceof Model) {
                        lightOcclusion = model.getXZRadius() / 4 | 0;
                        if (lightOcclusion > 30) {
                            lightOcclusion = 30;
                        }
                    }
                }

                for (let sx = 0; sx <= sizeX; sx++) {
                    for (let sy = 0; sy <= sizeY; sy++) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX + sx, baseY + tileY + sy, plane, lightOcclusion);
                    }
                }
            }
        } else {
            // if (def.animationId !== -1) {
            //     return;
            // }
            let renderable: Renderable | undefined;
            if (def.animationId === -1) {
                renderable = modelLoader.getObjectModel(defTransform, type, rotation, contourGroundInfo);
            } else {
                renderable = new AnimatedObject(def.id, type, rotation, plane, tileX, tileY, def.animationId, def.randomAnimStartFrame);
            }
            // const model = modelLoader.getObjectModel(defTransform, type, rotation, heightMap, sceneX, centerHeight, sceneY);

            if (renderable && this.newGameObject(plane, tileX, tileY, centerHeight, sizeX, sizeY, renderable, tag, type, def) && def.clipped) {
                let lightOcclusion = 15;
                if (renderable instanceof Model && def.animationId === -1) {
                    lightOcclusion = renderable.getXZRadius() / 4 | 0;
                    if (lightOcclusion > 30) {
                        lightOcclusion = 30;
                    }
                }

                for (let sx = 0; sx <= sizeX; sx++) {
                    for (let sy = 0; sy <= sizeY; sy++) {
                        regionLoader.setObjectLightOcclusion(baseX + tileX + sx, baseY + tileY + sy, plane, lightOcclusion);
                    }
                }
            }
        }
    }

    mergeLargeObjectNormals(model: ModelData, startPlane: number, tileX: number, tileY: number, sizeX: number, sizeY: number) {
        let hideOccludedFaces = true;
        let startX = tileX;
        const endX = tileX + sizeX;
        const startY = tileY - 1;
        const endY = tileY + sizeY;

        for (let plane = startPlane; plane <= startPlane + 1; plane++) {
            if (plane === this.planes) {
                continue;
            }

            for (let localX = startX; localX <= endX; localX++) {
                if (localX >= 0 && localX < this.sizeX) {
                    for (let localY = startY; localY <= endY; localY++) {
                        if (localY >= 0 && localY < this.sizeY && (!hideOccludedFaces || localX >= endX || localY >= endY || localY < tileY && tileX != localX)) {
                            const tile = this.tiles[plane][localX][localY];
                            if (tile) {
                                const var16 = ((this.tileHeights[plane][localX + 1][localY] + this.tileHeights[plane][localX + 1][localY + 1] + this.tileHeights[plane][localX][localY] + this.tileHeights[plane][localX][localY + 1]) / 4 | 0) - ((this.tileHeights[startPlane][tileX + 1][tileY] + this.tileHeights[startPlane][tileX][tileY] + this.tileHeights[startPlane][tileX + 1][tileY + 1] + this.tileHeights[startPlane][tileX][tileY + 1]) / 4 | 0);
                                const wall = tile.wallObject;
                                if (wall) {
                                    if (wall.renderable0 instanceof ModelData) {
                                        ModelData.mergeNormals(model, wall.renderable0, (1 - sizeX) * 64 + (localX - tileX) * 128, var16, (localY - tileY) * 128 + (1 - sizeY) * 64, hideOccludedFaces);
                                    }
                                    if (wall.renderable1 instanceof ModelData) {
                                        ModelData.mergeNormals(model, wall.renderable1, (1 - sizeX) * 64 + (localX - tileX) * 128, var16, (localY - tileY) * 128 + (1 - sizeY) * 64, hideOccludedFaces);
                                    }
                                }

                                for (const gameObject of tile.gameObjects) {
                                    if (gameObject.renderable instanceof ModelData) {
                                        const var21 = gameObject.endX - gameObject.startX + 1;
                                        const var22 = gameObject.endY - gameObject.startY + 1;
                                        ModelData.mergeNormals(model, gameObject.renderable, (var21 - sizeX) * 64 + (gameObject.startX - tileX) * 128, var16, (gameObject.startY - tileY) * 128 + (var22 - sizeY) * 64, hideOccludedFaces);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            --startX;
            hideOccludedFaces = false;
        }
    }

    mergeFloorNormals(model: ModelData, plane: number, tileX: number, tileY: number) {
        if (tileX < this.sizeX - 1) {
            const tile = this.tiles[plane][tileX + 1][tileY];
            if (tile && tile.floorDecoration && tile.floorDecoration.renderable instanceof ModelData) {
                ModelData.mergeNormals(model, tile.floorDecoration.renderable, 128, 0, 0, true);
            }
        }

        if (tileY < this.sizeY - 1) {
            const tile = this.tiles[plane][tileX][tileY + 1];
            if (tile && tile.floorDecoration && tile.floorDecoration.renderable instanceof ModelData) {
                ModelData.mergeNormals(model, tile.floorDecoration.renderable, 0, 0, 128, true);
            }
        }

        if (tileX < this.sizeX - 1 && tileY < this.sizeY - 1) {
            const tile = this.tiles[plane][tileX + 1][tileY + 1];
            if (tile && tile.floorDecoration && tile.floorDecoration.renderable instanceof ModelData) {
                ModelData.mergeNormals(model, tile.floorDecoration.renderable, 128, 0, 128, true);
            }
        }

        if (tileX < this.sizeX - 1 && tileY > 0) {
            const tile = this.tiles[plane][tileX + 1][tileY - 1];
            if (tile && tile.floorDecoration && tile.floorDecoration.renderable instanceof ModelData) {
                ModelData.mergeNormals(model, tile.floorDecoration.renderable, 128, 0, -128, true);
            }
        }

    }

    applyLighting(lightX: number, lightY: number, lightZ: number) {
        for (let plane = 0; plane < this.planes; plane++) {
            for (let tileX = 0; tileX < this.sizeX; tileX++) {
                for (let tileY = 0; tileY < this.sizeY; tileY++) {
                    const tile = this.tiles[plane][tileX][tileY];
                    if (!tile) {
                        continue;
                    }
                    const wall = tile.wallObject;
                    if (wall && wall.renderable0 instanceof ModelData) {
                        const model0 = wall.renderable0;
                        this.mergeLargeObjectNormals(model0, plane, tileX, tileY, 1, 1);

                        if (wall.renderable1 instanceof ModelData) {
                            const model1 = wall.renderable1;
                            this.mergeLargeObjectNormals(model1, plane, tileX, tileY, 1, 1);
                            ModelData.mergeNormals(model0, model1, 0, 0, 0, false);
                            wall.renderable1 = model1.light(model1.ambient, model1.contrast, lightX, lightY, lightZ);
                        }

                        wall.renderable0 = model0.light(model0.ambient, model0.contrast, lightX, lightY, lightZ);
                    }

                    for (const gameObject of tile.gameObjects) {
                        if (gameObject.renderable instanceof ModelData) {
                            this.mergeLargeObjectNormals(gameObject.renderable, plane, tileX, tileY, gameObject.endX - gameObject.startX + 1, gameObject.endY - gameObject.startY + 1);
                            gameObject.renderable = gameObject.renderable.light(gameObject.renderable.ambient, gameObject.renderable.contrast, lightX, lightY, lightZ);
                        }
                    }

                    const floorDecoration = tile.floorDecoration;
                    if (floorDecoration && floorDecoration.renderable instanceof ModelData) {
                        this.mergeFloorNormals(floorDecoration.renderable, plane, tileX, tileY);
                        floorDecoration.renderable = floorDecoration.renderable.light(floorDecoration.renderable.ambient, floorDecoration.renderable.contrast, lightX, lightY, lightZ);
                    }
                }
            }
        }
    }

    decodeLandscape(regionLoader: RegionLoader, objectModelLoader: ObjectModelLoader, data: Int8Array, objOcclusionOnly: boolean = false): void {
        // Needed for larger objects that spill over to the neighboring regions
        const expandedTileHeights = regionLoader.loadHeightMap(this.regionX, this.regionY, 72);

        const buffer = new ByteBuffer(data);

        let id = -1;
        let idDelta: number;
        while ((idDelta = buffer.readSmart3()) !== 0) {
            id += idDelta;

            let pos = 0;
            let posDelta: number;
            while ((posDelta = buffer.readUnsignedSmart()) !== 0) {
                pos += posDelta - 1;

                const localX = (pos >> 6 & 0x3f);
                const localY = (pos & 0x3f);
                const plane = pos >> 12;

                const attributes = buffer.readUnsignedByte();

                const type = attributes >> 2;
                const rotation = attributes & 0x3;

                this.addObject(regionLoader, objectModelLoader, objOcclusionOnly, expandedTileHeights, plane, localX, localY, id, rotation, type);
            }
        }
    }

    readTerrainValue(buffer: ByteBuffer, newFormat: boolean, signed: boolean = false) {
        if (newFormat) {
            return signed ? buffer.readShort() : buffer.readUnsignedShort();
        } else {
            return signed ? buffer.readByte() : buffer.readUnsignedByte();
        }
    }

    decodeTerrain(data: Int8Array, offsetX: number, offsetY: number, baseX: number, baseY: number): void {
        const buffer = new ByteBuffer(data);

        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            for (let x = 0; x < Scene.MAP_SIZE; x++) {
                for (let y = 0; y < Scene.MAP_SIZE; y++) {
                    this.decodeTile(buffer, plane, x + offsetX, y + offsetY, baseX, baseY, 0);
                }
            }
        }
    }

    decodeTile(buffer: ByteBuffer, plane: number, x: number, y: number, baseX: number, baseY: number, rotationOffset: number, newFormat: boolean = true): void {
        if (x >= 0 && x < this.sizeX && y >= 0 && y < this.sizeY) {
            this.tileRenderFlags[plane][x][y] = 0;

            while (true) {
                const v = this.readTerrainValue(buffer, newFormat);
                if (v === 0) {
                    if (plane == 0) {
                        const actualX = x + baseX + 932731;
                        const actualY = y + baseY + 556238;
                        this.tileHeights[plane][x][y] = -generateHeight(actualX, actualY) * 8;
                    } else {
                        this.tileHeights[plane][x][y] = this.tileHeights[plane - 1][x][y] - 240;
                    }
                    break;
                }

                if (v === 1) {
                    let height = buffer.readUnsignedByte();
                    if (height === 1) {
                        height = 0;
                    }

                    if (plane === 0) {
                        this.tileHeights[0][x][y] = -height * 8;
                    } else {
                        this.tileHeights[plane][x][y] = this.tileHeights[plane - 1][x][y] - height * 8;
                    }
                    break;
                }

                if (v <= 49) {
                    this.tileOverlays[plane][x][y] = this.readTerrainValue(buffer, newFormat);
                    this.tileShapes[plane][x][y] = (v - 2) / 4;
                    this.tileRotations[plane][x][y] = v - 2 + rotationOffset & 3;
                } else if (v <= 81) {
                    this.tileRenderFlags[plane][x][y] = v - 49;
                } else {
                    this.tileUnderlays[plane][x][y] = v - 81;
                }
            }
        } else {
            while (true) {
                const v = this.readTerrainValue(buffer, newFormat);
                if (v === 0) {
                    break;
                }

                if (v === 1) {
                    buffer.readUnsignedByte();
                    break;
                }

                if (v <= 49) {
                    this.readTerrainValue(buffer, newFormat);
                }
            }
        }
    }

    newTileModel(plane: number, tileX: number, tileY: number, tileModel: SceneTileModel) {
        this.ensureTileExists(plane, plane, tileX, tileY);

        this.tiles[plane][tileX][tileY].tileModel = tileModel;
    }

    addTileModels(regionLoader: RegionLoader, textureProvider: TextureLoader) {
        const baseX = this.regionX * 64;
        const baseY = this.regionY * 64;

        const heights = this.tileHeights;
        const underlayIds = this.tileUnderlays;
        const overlayIds = this.tileOverlays;
        const tileShapes = this.tileShapes;
        const tileRotations = this.tileRotations;

        // console.time(`blend region ${regionX}_${regionY}`);
        const blendedColors = regionLoader.getBlendedUnderlayColors(this.regionX, this.regionY);
        // console.timeEnd(`blend region ${regionX}_${regionY}`);

        // console.time(`light region ${regionX}_${regionY}`);
        const lightLevels = regionLoader.getLightLevels(this.regionX, this.regionY);
        // console.timeEnd(`light region ${regionX}_${regionY}`);

        console.time('terrain');

        for (let plane = 0; plane < this.planes; plane++) {
            for (let x = 0; x < this.sizeX; x++) {
                for (let y = 0; y < this.sizeY; y++) {
                    const underlayId = underlayIds[plane][x][y] - 1;

                    const overlayId = overlayIds[plane][x][y] - 1;

                    if (underlayId == -1 && overlayId == -1) {
                        continue;
                    }

                    const heightSw = heights[plane][x][y];
                    let heightSe: number;
                    let heightNe: number;
                    let heightNw: number;

                    const lightSw = lightLevels[plane][x][y];
                    let lightSe: number;
                    let lightNe: number;
                    let lightNw: number;

                    if (x === Scene.MAP_SIZE - 1 || y === Scene.MAP_SIZE - 1) {
                        heightSe = regionLoader.getHeight(baseX + x + 1, baseY + y, plane);
                        heightNe = regionLoader.getHeight(baseX + x + 1, baseY + y + 1, plane);
                        heightNw = regionLoader.getHeight(baseX + x, baseY + y + 1, plane);

                        lightSe = regionLoader.getLightLevel(baseX + x + 1, baseY + y, plane);
                        lightNe = regionLoader.getLightLevel(baseX + x + 1, baseY + y + 1, plane);
                        lightNw = regionLoader.getLightLevel(baseX + x, baseY + y + 1, plane);
                    } else {
                        heightSe = heights[plane][x + 1][y];
                        heightNe = heights[plane][x + 1][y + 1];
                        heightNw = heights[plane][x][y + 1];

                        lightSe = lightLevels[plane][x + 1][y];
                        lightNe = lightLevels[plane][x + 1][y + 1];
                        lightNw = lightLevels[plane][x][y + 1];
                    }

                    let underlayHsl = -1;
                    if (underlayId !== -1) {
                        underlayHsl = blendedColors[plane][x][y];
                    }

                    let tileModel: SceneTileModel;
                    if (overlayId == -1) {
                        tileModel = new SceneTileModel(0, 0, -1, x, y, heightSw, heightSe, heightNe, heightNw,
                                adjustUnderlayLight(underlayHsl, lightSw), adjustUnderlayLight(underlayHsl, lightSe),
                                adjustUnderlayLight(underlayHsl, lightNe), adjustUnderlayLight(underlayHsl, lightNw),
                                0, 0, 0, 0)
                    } else {
                        const shape = tileShapes[plane][x][y] + 1;
                        const rotation = tileRotations[plane][x][y];

                        const overlay = regionLoader.getOverlayDef(overlayId);

                        const textureId = textureProvider.getTextureIndex(overlay.textureId) || -1;
                        let overlayHsl: number;
                        if (textureId !== -1) {
                            overlayHsl = -1;
                        } else if (overlay.primaryRgb == 0xFF00FF) {
                            overlayHsl = -2;
                        } else {
                            overlayHsl = packHsl(overlay.hue, overlay.saturation, overlay.lightness);
                        }

                        tileModel = new SceneTileModel(shape, rotation, textureId, x, y, heightSw, heightSe, heightNe, heightNw,
                                adjustUnderlayLight(underlayHsl, lightSw), adjustUnderlayLight(underlayHsl, lightSe),
                                adjustUnderlayLight(underlayHsl, lightNe), adjustUnderlayLight(underlayHsl, lightNw),
                                adjustOverlayLight(overlayHsl, lightSw), adjustOverlayLight(overlayHsl, lightSe),
                                adjustOverlayLight(overlayHsl, lightNe), adjustOverlayLight(overlayHsl, lightNw))
                    }

                    this.newTileModel(plane, x, y, tileModel);
                }
            }
        }

        console.timeEnd('terrain');
    }

}
