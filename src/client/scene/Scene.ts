import { ObjectDefinition } from "../fs/definition/ObjectDefinition";
import { ModelLoader } from "../fs/loader/ModelLoader";
import { Model } from "../model/Model";
import { ModelData } from "../model/ModelData";
import { RegionLoader } from "../RegionLoader";
import { ByteBuffer } from "../util/ByteBuffer";

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

class FloorDecoration {
    constructor(
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public model: Model | ModelData,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition,
    ) {

    }
}

class WallObject {
    constructor(
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public model0: Model | ModelData | undefined,
        public model1: Model | ModelData | undefined,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition,
    ) {

    }
}

class WallDecoration {
    constructor(
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public model0: Model | ModelData,
        public model1: Model | ModelData | undefined,
        public offsetX: number,
        public offsetY: number,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition,
    ) {

    }
}
/*

      var21.tag = tag;
      var21.flags = flags;
      var21.plane = plane;
      var21.centerX = sceneX;
      var21.centerY = sceneY;
      var21.z = centerHeight;
      var21.renderable = renderable;
      var21.orientation = orientation;
      var21.startX = tileX;
      var21.startY = tileY;
      var21.endX = tileX + sizeX - 1;
      var21.endY = tileY + sizeY - 1;
*/

export class GameObject {
    constructor(
        public plane: number,
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public model: Model | ModelData,
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

class SceneModel {
    // model: ModelData;

    // shouldMergeNormals: boolean;
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

const mergeObjectModelsCache: ModelData[] = new Array(4);

export class ObjectModelLoader {
    modelLoader: ModelLoader;

    modelDataCache: Map<number, ModelData>;

    modelCache: Map<number, Model | ModelData>;

    constructor(modelLoader: ModelLoader) {
        this.modelLoader = modelLoader;
        this.modelDataCache = new Map();
        this.modelCache = new Map();
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
                    mergeObjectModelsCache[i] = model;
                }
            }

            if (modelCount > 1) {
                model = ModelData.merge(mergeObjectModelsCache, modelCount);
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

        const copy = ModelData.copyFrom(model, true, rotation === 0 && !hasResize && !hasOffset, !def.recolorFrom, !def.retextureFrom);

        if (type === ObjectType.WALL_DECORATION_INSIDE && rotation > 3) {
            copy.rotate(256);
            copy.translate(45, 0, -45);
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

    getObjectModel(def: ObjectDefinition, type: number, rotation: number, heightMap: Int32Array[], 
        sceneX: number, sceneHeight: number, sceneY: number): Model | ModelData | undefined {
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
        
        if (def.contouredGround >= 0) {
            if (model instanceof Model) {
                model = (model as Model).contourGround(heightMap, sceneX, sceneHeight, sceneY, true, def.contouredGround);
            } else if (model instanceof ModelData) {
                model = (model as ModelData).contourGround(heightMap, sceneX, sceneHeight, sceneY, true, def.contouredGround);
            }
        }

        return model;
    }
}


export class Scene2 {
    private static readonly displacementX: number[] = [1, 0, -1, 0];
    private static readonly displacementY: number[] = [0, -1, 0, 1];
    private static readonly diagonalDisplacementX: number[] = [1, -1, -1, 1];
    private static readonly diagonalDisplacementY: number[] = [-1, -1, 1, 1];

    planes: number;

    sizeX: number;

    sizeY: number;

    tileHeights: Int32Array[][];

    tiles: SceneTile[][][];

    objectLightOcclusionMap: Uint8Array[][];

    constructor(planes: number, sizeX: number, sizeY: number, tileHeights: Int32Array[][]) {
        this.planes = planes;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.tileHeights = tileHeights;
        this.tiles = new Array(planes);
        this.objectLightOcclusionMap = new Array(planes);
        for (let plane = 0; plane < planes; plane++) {
            this.tiles[plane] = new Array(sizeX);
            this.objectLightOcclusionMap[plane] = new Array(sizeX);
            for (let x = 0; x < sizeX; x++) {
                this.tiles[plane][x] = new Array(sizeY);
                this.objectLightOcclusionMap[plane][x] = new Uint8Array(sizeY);
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

    newFloorDecoration(plane: number, tileX: number, tileY: number, sceneHeight: number, model: Model | ModelData | undefined, tag: bigint, 
        type: number, def: ObjectDefinition) {
        if (model) {
            const sceneX = tileX * 128 + 64;
            const sceneY = tileY * 128 + 64;

            const floorDec = new FloorDecoration(sceneX, sceneY, sceneHeight, model, tag, type, def);

            this.ensureTileExists(plane, plane, tileX, tileY);

            this.tiles[plane][tileX][tileY].floorDecoration = floorDec;
        }
    }

    newWall(plane: number, tileX: number, tileY: number, sceneHeight: number, model0: Model | ModelData | undefined, model1: Model | ModelData | undefined, tag: bigint, 
        type: number, def: ObjectDefinition) {
        if (model0 || model1) {
            const sceneX = tileX * 128 + 64;
            const sceneY = tileY * 128 + 64;

            const wall = new WallObject(sceneX, sceneY, sceneHeight, model0, model1, tag, type, def);

            this.ensureTileExists(0, plane, tileX, tileY);

            this.tiles[plane][tileX][tileY].wallObject = wall;
        }
    }

    newWallDecoration(plane: number, tileX: number, tileY: number, sceneHeight: number, model0: Model | ModelData | undefined, model1: Model | ModelData | undefined,
        offsetX: number, offsetY: number, tag: bigint, type: number, def: ObjectDefinition) {
        if (model0) {
            const sceneX = tileX * 128 + 64;
            const sceneY = tileY * 128 + 64;

            const wallDecoration = new WallDecoration(sceneX, sceneY, sceneHeight, model0, model1, offsetX, offsetY, tag, type, def);

            this.ensureTileExists(0, plane, tileX, tileY);

            this.tiles[plane][tileX][tileY].wallDecoration = wallDecoration;
        }
    }

    newGameObject(plane: number, tileX: number, tileY: number, sceneHeight: number, sizeX: number, sizeY: number, model: Model | ModelData | undefined, tag: bigint, 
        type: number, def: ObjectDefinition): boolean {
        if (!model) {
            return true;
        }
        const sceneX = tileX * 128 + sizeX * 64;
        const sceneY = tileY * 128 + sizeY * 64;

        const startX = tileX;
        const startY = tileY;
        const endX = tileX + sizeX - 1;
        const endY = tileY + sizeY - 1;

        const gameObject = new GameObject(plane, sceneX, sceneY, sceneHeight, model, startX, startY, endX, endY, tag, type, def);

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

    addObject(regionLoader: RegionLoader, modelLoader: ObjectModelLoader, plane: number, tileX: number, tileY: number, objectId: number, rotation: number, type: number) {
        const def = regionLoader.getObjectDef(objectId);

        let sizeX = def.sizeX;
        let sizeY = def.sizeY;
        if (rotation == 1 || rotation == 3) {
            sizeX = def.sizeY;
            sizeY = def.sizeX;
        }         

        const heightMapSize = this.tileHeights[0].length;

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

        const heightMap = this.tileHeights[plane];
        const centerHeight = heightMap[endX][endY] + heightMap[startX][endY] + heightMap[startX][startY] + heightMap[endX][startY] >> 2;
        const sceneX = (tileX << 7) + (sizeX << 6);
        const sceneY = (tileY << 7) + (sizeY << 6);

        
        // const centerHeight = heightMap[centerY][var14] + heightMap[centerX][var14] + heightMap[centerX][var13] + heightMap[centerY][var13] >> 2;

        const tag = calculateEntityTag(tileX, tileY, EntityType.OBJECT, def.int1 === 0, objectId);

        const isDynamic = def.animationId !== -1 || !!def.transforms;


        if (type === ObjectType.FLOOR_DECORATION) {
            const model = modelLoader.getObjectModel(def, type, rotation, heightMap, sceneX, centerHeight, sceneY);

            this.newFloorDecoration(plane, tileX, tileY, centerHeight, model, tag, type, def);
        } else if (type !== ObjectType.OBJECT && type !== ObjectType.OBJECT_DIAGIONAL) {
            // roofs
            if (type >= ObjectType.ROOF_SLOPED) {
                const model = modelLoader.getObjectModel(def, type, rotation, heightMap, sceneX, centerHeight, sceneY);

                this.newGameObject(plane, tileX, tileY, centerHeight, 1, 1, model, tag, type, def);
            } else if (type === ObjectType.WALL) {
                const model = modelLoader.getObjectModel(def, type, rotation, heightMap, sceneX, centerHeight, sceneY);

                this.newWall(plane, tileX, tileY, centerHeight, model, undefined, tag, type, def);

                if (def.decorDisplacement != ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT) {
                    this.updateWallDecorationDisplacement(plane, tileX, tileY, def.decorDisplacement);
                }
            } else if (type === ObjectType.WALL_TRI_CORNER) {
                const model = modelLoader.getObjectModel(def, type, rotation, heightMap, sceneX, centerHeight, sceneY);

                this.newWall(plane, tileX, tileY, centerHeight, model, undefined, tag, type, def);
            } else if (type === ObjectType.WALL_CORNER) {
                const model0 = modelLoader.getObjectModel(def, type, rotation + 4, heightMap, sceneX, centerHeight, sceneY);
                const model1 = modelLoader.getObjectModel(def, type, rotation + 1 & 3, heightMap, sceneX, centerHeight, sceneY);

                this.newWall(plane, tileX, tileY, centerHeight, model0, model1, tag, type, def);

                if (def.decorDisplacement != ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT) {
                    this.updateWallDecorationDisplacement(plane, tileX, tileY, def.decorDisplacement);
                }
            } else if (type === ObjectType.WALL_RECT_CORNER) {
                const model = modelLoader.getObjectModel(def, type, rotation, heightMap, sceneX, centerHeight, sceneY);

                this.newWall(plane, tileX, tileY, centerHeight, model, undefined, tag, type, def);
            } else if (type === ObjectType.WALL_DIAGONAL) {
                const model = modelLoader.getObjectModel(def, type, rotation, heightMap, sceneX, centerHeight, sceneY);

                this.newGameObject(plane, tileX, tileY, centerHeight, 1, 1, model, tag, type, def);

                if (def.decorDisplacement != ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT) {
                    this.updateWallDecorationDisplacement(plane, tileX, tileY, def.decorDisplacement);
                }
            } else if (type === ObjectType.WALL_DECORATION_INSIDE) {
                const model = modelLoader.getObjectModel(def, ObjectType.WALL_DECORATION_INSIDE, rotation, heightMap, sceneX, centerHeight, sceneY);

                this.newWallDecoration(plane, tileX, tileY, centerHeight, model, undefined, 0, 0, tag, type, def);

                if (def.decorDisplacement != ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT) {
                    this.updateWallDecorationDisplacement(plane, tileX, tileY, def.decorDisplacement);
                }
            } else if (type === ObjectType.WALL_DECORATION_OUTSIDE) {
                let displacement = ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT;
                const wallTag = this.getWallObjectTag(plane, tileX, tileY);
                if (wallTag !== 0n) {
                    displacement = regionLoader.getObjectDef(getIdFromEntityTag(wallTag)).decorDisplacement;
                }

                const model = modelLoader.getObjectModel(def, ObjectType.WALL_DECORATION_INSIDE, rotation, heightMap, sceneX, centerHeight, sceneY);

                const displacementX = displacement * Scene2.displacementX[rotation];
                const displacementY = displacement * Scene2.displacementY[rotation];

                this.newWallDecoration(plane, tileX, tileY, centerHeight, model, undefined, displacementX, displacementY, tag, type, def);
            } else if (type === ObjectType.WALL_DECORATION_DIAGONAL_OUTSIDE) {
                let displacement = ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT / 2;
                const wallTag = this.getWallObjectTag(plane, tileX, tileY);
                if (wallTag !== 0n) {
                    displacement = regionLoader.getObjectDef(getIdFromEntityTag(wallTag)).decorDisplacement / 2;
                }

                const model = modelLoader.getObjectModel(def, ObjectType.WALL_DECORATION_INSIDE, rotation + 4, heightMap, sceneX, centerHeight, sceneY);

                const displacementX = displacement * Scene2.diagonalDisplacementX[rotation];
                const displacementY = displacement * Scene2.diagonalDisplacementY[rotation];

                this.newWallDecoration(plane, tileX, tileY, centerHeight, model, undefined, displacementX, displacementY, tag, type, def);
            } else if (type === ObjectType.WALL_DECORATION_DIAGONAL_INSIDE) {
                const insideRotation = rotation + 2 & 3;

                const model = modelLoader.getObjectModel(def, ObjectType.WALL_DECORATION_INSIDE, insideRotation + 4, heightMap, sceneX, centerHeight, sceneY);

                this.newWallDecoration(plane, tileX, tileY, centerHeight, model, undefined, 0, 0, tag, type, def);
            } else if (type === ObjectType.WALL_DECORATION_DIAGONAL_DOUBLE) {
                let displacement = ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT / 2;
                const wallTag = this.getWallObjectTag(plane, tileX, tileY);
                if (wallTag !== 0n) {
                    displacement = regionLoader.getObjectDef(getIdFromEntityTag(wallTag)).decorDisplacement / 2;
                }

                const insideRotation = rotation + 2 & 3;

                const model0 = modelLoader.getObjectModel(def, ObjectType.WALL_DECORATION_INSIDE, rotation + 4, heightMap, sceneX, centerHeight, sceneY);
                const model1 = modelLoader.getObjectModel(def, ObjectType.WALL_DECORATION_INSIDE, insideRotation + 4, heightMap, sceneX, centerHeight, sceneY);

                const displacementX = displacement * Scene2.diagonalDisplacementX[rotation];
                const displacementY = displacement * Scene2.diagonalDisplacementY[rotation];

                this.newWallDecoration(plane, tileX, tileY, centerHeight, model0, model1, displacementX, displacementY, tag, type, def);
            }
        } else {
            const model = modelLoader.getObjectModel(def, ObjectType.OBJECT, rotation, heightMap, sceneX, centerHeight, sceneY);

            if (model && this.newGameObject(plane, tileX, tileY, centerHeight, sizeX, sizeY, model, tag, type, def) && def.clipped) {
                let lightOcclusion = 15;
                if (model instanceof Model) {
                    lightOcclusion = model.getXZRadius() / 4 | 0;
                    if (lightOcclusion > 30) {
                        lightOcclusion = 30;
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
                                    if (wall.model0 instanceof ModelData) {
                                        ModelData.mergeNormals(model, wall.model0, (1 - sizeX) * 64 + (localX - tileX) * 128, var16, (localY - tileY) * 128 + (1 - sizeY) * 64, hideOccludedFaces);
                                    }
                                    if (wall.model1 instanceof ModelData) {
                                        ModelData.mergeNormals(model, wall.model1, (1 - sizeX) * 64 + (localX - tileX) * 128, var16, (localY - tileY) * 128 + (1 - sizeY) * 64, hideOccludedFaces);
                                    }
                                }

                                for (const gameObject of tile.gameObjects) {
                                    if (gameObject.model instanceof ModelData) {
                                        const var21 = gameObject.endX - gameObject.startX + 1;
                                        const var22 = gameObject.endY - gameObject.startY + 1;
                                        ModelData.mergeNormals(model, gameObject.model, (var21 - sizeX) * 64 + (gameObject.startX - tileX) * 128, var16, (gameObject.startY - tileY) * 128 + (var22 - sizeY) * 64, hideOccludedFaces);
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
            if (tile && tile.floorDecoration && tile.floorDecoration.model instanceof ModelData) {
                ModelData.mergeNormals(model, tile.floorDecoration.model, 128, 0, 0, true);
            }
        }

        if (tileY < this.sizeY - 1) {
            const tile = this.tiles[plane][tileX][tileY + 1];
            if (tile && tile.floorDecoration && tile.floorDecoration.model instanceof ModelData) {
                ModelData.mergeNormals(model, tile.floorDecoration.model, 0, 0, 128, true);
            }
        }

        if (tileX < this.sizeX - 1 && tileY < this.sizeY - 1) {
            const tile = this.tiles[plane][tileX + 1][tileY + 1];
            if (tile && tile.floorDecoration && tile.floorDecoration.model instanceof ModelData) {
                ModelData.mergeNormals(model, tile.floorDecoration.model, 128, 0, 128, true);
            }
        }

        if (tileX < this.sizeX - 1 && tileY > 0) {
            const tile = this.tiles[plane][tileX + 1][tileY - 1];
            if (tile && tile.floorDecoration && tile.floorDecoration.model instanceof ModelData) {
                ModelData.mergeNormals(model, tile.floorDecoration.model, 128, 0, -128, true);
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
                    if (wall && wall.model0 instanceof ModelData) {
                        const model0 = wall.model0;
                        this.mergeLargeObjectNormals(model0, plane, tileX, tileY, 1, 1);

                        if (wall.model1 instanceof ModelData) {
                            const model1 = wall.model1;
                            this.mergeLargeObjectNormals(model1, plane, tileX, tileY, 1, 1);
                            ModelData.mergeNormals(model0, model1, 0, 0, 0, false);
                            wall.model1 = model1.light(model1.ambient, model1.contrast, lightX, lightY, lightZ);
                        }

                        wall.model0 = model0.light(model0.ambient, model0.contrast, lightX, lightY, lightZ);
                    }

                    for (const gameObject of tile.gameObjects) {
                        if (gameObject.model instanceof ModelData) {
                            this.mergeLargeObjectNormals(gameObject.model, plane, tileX, tileY, gameObject.endX - gameObject.startX + 1, gameObject.endY - gameObject.startY + 1);
                            gameObject.model = gameObject.model.light(gameObject.model.ambient, gameObject.model.contrast, lightX, lightY, lightZ);
                        }
                    }

                    const floorDecoration = tile.floorDecoration;
                    if (floorDecoration && floorDecoration.model instanceof ModelData) {
                        this.mergeFloorNormals(floorDecoration.model, plane, tileX, tileY);
                        floorDecoration.model = floorDecoration.model.light(floorDecoration.model.ambient, floorDecoration.model.contrast, lightX, lightY, lightZ);
                    }
                }
            }
        }
    }

    decodeLandscape(regionLoader: RegionLoader, objectModelLoader: ObjectModelLoader, data: Int8Array): void {
        const buffer = new ByteBuffer(data);

        let id = -1;
        let idDelta;
        while ((idDelta = buffer.readSmart3()) != 0) {
            id += idDelta;

            let pos = 0;
            let posDelta;
            while ((posDelta = buffer.readUnsignedSmart()) != 0) {
                pos += posDelta - 1;

                const localX = (pos >> 6 & 0x3f);
                const localY = (pos & 0x3f);
                const plane = pos >> 12;

                const attributes = buffer.readUnsignedByte();

                const type = attributes >> 2;
                const rotation = attributes & 0x3;

                this.addObject(regionLoader, objectModelLoader, plane, localX, localY, id, rotation, type);
            }
        }
    }
}
