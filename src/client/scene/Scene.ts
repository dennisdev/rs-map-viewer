import { COSINE, generateHeight } from "../Client";
import { CollisionMap } from "./CollisionMap";
import { ObjectDefinition } from "../fs/definition/ObjectDefinition";
import { ModelLoader } from "../fs/loader/ModelLoader";
import { Model } from "../model/Model";
import { ModelData } from "../model/ModelData";
import { RegionLoader } from "../RegionLoader";
import { ByteBuffer } from "../util/ByteBuffer";
import { AnimationLoader } from "../fs/loader/AnimationLoader";
import { AnimationDefinition } from "../fs/definition/AnimationDefinition";
import { AnimationFrameMapLoader } from "../fs/loader/AnimationFrameMapLoader";
import { Renderable } from "./Renderable";
import { AnimatedObject } from "./AnimatedObject";

class SceneTile {
    plane: number;

    x: number;

    y: number;

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

enum EntityType {
    OBJECT = 2
}

function calculateEntityTag(tileX: number, tileY: number, entityType: EntityType, notInteractive: boolean, id: number): bigint {
    let tag = BigInt(tileX & 0x7F) | BigInt(tileY & 0x7F) << 7n | BigInt(entityType & 3) << 14n | BigInt(id) << 17n;
    if (notInteractive) {
        tag |= 0x10000n;
    }
    return tag;
}

function getIdFromEntityTag(tag: bigint) {
    return Number(tag >> 17n);
}

enum ObjectType {
    WALL = 0,
    WALL_TRI_CORNER = 1,
    WALL_CORNER = 2,
    WALL_RECT_CORNER = 3,

    WALL_DECORATION_INSIDE = 4,
    WALL_DECORATION_OUTSIDE = 5,
    WALL_DECORATION_DIAGONAL_OUTSIDE = 6,
    WALL_DECORATION_DIAGONAL_INSIDE = 7,
    WALL_DECORATION_DIAGONAL_DOUBLE = 8,

    WALL_DIAGONAL = 9,

    OBJECT = 10,
    OBJECT_DIAGIONAL = 11,

    ROOF_SLOPED = 12,
    ROOF_SLOPED_OUTER_CORNER = 13,
    ROOF_SLOPED_INNER_CORNER = 14,
    ROOF_SLOPED_HARD_INNER_CORNER = 15,
    ROOF_SLOPED_HARD_OUTER_CORNER = 16,
    ROOF_FLAT = 17,
    ROOF_SLOPED_OVERHANG = 18,
    ROOF_SLOPED_OVERHANG_OUTER_CORNER = 19,
    ROOF_SLOPED_OVERHANG_INNER_CORNER = 20,
    ROOF_SLOPED_OVERHANG_HARD_OUTER_CORNER = 21,

    FLOOR_DECORATION = 22,
}

export class ObjectModelLoader {
    static mergeObjectModelsCache: ModelData[] = new Array(4);

    modelLoader: ModelLoader;

    animationLoader: AnimationLoader;

    animationFrameMapLoader: AnimationFrameMapLoader;

    modelDataCache: Map<number, ModelData>;

    modelCache: Map<number, Model | ModelData>;

    constructor(modelLoader: ModelLoader, animationLoader: AnimationLoader, animationFrameMapLoader: AnimationFrameMapLoader) {
        this.modelLoader = modelLoader;
        this.animationLoader = animationLoader;
        this.modelDataCache = new Map();
        this.modelCache = new Map();
        this.animationFrameMapLoader = animationFrameMapLoader;
    }

    getModelData(id: number, mirrored: boolean): ModelData | undefined {
        let key = id;
        if (mirrored) {
            key += 0x10000;
        }
        let model = this.modelDataCache.get(key);
        if (!model) {
            model = this.modelLoader.getModel(id);
            if (model) {
                if (mirrored) {
                    model.mirror();
                }
                this.modelDataCache.set(key, model);
            }
        }
        return model;
    }

