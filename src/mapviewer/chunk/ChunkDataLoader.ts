import { ObjectDefinition } from "../../client/fs/definition/ObjectDefinition";
import { TextureLoader } from "../../client/fs/loader/TextureLoader";
import { Model } from "../../client/model/Model";
import { RegionLoader } from "../../client/RegionLoader";
import { GameObject, Scene, SceneObject, SceneTile } from "../../client/scene/Scene";
import { AnimatedObject } from "../../client/scene/AnimatedObject";
import { vec3 } from "gl-matrix";
import { ObjectModelLoader } from "../../client/scene/ObjectModelLoader";
import { getModelHash, ModelHashBuffer } from "../buffer/ModelHashBuffer";
import { addModel, addTerrain, ContourGroundType, DrawCommand, DrawData, getModelFaces, RenderBuffer } from "../buffer/RenderBuffer";
import { createOcclusionMap, OcclusionMap } from "./LodOcclusionMap";

export type ChunkData = {
    regionX: number,
    regionY: number,
    vertices: Uint8Array,
    indices: Int32Array,
    modelTextureData: Int32Array,
    heightMapTextureData: Float32Array,
    drawRanges: MultiDrawCommand[];
    drawRangesLowDetail: MultiDrawCommand[];
};

type MultiDrawCommand = [number, number, number];

function newMultiDrawCommand(offset: number, elements: number, instances: number): MultiDrawCommand {
    return [offset, elements, instances];
}

type DrawRangeSingle = [number, number];
type DrawRangeInstanced = [number, number, number];

type DrawRange = DrawRangeSingle | DrawRangeInstanced;

function newDrawRange(offset: number, elements: number, instances: number): DrawRange {
    if (instances === 1) {
        return [offset, elements];
    } else {
        return [offset, elements, instances];
    }
}

type ObjectModel = {
    model: Model,
    lowDetail: boolean,
    sceneHeight: number,
} & DrawData;

type AnimatedSceneModel = {
    models: Model[],

} & DrawData;

function isLowDetail(type: number, def: ObjectDefinition, localX: number, localY: number, plane: number, occlusionMap: OcclusionMap): boolean {
    // if (1) {
    //     return false;
    // }
    // floor decorations
    if (type === 22 && def.int1 === 0 && def.clipType != 1 && !def.obstructsGround) {
        return true;
    }
    if ((type === 10 || type === 11 || type >= 4 && type <= 8) && def.int1 === 1) {
        return occlusionMap.isOccluded(plane, localX | 0, localY | 0);
    }
    // if (def.animationId !== -1) {
    //     return true;
    // }
    return false;
}


function sceneObjectToObjectModel(model: Model, sceneObject: SceneObject, offsetX: number, offsetY: number,
    tileX: number, tileY: number, plane: number, priority: number, occlusionMap: OcclusionMap): ObjectModel {
    const def = sceneObject.def;

    const sceneX = sceneObject.sceneX + offsetX;
    const sceneY = sceneObject.sceneY + offsetY;
    const sceneHeight = sceneObject.sceneHeight;

    // const lowDetail = isLowDetail2(sceneObject.type, def);
    const lowDetail = isLowDetail(sceneObject.type, def, tileX, tileY, plane, occlusionMap);
    // const lowDetail = false;

    let contourGround = ContourGroundType.CENTER_TILE;
    if (def.contouredGround >= 0) {
        contourGround = ContourGroundType.VERTEX;
    }

    return {
        model,
        lowDetail,
        sceneHeight,
        sceneX,
        sceneY,
        plane,
        contourGround,
        priority
    };
}