    getObjectModelData(def: ObjectDefinition, type: number, rotation: number): ModelData | undefined {
        let model: ModelData | undefined;
        const isDiagonalObject = type === ObjectType.OBJECT_DIAGIONAL;
        if (isDiagonalObject) {
            type = ObjectType.OBJECT;
        }
        if (!def.objectTypes) {
            if (type !== ObjectType.OBJECT) {
                return undefined;
            }

            if (!def.objectModels) {
                return undefined;
            }

            const isMirrored = def.isRotated;

            const modelCount = def.objectModels.length;

            for (let i = 0; i < modelCount; i++) {
                let modelId = def.objectModels[i];

                model = this.getModelData(modelId, isMirrored);
                if (!model) {
                    return undefined;
                }

                if (modelCount > 1) {
                    ObjectModelLoader.mergeObjectModelsCache[i] = model;
                }
            }

            if (modelCount > 1) {
                model = ModelData.merge(ObjectModelLoader.mergeObjectModelsCache, modelCount);
            }
        } else {
            let index = -1;

            for (let i = 0; i < def.objectTypes.length; i++) {
                if (def.objectTypes[i] === type) {
                    index = i;
                    break;
                }
            }

            if (index === -1) {
                return undefined;
            }

            let modelId = def.objectModels[index];
            const isMirrored = def.isRotated !== rotation > 3;

            model = this.getModelData(modelId, isMirrored);
        }

        if (!model) {
            return undefined;
        }

        const hasResize = def.modelSizeX !== 128 || def.modelSizeHeight !== 128 || def.modelSizeY !== 128;

        const hasOffset = def.offsetX !== 0 || def.offsetHeight !== 0 || def.offsetY !== 0;

        const copy = ModelData.copyFrom(model, true, rotation === 0 && !hasResize && !hasOffset && !isDiagonalObject, !def.recolorFrom, !def.retextureFrom);

        if (type === ObjectType.WALL_DECORATION_INSIDE && rotation > 3) {
            copy.rotate(256);
            copy.translate(45, 0, -45);
        } else if (isDiagonalObject) {
            copy.rotate(256);
        }

        rotation &= 3;
        if (rotation === 1) {
            copy.rotate90();
        } else if (rotation === 2) {
            copy.rotate180();
        } else if (rotation === 3) {
            copy.rotate270();
        }

        if (def.recolorFrom) {
            for (let i = 0; i < def.recolorFrom.length; i++) {
                copy.recolor(def.recolorFrom[i], def.recolorTo[i]);
            }
        }

        if (def.retextureFrom) {
            for (let i = 0; i < def.retextureFrom.length; i++) {
                copy.retexture(def.retextureFrom[i], def.retextureTo[i]);
            }
        }

        if (hasResize) {
            copy.resize(def.modelSizeX, def.modelSizeHeight, def.modelSizeY);
        }

        if (hasOffset) {
            copy.translate(def.offsetX, def.offsetHeight, def.offsetY);
        }

        return copy;
    }

    getObjectModel(def: ObjectDefinition, type: number, rotation: number, contourGroundInfo?: ContourGroundInfo): Model | ModelData | undefined {
        // if (def.animationId !== -1) {
        //     return this.getObjectModelAnimated(def, type, rotation);
        //     // return undefined;
        // }

        let key: number;
        if (def.objectTypes) {
            key = rotation + (type << 3) + (def.id << 10);
        } else {
            key = rotation + (def.id << 10);
        }

        let model = this.modelCache.get(key);
        if (!model) {
            const modelData = this.getObjectModelData(def, type, rotation);
            if (!modelData) {
                return undefined;
            }

            if (!def.mergeNormals) {
                model = modelData.light(def.ambient + 64, def.contrast + 768, -50, -10, -50);
            } else {
                modelData.ambient = def.ambient + 64;
                modelData.contrast = def.contrast + 768;
                modelData.calculateVertexNormals();

                model = modelData;
            }

            this.modelCache.set(key, model);
        }

        if (def.mergeNormals) {
            model = (model as ModelData).copy();
        }

        if (def.contouredGround >= 0 && contourGroundInfo) {
            model = model.contourGround(contourGroundInfo.heightMap, contourGroundInfo.sceneX, contourGroundInfo.sceneHeight, contourGroundInfo.sceneY, true, def.contouredGround);
        }

        return model;
    }

    getObjectModelAnimated(def: ObjectDefinition, type: number, rotation: number, animationId: number, frame: number): Model | undefined {
        let key: number;
        if (def.objectTypes) {
            key = rotation + (type << 3) + (def.id << 10);
        } else {
            key = rotation + (def.id << 10);
        }

        let model = this.modelCache.get(key);
        if (!model) {
            const modelData = this.getObjectModelData(def, type, rotation);
            if (!modelData) {
                return undefined;
            }

            model = modelData.light(def.ambient + 64, def.contrast + 768, -50, -10, -50);

            this.modelCache.set(key, model);
        } else if (model instanceof Model) {
            return model;
        } else {
            throw new Error('Model is not lit');
        }

        const anim = this.animationLoader.getDefinition(animationId);
        if (anim) {
            model = this.transformObjectModel(model, anim, frame, rotation);
        }

        // if (def.contouredGround >= 0) {
        //     model = model.contourGround(heightMap, sceneX, sceneHeight, sceneY, true, def.contouredGround);
        // }

        return model;
    }

    transformObjectModel(model: Model, anim: AnimationDefinition, frame: number, rotation: number): Model {
        if (anim.isAnimMaya()) {
            return model;
        }
        if (!anim.frameIds || anim.frameIds.length === 0) {
            return model;
        }
        // if (anim.frameIds.length === 9) {
        //     console.log(anim);
        // }
        frame = anim.frameIds[frame];
        const animFrameMap = this.animationFrameMapLoader.getFrameMap(frame >> 16);
        frame &= 0xFFFF;

        if (animFrameMap) {
            rotation &= 3;
            if (rotation === 1) {
                model.rotate270();
            } else if (rotation === 2) {
                model.rotate180();
            } else if (rotation === 3) {
                model.rotate90();
            }

            model.animate(animFrameMap.frames[frame]);

            if (rotation === 1) {
                model.rotate90();
            } else if (rotation === 2) {
                model.rotate180();
            } else if (rotation === 3) {
                model.rotate270();
            }
        }

        return model;
    }
}

type ContourGroundInfo = {
    heightMap: Int32Array[];
    sceneX: number;
    sceneHeight: number;
    sceneY: number;
};

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

}