function getObjectsFromScene(objectModelLoader: ObjectModelLoader, scene: Scene, occlusionMap: OcclusionMap): ObjectModel[] {
    const models: ObjectModel[] = [];

    const gameObjects: Set<GameObject> = new Set();

    for (let plane = 0; plane < scene.planes; plane++) {
        for (let tileX = 0; tileX < scene.sizeX; tileX++) {
            for (let tileY = 0; tileY < scene.sizeY; tileY++) {
                const tile = scene.tiles[plane][tileX][tileY];
                if (!tile) {
                    continue;
                }

                if (tile.floorDecoration) {
                    if (tile.floorDecoration.renderable instanceof Model) {
                        models.push(sceneObjectToObjectModel(tile.floorDecoration.renderable, tile.floorDecoration, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    } else if (tile.floorDecoration.renderable instanceof AnimatedObject && tile.floorDecoration.renderable.model) {
                        models.push(sceneObjectToObjectModel(tile.floorDecoration.renderable.model, tile.floorDecoration, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    }
                }

                if (tile.wallObject) {
                    if (tile.wallObject.renderable0 instanceof Model) {
                        models.push(sceneObjectToObjectModel(tile.wallObject.renderable0, tile.wallObject, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    } else if (tile.wallObject.renderable0 instanceof AnimatedObject && tile.wallObject.renderable0.model) {
                        models.push(sceneObjectToObjectModel(tile.wallObject.renderable0.model, tile.wallObject, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    }
                    if (tile.wallObject.renderable1 instanceof Model) {
                        models.push(sceneObjectToObjectModel(tile.wallObject.renderable1, tile.wallObject, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    } else if (tile.wallObject.renderable1 instanceof AnimatedObject && tile.wallObject.renderable1.model) {
                        models.push(sceneObjectToObjectModel(tile.wallObject.renderable1.model, tile.wallObject, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    }
                }

                if (tile.wallDecoration) {
                    const offsetX = tile.wallDecoration.offsetX;
                    const offsetY = tile.wallDecoration.offsetY;
                    if (tile.wallDecoration.renderable0 instanceof Model) {
                        models.push(sceneObjectToObjectModel(tile.wallDecoration.renderable0, tile.wallDecoration, offsetX, offsetY, tileX, tileY, plane, 10, occlusionMap));
                    } else if (tile.wallDecoration.renderable0 instanceof AnimatedObject && tile.wallDecoration.renderable0.model) {
                        models.push(sceneObjectToObjectModel(tile.wallDecoration.renderable0.model, tile.wallDecoration, offsetX, offsetY, tileX, tileY, plane, 10, occlusionMap));
                    }
                    if (tile.wallDecoration.renderable1 instanceof Model) {
                        models.push(sceneObjectToObjectModel(tile.wallDecoration.renderable1, tile.wallDecoration, 0, 0, tileX, tileY, plane, 10, occlusionMap));
                    } else if (tile.wallDecoration.renderable1 instanceof AnimatedObject && tile.wallDecoration.renderable1.model) {
                        models.push(sceneObjectToObjectModel(tile.wallDecoration.renderable1.model, tile.wallDecoration, 0, 0, tileX, tileY, plane, 10, occlusionMap));
                    }
                }

                for (const gameObject of tile.gameObjects) {
                    const renderable = gameObject.renderable;

                    if (gameObjects.has(gameObject)) {
                        continue;
                    }

                    if (renderable instanceof Model) {
                        models.push(sceneObjectToObjectModel(renderable, gameObject, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    } else if (renderable instanceof AnimatedObject && renderable.model) {
                        models.push(sceneObjectToObjectModel(renderable.model, gameObject, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    }
                    gameObjects.add(gameObject);
                }
            }
        }
    }

    return models;
}


function getUniqueObjects(modelDataBuf: ModelHashBuffer, objects: ObjectModel[]): ObjectModel[][] {
    const uniqueObjectsMap: Map<number, ObjectModel[]> = new Map();

    const modelMap: Map<Model, number> = new Map();

    for (const object of objects) {
        const model = object.model;

        if (model.faceCount === 0) {
            continue;
        }

        let hash = modelMap.get(model);

        if (hash === undefined) {
            hash = getModelHash(modelDataBuf, model);

            modelMap.set(model, hash);
        }

        const uniqueObjects = uniqueObjectsMap.get(hash);
        if (uniqueObjects) {
            uniqueObjects.push(object);
        } else {
            uniqueObjectsMap.set(hash, [object]);
        }
    }

    return Array.from(uniqueObjectsMap.values());
}

function getModelGroupId(lowDetail: boolean, alpha: boolean, plane: number, priority: number): number {
    return (lowDetail ? 1 : 0) | (alpha ? 1 : 0) << 1 | plane << 2 | priority << 4;
}

type ModelGroup = {
    merge: boolean,
    lowDetail: boolean,
    alpha: boolean,
    plane: number,
    priority: number,
    objects: ObjectModel[]
};

function createModelGroups(textureProvider: TextureLoader, uniqueObjects: ObjectModel[][], minimizeDrawCalls: boolean): ModelGroup[] {
    const groups: ModelGroup[] = [];

    const mergeGroups: Map<number, ModelGroup> = new Map();

    for (const uniqObject of uniqueObjects) {
        const model = uniqObject[0].model;

        const alpha = model.hasAlpha(textureProvider);

        const totalFaceCount = model.faceCount * uniqObject.length;

        let merge = uniqObject.length == 1 || totalFaceCount < 100 || minimizeDrawCalls;

        // merge = false;
        // merge = true;

        // in the future we can sort alpha objects every frame
        if (alpha && !minimizeDrawCalls && 0) {
            for (const object of uniqObject) {
                groups.push({ merge: true, lowDetail: false, alpha, plane: object.plane, priority: object.priority, objects: [object] });
            }
        } else if (merge) {
            for (const object of uniqObject) {
                const lowDetail = !alpha && object.lowDetail;

                const groupId = getModelGroupId(lowDetail, alpha, object.plane, object.priority);

                let group = mergeGroups.get(groupId);
                if (group === undefined) {
                    group = { merge, lowDetail, alpha, plane: object.plane, priority: object.priority, objects: [] };
                    mergeGroups.set(groupId, group);
                }
                group.objects.push(object);
            }
        } else {
            if (alpha) {
                groups.push({ merge, lowDetail: false, alpha, plane: 0, priority: 1, objects: uniqObject });
            } else {
                groups.push({ merge, lowDetail: false, alpha, plane: 0, priority: 1, objects: uniqObject.filter(obj => !obj.lowDetail) });
                groups.push({ merge, lowDetail: true, alpha, plane: 0, priority: 1, objects: uniqObject.filter(obj => obj.lowDetail) });
            }
        }
    }

    groups.push(...mergeGroups.values());

    return groups;
}

function addModelGroup(textureProvider: TextureLoader, renderBuf: RenderBuffer, modelGroup: ModelGroup) {
    const indexByteOffset = renderBuf.indexByteOffset();

    for (const object of modelGroup.objects) {
        const model = object.model;

        const faces = getModelFaces(textureProvider, model);

        if (faces.length === 0) {
            continue;
        }

        if (modelGroup.merge) {
            const offset: vec3 = [object.sceneX, object.sceneHeight, object.sceneY];
            addModel(renderBuf, model, faces, offset);
        } else {
            addModel(renderBuf, model, faces);
            break;
        }
    }

    const modelVertexCount = (renderBuf.indexByteOffset() - indexByteOffset) / 4;

    if (modelVertexCount > 0) {
        let datas: DrawData[];
        if (modelGroup.merge) {
            datas = [{ sceneX: 0, sceneY: 0, plane: modelGroup.plane, contourGround: ContourGroundType.NONE, priority: modelGroup.priority }];
        } else {
            datas = modelGroup.objects;
        }

        const commands = modelGroup.lowDetail ? renderBuf.drawCommandsLowDetail : renderBuf.drawCommands;

        commands.push({
            offset: indexByteOffset,
            elements: modelVertexCount,
            datas,
        });
    }
}


export class ChunkDataLoader {
    regionLoader: RegionLoader;

    objectModelLoader: ObjectModelLoader;

    textureProvider: TextureLoader;

    modelHashBuf: ModelHashBuffer;

    constructor(regionLoader: RegionLoader, objectModelLoader: ObjectModelLoader, textureProvider: TextureLoader) {
        this.regionLoader = regionLoader;
        this.objectModelLoader = objectModelLoader;
        this.textureProvider = textureProvider;
        this.modelHashBuf = new ModelHashBuffer(5000);
    }

    load(regionX: number, regionY: number, minimizeDrawCalls: boolean = false): ChunkData | undefined {
        const region = this.regionLoader.getRegion(regionX, regionY);
        if (!region) {
            return undefined;
        }

        console.time('read landscape data');
        const landscapeData = this.regionLoader.getLandscapeData(regionX, regionY);
        console.timeEnd('read landscape data');

        if (landscapeData) {
            console.time('load landscape');
            region.decodeLandscape(this.regionLoader, this.objectModelLoader, landscapeData);
            console.timeEnd('load landscape');
        }

        // Create scene tile models from map data
        region.addTileModels(this.regionLoader, this.textureProvider);

        const renderBuf = new RenderBuffer(100000);

        const terrainVertexCount = addTerrain(renderBuf, region);

        const loadAnimations = false;

        if (landscapeData) {
            console.time('light scene');
            region.applyLighting(-50, -10, -50);
            console.timeEnd('light scene');

            const occlusionMap = createOcclusionMap(region.tileRenderFlags, region.tileUnderlays, region.tileOverlays);
            // const occlusionMap = new OcclusionMap();

            const objects = getObjectsFromScene(this.objectModelLoader, region, occlusionMap);

            const uniqueObjects = getUniqueObjects(this.modelHashBuf, objects);

            // console.log('uniq models: ', uniqueObjects.length, uniqueObjects);

            const modelGroups = createModelGroups(this.textureProvider, uniqueObjects, minimizeDrawCalls);

            // alpha last, planes low to high
            modelGroups.sort((a, b) => (a.alpha ? 1 : 0) - (b.alpha ? 1 : 0)
                || (a.merge ? 0 : 1) - (b.merge ? 0 : 1)
                || (a.plane - b.plane));

            for (const modelGroup of modelGroups) {
                addModelGroup(this.textureProvider, renderBuf, modelGroup);
            }
        }

        const triangles = renderBuf.drawCommands.map(cmd => cmd.elements / 3 * cmd.datas.length).reduce((a, b) => a + b, 0);
        const lowDetailTriangles = renderBuf.drawCommandsLowDetail.map(cmd => cmd.elements / 3 * cmd.datas.length).reduce((a, b) => a + b, 0);
        const totalTriangles = triangles + lowDetailTriangles;


        const drawCommands: DrawCommand[] = [];
        drawCommands.push(...renderBuf.drawCommandsLowDetail);
        drawCommands.push(...renderBuf.drawCommands);

        // modelBuf.drawCommands.push(...modelBuf.drawCommandsLowDetail);


        const drawRanges: MultiDrawCommand[] = drawCommands.map(cmd => newMultiDrawCommand(cmd.offset, cmd.elements, cmd.datas.length));
        const drawRangesLowDetail = drawRanges.slice(renderBuf.drawCommandsLowDetail.length);

        const modelTextureData = createModelTextureData(drawCommands);
        const heightMapTextureData = loadHeightMapTextureData(this.regionLoader, regionX, regionY);
        

        const uniqTotalTriangles = drawCommands.map(cmd => cmd.elements / 3).reduce((a, b) => a + b, 0);
        const indexBufferBytes = renderBuf.indices.length * 4;
        const currentBytes = renderBuf.vertexBuf.byteOffset() + indexBufferBytes;

        console.log('total triangles', totalTriangles, 'low detail: ', triangles, 'uniq triangles: ', uniqTotalTriangles,
            'terrain verts: ', terrainVertexCount, 'total vertices: ', renderBuf.vertexBuf.offset, 'now: ', currentBytes, currentBytes - indexBufferBytes,
            'uniq vertices: ', renderBuf.vertexBuf.vertexIndices.size, 'data texture size: ', modelTextureData.length, 'draw calls: ', drawRanges.length,
            'indices: ', renderBuf.indices.length);

        return {
            regionX,
            regionY,
            vertices: renderBuf.vertexBuf.byteArray(),
            indices: new Int32Array(renderBuf.indices),
            modelTextureData,
            heightMapTextureData,
            drawRanges: drawRanges,
            drawRangesLowDetail: drawRangesLowDetail
        };
    }
}

function createModelTextureData(drawCommands: DrawCommand[]): Int32Array {
    const datas: DrawData[] = [];
    for (const cmd of drawCommands) {
        datas.push(...cmd.datas);
    }
    const dataCount = datas.length;

    const paddedModelDataLength = Math.ceil((drawCommands.length + dataCount) / 16) * 16;
    let dataOffset = 0;
    const modelTextureData = new Int32Array(paddedModelDataLength);
    drawCommands.forEach((cmd, index) => {
        modelTextureData[index] = (drawCommands.length + dataOffset);

        dataOffset += cmd.datas.length;
    })

    datas.forEach((data, index) => {
        // 4/128 precision
        const xEncoded = Math.round(data.sceneX / 4);
        const yEncoded = Math.round(data.sceneY / 4);
        const contourGround = data.contourGround;
        modelTextureData[drawCommands.length + index] = xEncoded << 20 | yEncoded << 8 | data.plane << 6 | contourGround << 4 | data.priority;
    });

    return modelTextureData;
}

function loadHeightMapTextureData(regionLoader: RegionLoader, regionX: number, regionY: number): Float32Array {
    const heightMapTextureData = new Float32Array(Scene.MAX_PLANE * 72 * 72);

    const baseX = regionX * 64;
    const baseY = regionY * 64;

    let dataIndex = 0;
    for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
        for (let y = 0; y < 72; y++) {
            for (let x = 0; x < 72; x++) {
                heightMapTextureData[dataIndex++] = (-regionLoader.getHeight(baseX + x, baseY + y, plane) / 8) | 0;
            }
        }
    }

    return heightMapTextureData;
}
