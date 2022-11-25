import { ObjectDefinition } from "./client/fs/definition/ObjectDefinition";
import { TextureLoader } from "./client/fs/loader/TextureLoader";
import { Model, computeTextureCoords } from "./client/model/Model";
import { RegionLoader } from "./client/RegionLoader";
import { Scene } from "./client/Scene";
import { HSL_RGB_MAP, packHsl } from "./client/util/ColorUtil";
import { GameObject, ObjectModelLoader, Scene2, SceneObject } from "./client/scene/Scene";
import { Hasher } from "./client/util/Hasher";
import { FloatUtil } from "./client/util/FloatUtil";

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

type DrawData = {
    sceneX: number,
    sceneY: number,
    plane: number,
    contourGround: number,
    priority: number,
};

type ModelDrawData = {
    model: Model,
    def: ObjectDefinition,
    sceneHeight: number,
    isLowDetail: boolean,
    drawData: DrawData,
};

type DrawCommand = {
    offset: number;
    elements: number,
    datas: DrawData[],
};

type InstancedModel = {
    model: Model,
    datas: ModelDrawData[],
};

type ModelGroupModel = {
    faces: ModelFace[],
    data: ModelDrawData,
}

type ModelGroupMergeData = {
    plane: number
};

type ModelGroup = {
    models: ModelGroupModel[],
    lowDetail: boolean,
    mergeData?: ModelGroupMergeData,
};

class VertexBuffer {
    public static readonly VERTEX_STRIDE = 12;

    view: DataView;

    byteArray: Uint8Array;

    vertexOffset: number;

    vertexIndices: Map<number, number> = new Map();

    constructor(vertexCount: number, vertexOffset: number = 0) {
        this.view = new DataView(new ArrayBuffer(vertexCount * VertexBuffer.VERTEX_STRIDE));
        this.byteArray = new Uint8Array(this.view.buffer);
        this.vertexOffset = vertexOffset;
    }

    ensureSize(vertexCount: number) {
        const byteOffset = this.vertexOffset * VertexBuffer.VERTEX_STRIDE;
        if (byteOffset + vertexCount * VertexBuffer.VERTEX_STRIDE >= this.view.byteLength) {
            // double buffer size
            const newView = new DataView(new ArrayBuffer(this.view.byteLength * 2));
            const newByteArray = new Uint8Array(newView.buffer);
            newByteArray.set(this.byteArray, 0);
            this.view = newView;
            this.byteArray = newByteArray;
        }
    }

    addVertex(x: number, y: number, z: number, rgb: number, hsl: number, alpha: number, u: number, v: number, textureId: number, priority: number,
        reuseVertex: boolean = true) {
        this.ensureSize(1);
        const vertexBufIndex = this.vertexOffset * VertexBuffer.VERTEX_STRIDE;

        if (textureId !== -1) {
            // only light
            hsl = (hsl & 127);
        }

        const v0 = ((x + 0x4000) << 17) | (FloatUtil.packFloat6(u) << 11) | FloatUtil.packFloat11(v);

        const v1 = (hsl << 16) | (alpha << 8) | ((textureId + 1) << 1) | (priority & 0x1);

        const v2 = ((z + 0x4000) << 17) | ((-y + 0x400) << 3) | (priority >> 1);

        if (reuseVertex) {
            const hash = v0 * v1 * v2;
            // const hash = BigInt(v0) << 64n | BigInt(v1) << 32n | BigInt(v2);
            // const hash = Hasher.hash(this.byteArray.subarray(vertexBufIndex, vertexBufIndex + VertexBuffer.VERTEX_STRIDE));
            const cachedIndex = this.vertexIndices.get(hash);
            if (cachedIndex !== undefined) {
                return cachedIndex;
            } else {
                this.vertexIndices.set(hash, this.vertexOffset);
            }
        }

        this.view.setInt32(vertexBufIndex, v0, true);
        this.view.setInt32(vertexBufIndex + 4, v1, true);
        this.view.setInt32(vertexBufIndex + 8, v2, true);

        return this.vertexOffset++;
    }
}

function isLowDetail(type: number, def: ObjectDefinition, localX: number, localY: number, plane: number, occlusionMap: boolean[][][]): boolean {
    // floor decorations
    if (type === 22 && def.int1 === 0 && def.clipType != 1 && !def.obstructsGround) {
        return true;
    }
    if ((type === 10 || type === 11 || type >= 4 && type <= 8) && def.int1 === 1) {
        return occlusionMap[plane][localX | 0][localY | 0];
    }
    if (def.animationId !== -1) {
        return true;
    }
    return false;
}

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

function addModel(buf: VertexBuffer, indices: number[] | undefined, model: Model, faces: ModelFace[], data: ModelDrawData | undefined, useScenePos: boolean, reuseVertices: boolean) {
    const verticesX = model.verticesX;
    let verticesY = model.verticesY;
    const verticesZ = model.verticesZ;

    let sceneX = 0;
    let sceneY = 0;
    let sceneHeight = 0;
    if (data && useScenePos) {
        sceneX = data.drawData.sceneX;
        sceneY = data.drawData.sceneY;
        sceneHeight = data.sceneHeight;
        if (model.contourVerticesY) {
            verticesY = model.contourVerticesY;
        }
    }

    const facesA = model.indices1;
    const facesB = model.indices2;
    const facesC = model.indices3;

    const modelTexCoords = computeTextureCoords(model);

    for (const face of faces) {
        const f = face.index;
        const faceAlpha = face.alpha;
        const priority = face.priority;
        const textureId = face.textureId;

        let hslA = model.faceColors1[f];
        let hslB = model.faceColors2[f];
        let hslC = model.faceColors3[f];

        if (hslC == -1) {
            hslC = hslB = hslA;
        }

        let u0: number = 0;
        let v0: number = 0;
        let u1: number = 0;
        let v1: number = 0;
        let u2: number = 0;
        let v2: number = 0;

        if (modelTexCoords) {
            const texCoordIdx = f * 6;
            u0 = modelTexCoords[texCoordIdx];
            v0 = modelTexCoords[texCoordIdx + 1];
            u1 = modelTexCoords[texCoordIdx + 2];
            v1 = modelTexCoords[texCoordIdx + 3];
            u2 = modelTexCoords[texCoordIdx + 4];
            v2 = modelTexCoords[texCoordIdx + 5];

            // emulate wrapS: PicoGL.CLAMP_TO_EDGE
            u0 = clamp(u0, 0.00390625 * 3, 1 - 0.00390625 * 3);
            u1 = clamp(u1, 0.00390625 * 3, 1 - 0.00390625 * 3);
            u2 = clamp(u2, 0.00390625 * 3, 1 - 0.00390625 * 3);
        }

        let rgbA = HSL_RGB_MAP[hslA];
        let rgbB = HSL_RGB_MAP[hslB];
        let rgbC = HSL_RGB_MAP[hslC];

        // const SCALE = 128;
        const fa = facesA[f];
        const fb = facesB[f];
        const fc = facesC[f];

        const vxa = sceneX + verticesX[fa];
        const vxb = sceneX + verticesX[fb];
        const vxc = sceneX + verticesX[fc];

        const vya = sceneHeight + verticesY[fa];
        const vyb = sceneHeight + verticesY[fb];
        const vyc = sceneHeight + verticesY[fc];

        const vza = sceneY + verticesZ[fa];
        const vzb = sceneY + verticesZ[fb];
        const vzc = sceneY + verticesZ[fc];

        const index0 = buf.addVertex(vxa, vya, vza, rgbA, hslA, faceAlpha, u0, v0, textureId, priority + 1, reuseVertices);
        const index1 = buf.addVertex(vxb, vyb, vzb, rgbB, hslB, faceAlpha, u1, v1, textureId, priority + 1, reuseVertices);
        const index2 = buf.addVertex(vxc, vyc, vzc, rgbC, hslC, faceAlpha, u2, v2, textureId, priority + 1, reuseVertices);

        if (indices) {
            indices.push(
                index0,
                index1,
                index2,
            );
        }
    }
}

type ModelFace = {
    index: number,
    alpha: number,
    priority: number,
    textureId: number
};

function getModelFaces(model: Model, textureProvider: TextureLoader): ModelFace[] {
    const faces: ModelFace[] = [];

    const faceAlphas = model.faceAlphas;

    const priorities = model.faceRenderPriorities;

    for (let f = 0; f < model.faceCount; f++) {
        let faceAlpha = (faceAlphas && (0xFF - (faceAlphas[f] & 0xFF))) || 0xFF;

        if (faceAlpha === 0 || faceAlpha === 0x1) {
            continue;
        }

        let hslC = model.faceColors3[f];

        if (hslC == -2) {
            continue;
        }

        const priority = (priorities && priorities[f]) || 0;

        let textureId = -1;
        if (model.faceTextures) {
            textureId = model.faceTextures[f];
        }

        let textureIndex = textureProvider.getTextureIndex(textureId);
        if (textureIndex === undefined) {
            textureIndex = -1;
        }

        faces.push({ index: f, alpha: faceAlpha, priority, textureId: textureIndex });
    }

    return faces;
}

function addModelGroup(modelGroup: ModelGroup, vertexBuf: VertexBuffer, indices: number[], drawCommands: DrawCommand[], drawCommandsLowDetail: DrawCommand[],
    reuseVertices: boolean) {
    const indexOffset = indices.length * 4;

    if (modelGroup.mergeData) {
        for (const { faces, data } of modelGroup.models) {
            addModel(vertexBuf, indices, data.model, faces, data, true, reuseVertices);
        }
    } else {
        // Only 1 model required
        for (const { faces, data } of modelGroup.models) {
            addModel(vertexBuf, indices, data.model, faces, undefined, false, reuseVertices);
            break;
        }
    }

    const modelVertexCount = (indices.length * 4 - indexOffset) / 4;

    if (modelVertexCount === 0) {
        return;
    }

    const commands = modelGroup.lowDetail ? drawCommandsLowDetail : drawCommands;

    if (modelGroup.mergeData) {
        commands.push({
            offset: indexOffset,
            elements: modelVertexCount,
            datas: [{ sceneX: 0, sceneY: 0, plane: modelGroup.mergeData.plane, contourGround: 2, priority: 1 }],
        });
    } else {
        commands.push({
            offset: indexOffset,
            elements: modelVertexCount,
            datas: modelGroup.models.map(model => model.data.drawData),
        });
    }
};

function sceneObjectToInstancedModel(model: Model, sceneObject: SceneObject, offsetX: number, offsetY: number,
    tileX: number, tileY: number, plane: number, priority: number, occlusionMap: boolean[][][]): InstancedModel {
    const def = sceneObject.def;

    const sceneX = sceneObject.sceneX + offsetX;
    const sceneY = sceneObject.sceneY + offsetY;
    const sceneHeight = sceneObject.sceneHeight;

    const lowDetail = isLowDetail(sceneObject.type, def, tileX, tileY, plane, occlusionMap);

    const contourGround = Math.min(def.contouredGround + 1, 1);

    return {
        model,
        datas: [{ model, def, sceneHeight, isLowDetail: lowDetail, drawData: { sceneX, sceneY, plane, contourGround, priority } }],
    };
}

function createOcclusionMap(renderFlags: Uint8Array[][], underlayIds: Uint16Array[][], overlayIds: Int16Array[][]): boolean[][][] {
    const occlusionMap: boolean[][][] = new Array(Scene.MAX_PLANE);
    for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
        occlusionMap[plane] = new Array(Scene.MAP_SIZE);
        for (let x = 0; x < Scene.MAP_SIZE; x++) {
            occlusionMap[plane][x] = new Array(Scene.MAP_SIZE).fill(false);
        }
    }

    for (let x = 0; x < Scene.MAP_SIZE; x++) {
        for (let y = 0; y < Scene.MAP_SIZE; y++) {
            let occluded = false;
            for (let plane = Scene.MAX_PLANE - 1; plane >= 0; plane--) {
                occlusionMap[plane][x][y] = occluded;
                const underlayId = underlayIds[plane][x][y];
                const overlayId = overlayIds[plane][x][y];
                // everything below a roof or tile can be occluded
                if ((renderFlags[plane][x][y] & 16) != 0 || underlayId || overlayId) {
                    occluded = true;
                }
            }
        }
    }
    return occlusionMap;
}

function getModelsFromScene(scene: Scene2, occlusionMap: boolean[][][]): InstancedModel[] {
    const models: InstancedModel[] = [];

    const gameObjects: Set<GameObject> = new Set();

    for (let plane = 0; plane < scene.planes; plane++) {
        for (let tileX = 0; tileX < scene.sizeX; tileX++) {
            for (let tileY = 0; tileY < scene.sizeY; tileY++) {
                const tile = scene.tiles[plane][tileX][tileY];
                if (!tile) {
                    continue;
                }

                if (tile.floorDecoration) {
                    for (const model of tile.floorDecoration.getModels()) {
                        models.push(sceneObjectToInstancedModel(model, tile.floorDecoration, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    }
                }

                if (tile.wallObject) {
                    for (const model of tile.wallObject.getModels()) {
                        models.push(sceneObjectToInstancedModel(model, tile.wallObject, 0, 0, tileX, tileY, plane, 1, occlusionMap));
                    }
                }

                if (tile.wallDecoration) {
                    if (tile.wallDecoration.model0 instanceof Model) {
                        const offsetX = tile.wallDecoration.offsetX;
                        const offsetY = tile.wallDecoration.offsetY;
                        models.push(sceneObjectToInstancedModel(tile.wallDecoration.model0, tile.wallDecoration, offsetX, offsetY, tileX, tileY, plane, 2, occlusionMap));
                    }
                    if (tile.wallDecoration.model1 instanceof Model) {
                        models.push(sceneObjectToInstancedModel(tile.wallDecoration.model1, tile.wallDecoration, 0, 0, tileX, tileY, plane, 2, occlusionMap));
                    }
                }

                for (const gameObject of tile.gameObjects) {
                    const model = gameObject.model;

                    if (model instanceof Model && !gameObjects.has(gameObject)) {
                        models.push(sceneObjectToInstancedModel(model, gameObject, 0, 0, tileX, tileY, plane, 1, occlusionMap));

                        gameObjects.add(gameObject);
                    }
                }
            }
        }
    }

    return models;
}

function createModelTextureData(drawCommands: DrawCommand[]): Int32Array {
    const datas: DrawData[] = [];
    for (const cmd of drawCommands) {
        datas.push(...cmd.datas);
    }
    const dataCount = datas.length;

    const paddedModelDataLength = ((drawCommands.length + dataCount) / 16 + 1) * 16;
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

class ModelDataBuffer {
    data: Int32Array;

    bytes: Uint8Array;

    constructor(size: number) {
        this.data = new Int32Array(size);
        this.bytes = new Uint8Array(this.data.buffer);
    }

    ensureSize(size: number) {
        if (size > this.data.length) {
            this.data = new Int32Array(size * 2);
            this.bytes = new Uint8Array(this.data.buffer);
        }
    }
}

function getGroupedModels(models: InstancedModel[], modelDataBuf: ModelDataBuffer, minimizeDrawCalls: boolean): Map<number, InstancedModel> {
    const groupedModels: Map<number, InstancedModel> = new Map();

    const modelHashMap: Map<Model, number> = new Map();

    for (const instancedModel of models) {
        const model = instancedModel.model;

        if (model.faceCount === 0) {
            continue;
        }

        let hash = minimizeDrawCalls ? (Math.random() * 0x7FFFFFFF | 0) : modelHashMap.get(model);
        if (!hash) {
            const textureIds = (model.faceTextures && new Int32Array(model.faceTextures)) || new Int32Array(0);

            const datas = [model.faceColors1, model.faceColors2, model.faceColors3, model.verticesX, model.verticesY, model.verticesZ, textureIds];
            let dataLength = 0;
            for (const data of datas) {
                dataLength += data.length;
            }

            modelDataBuf.ensureSize(dataLength);

            let modelDataOffset = 0;
            for (const data of datas) {
                modelDataBuf.data.set(data, modelDataOffset);
                modelDataOffset += data.length;
            }

            const hashData = modelDataBuf.bytes.subarray(0, modelDataOffset * 4);
            hash = Hasher.hash32(hashData);

            modelHashMap.set(model, hash);
        }

        const groupedModel = groupedModels.get(hash);
        if (groupedModel) {
            groupedModel.datas.push(...instancedModel.datas);
        } else {
            groupedModels.set(hash, instancedModel);
        }
    }

    return groupedModels;
}

function getModelGroups(groupedModels: Map<number, InstancedModel>, textureProvider: TextureLoader): ModelGroup[] {
    const modelGroups: ModelGroup[] = [];

    const modelGroupsLowDetail: ModelGroup[] = [];
    const modelGroupsAlpha: ModelGroup[] = [];
    const modelGroupsLowDetailAlpha: ModelGroup[] = [];

    const modelGroupPlanes: ModelGroup[] = new Array(Scene.MAX_PLANE);
    const modelGroupPlanesAlpha: ModelGroup[] = new Array(Scene.MAX_PLANE);
    const modelGroupPlanesLowDetail: ModelGroup[] = new Array(Scene.MAX_PLANE);
    const modelGroupPlanesLowDetailAlpha: ModelGroup[] = new Array(Scene.MAX_PLANE);
    for (let i = 0; i < modelGroupPlanes.length; i++) {
        const mergeData = { plane: i }
        modelGroupPlanes[i] = { models: [], lowDetail: false, mergeData };
        modelGroupPlanesAlpha[i] = { models: [], lowDetail: false, mergeData };
        modelGroupPlanesLowDetail[i] = { models: [], lowDetail: true, mergeData };
        modelGroupPlanesLowDetailAlpha[i] = { models: [], lowDetail: true, mergeData };
    }

    for (const groupedModel of groupedModels.values()) {
        const model = groupedModel.model;

        const faces = getModelFaces(model, textureProvider);

        if (faces.length === 0) {
            continue;
        }

        const hasAlpha = model.hasAlpha(textureProvider);

        // sort on priority, has alpha, texture id, face index
        faces.sort((a, b) => a.priority - b.priority
            || (a.alpha < 0xFF ? 1 : 0) - (b.alpha < 0xFF ? 1 : 0)
            || a.textureId - b.textureId
            || b.index - a.index);

        const datas: ModelDrawData[] = [];
        const datasLowDetail: ModelDrawData[] = [];
        for (const data of groupedModel.datas) {
            if (data.isLowDetail && !hasAlpha) {
                datasLowDetail.push(data);
            } else {
                datas.push(data);
            }
        }

        const totalFaceCount = datas.length * faces.length + datasLowDetail.length * faces.length;

        const merge = (datas.length === 1 && datasLowDetail.length === 0) || totalFaceCount < 100;
        const mergeLowDetail = (datasLowDetail.length === 1 && datas.length === 0) || totalFaceCount < 100;
        // const merge = false;
        // const mergeLowDetail = false;

        if (merge) {
            let modelGroups: ModelGroup[];
            if (hasAlpha) {
                modelGroups = modelGroupPlanesAlpha;
            } else {
                modelGroups = modelGroupPlanes;
            }
            for (const data of datas) {
                modelGroups[data.drawData.plane].models.push({ faces, data });
            }
        }
        if (mergeLowDetail) {
            let modelGroups: ModelGroup[];
            if (hasAlpha) {
                modelGroups = modelGroupPlanesLowDetailAlpha;
            } else {
                modelGroups = modelGroupPlanesLowDetail;
            }
            for (const data of datasLowDetail) {
                modelGroups[data.drawData.plane].models.push({ faces, data });
            }
        }

        if ((merge && datasLowDetail.length === 0) || (mergeLowDetail && datas.length === 0) || (merge && mergeLowDetail)) {
            continue;
        }

        if (datas.length > 0) {
            const groups = hasAlpha ? modelGroupsAlpha : modelGroups;
            groups.push({
                models: datas.map(data => ({ faces, data })),
                lowDetail: false,
            });
        }
        if (datasLowDetail.length > 0) {
            const groups = hasAlpha ? modelGroupsLowDetailAlpha : modelGroupsLowDetail;
            groups.push({
                models: datasLowDetail.map(data => ({ faces, data })),
                lowDetail: true,
            });
        }
    }

    modelGroups.push(...modelGroupPlanes);

    modelGroups.push(...modelGroupsAlpha);
    modelGroups.push(...modelGroupPlanesAlpha);

    modelGroups.push(...modelGroupsLowDetail);
    modelGroups.push(...modelGroupPlanesLowDetail);

    modelGroups.push(...modelGroupsLowDetailAlpha);
    modelGroups.push(...modelGroupPlanesLowDetailAlpha);

    return modelGroups;
}

export class ChunkDataLoader {
    regionLoader: RegionLoader;

    objectModelLoader: ObjectModelLoader;

    textureProvider: TextureLoader;

    modelDataBuf: ModelDataBuffer;

    constructor(regionLoader: RegionLoader, objectModelLoader: ObjectModelLoader, textureProvider: TextureLoader) {
        this.regionLoader = regionLoader;
        this.objectModelLoader = objectModelLoader;
        this.textureProvider = textureProvider;
        this.modelDataBuf = new ModelDataBuffer(5000);
    }

    load(regionX: number, regionY: number, minimizeDrawCalls: boolean = false): ChunkData | undefined {
        const baseX = regionX * 64;
        const baseY = regionY * 64;

        const region = this.regionLoader.getRegion(regionX, regionY);
        if (!region) {
            return undefined;
        }

        const vertexBuf = new VertexBuffer(100000);

        let indices: number[] = [];

        const drawCommands: DrawCommand[] = [];
        const drawCommandsLowDetail: DrawCommand[] = [];

        let terrainVertexCount = 0;

        const heights = region.tileHeights;
        const underlayIds = region.tileUnderlays;
        const overlayIds = region.tileOverlays;
        const tileShapes = region.tileShapes;
        const tileRotations = region.tileRotations;
        const renderFlags = region.tileRenderFlags;

        // console.time(`blend region ${regionX}_${regionY}`);
        const blendedColors = this.regionLoader.getBlendedUnderlayColors(regionX, regionY);
        // console.timeEnd(`blend region ${regionX}_${regionY}`);

        // console.time(`light region ${regionX}_${regionY}`);
        const lightLevels = this.regionLoader.getLightLevels(regionX, regionY);
        // console.timeEnd(`light region ${regionX}_${regionY}`);

        // const underlayIdSet: Set<number> = new Set();
        // const overlayIdSet: Set<number> = new Set();
        // const heightSet: Set<number> = new Set();
        // const lightSet: Set<number> = new Set();

        console.time('terrain');

        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            const indexByteOffset = indices.length * 4;
            for (let x = 0; x < Scene.MAP_SIZE; x++) {
                for (let y = 0; y < Scene.MAP_SIZE; y++) {
                    const underlayId = underlayIds[plane][x][y] - 1;

                    const overlayId = overlayIds[plane][x][y] - 1;

                    // underlayIdSet.add(underlayId);
                    // overlayIdSet.add(overlayId);

                    if (underlayId == -1 && overlayId == -1) {
                        continue;
                    }

                    const heightSw = heights[plane][x][y];
                    let heightSe: number;
                    let heightNe: number;
                    let heightNw: number;

                    // heightSet.add(heightSw);

                    const lightSw = lightLevels[plane][x][y];
                    let lightSe: number;
                    let lightNe: number;
                    let lightNw: number;

                    if (x === Scene.MAP_SIZE - 1 || y === Scene.MAP_SIZE - 1) {
                        heightSe = this.regionLoader.getHeight(baseX + x + 1, baseY + y, plane);
                        heightNe = this.regionLoader.getHeight(baseX + x + 1, baseY + y + 1, plane);
                        heightNw = this.regionLoader.getHeight(baseX + x, baseY + y + 1, plane);

                        lightSe = this.regionLoader.getLightLevel(baseX + x + 1, baseY + y, plane);
                        lightNe = this.regionLoader.getLightLevel(baseX + x + 1, baseY + y + 1, plane);
                        lightNw = this.regionLoader.getLightLevel(baseX + x, baseY + y + 1, plane);
                    } else {
                        heightSe = heights[plane][x + 1][y];
                        heightNe = heights[plane][x + 1][y + 1];
                        heightNw = heights[plane][x][y + 1];

                        lightSe = lightLevels[plane][x + 1][y];
                        lightNe = lightLevels[plane][x + 1][y + 1];
                        lightNw = lightLevels[plane][x][y + 1];
                    }

                    // lightSet.add(lightSw);
                    // lightSet.add(lightSe);
                    // lightSet.add(lightNe);
                    // lightSet.add(lightNw);

                    let underlayHsl = -1;
                    if (underlayId !== -1) {
                        underlayHsl = blendedColors[plane][x][y];
                    }

                    if (overlayId == -1) {
                        addTileModel(0, 0, -1, x, y, heightSw, heightSe, heightNe, heightNw,
                            adjustUnderlayLight(underlayHsl, lightSw), adjustUnderlayLight(underlayHsl, lightSe),
                            adjustUnderlayLight(underlayHsl, lightNe), adjustUnderlayLight(underlayHsl, lightNw),
                            0, 0, 0, 0,
                            vertexBuf, indices);
                    } else {
                        const shape = tileShapes[plane][x][y] + 1;
                        const rotation = tileRotations[plane][x][y];

                        const overlay = this.regionLoader.getOverlayDef(overlayId);

                        const textureId = this.textureProvider.getTextureIndex(overlay.textureId) || -1;
                        let overlayHsl: number;
                        if (textureId !== -1) {
                            overlayHsl = -1;
                        } else if (overlay.primaryRgb == 0xFF00FF) {
                            overlayHsl = -2;
                        } else {
                            overlayHsl = packHsl(overlay.hue, overlay.saturation, overlay.lightness);
                        }

                        addTileModel(shape, rotation, textureId, x, y, heightSw, heightSe, heightNe, heightNw,
                            adjustUnderlayLight(underlayHsl, lightSw), adjustUnderlayLight(underlayHsl, lightSe),
                            adjustUnderlayLight(underlayHsl, lightNe), adjustUnderlayLight(underlayHsl, lightNw),
                            adjustOverlayLight(overlayHsl, lightSw), adjustOverlayLight(overlayHsl, lightSe),
                            adjustOverlayLight(overlayHsl, lightNe), adjustOverlayLight(overlayHsl, lightNw),
                            vertexBuf, indices);
                    }
                }
            }

            const planeVertexCount = (indices.length * 4 - indexByteOffset) / 4;

            if (planeVertexCount > 0) {
                drawCommands.push({
                    offset: indexByteOffset,
                    elements: planeVertexCount,
                    datas: [{ sceneX: 0, sceneY: 0, plane, contourGround: 1, priority: 0 }],
                });
            }
        }

        console.timeEnd('terrain');

        terrainVertexCount = vertexBuf.vertexOffset;

        console.time('read landscape data');
        const landscapeData = this.regionLoader.getLandscapeData(regionX, regionY);
        console.timeEnd('read landscape data');

        // check if is empty water region
        // if (overlayIdSet.size == 2 && overlayIdSet.has(5) 
        //         && heightSet.size === 1 && heightSet.has(0)
        //         && lightSet.size === 1 && lightSet.has(84)
        //         && (!landscapeData || landscapeData.length <= 1)) {
        //     console.log(underlayIdSet, overlayIdSet, heightSet, lightSet, landscapeData)
        //     return undefined;
        // }

        if (landscapeData) {
            console.time('load heightmap');
            const heightMap = this.loadHeightMap(regionX, regionY, 72);
            console.timeEnd('load heightmap');

            console.time('load landscape');
            const scene = new Scene2(4, 64, 64, heightMap);
            scene.decodeLandscape(this.regionLoader, this.objectModelLoader, landscapeData);
            console.timeEnd('load landscape');

            console.time('light scene');
            scene.applyLighting(-50, -10, -50);
            console.timeEnd('light scene');

            const occlusionMap = createOcclusionMap(renderFlags, underlayIds, overlayIds);

            console.time('iterate tiles');

            const models = getModelsFromScene(scene, occlusionMap);

            console.timeEnd('iterate tiles');

            console.time('models phase 1');

            const groupedModels = getGroupedModels(models, this.modelDataBuf, minimizeDrawCalls);

            console.timeEnd('models phase 1');

            console.time('create model groups');
            const modelGroups = getModelGroups(groupedModels, this.textureProvider);
            console.timeEnd('create model groups');

            console.time('create model groups models');
            for (const modelGroup of modelGroups) {
                addModelGroup(modelGroup, vertexBuf, indices, drawCommands, drawCommandsLowDetail, true);
            }
            console.timeEnd('create model groups models');
        }

        const triangles = drawCommands.map(cmd => cmd.elements / 3 * cmd.datas.length).reduce((a, b) => a + b, 0);
        const lowDetailTriangles = drawCommandsLowDetail.map(cmd => cmd.elements / 3 * cmd.datas.length).reduce((a, b) => a + b, 0);
        const totalTriangles = triangles + lowDetailTriangles;

        drawCommands.push(...drawCommandsLowDetail);

        const uniqTotalTriangles = drawCommands.map(cmd => cmd.elements / 3).reduce((a, b) => a + b, 0);

        const indexBufferBytes = indices.length * 4;
        const currentBytes = vertexBuf.vertexOffset * VertexBuffer.VERTEX_STRIDE + indexBufferBytes;

        const drawRanges: MultiDrawCommand[] = drawCommands.map(cmd => newMultiDrawCommand(cmd.offset, cmd.elements, cmd.datas.length));

        const modelTextureData = createModelTextureData(drawCommands);

        console.log('total triangles', totalTriangles, 'low detail: ', triangles, 'uniq triangles: ', uniqTotalTriangles,
            'terrain verts: ', terrainVertexCount, 'total vertices: ', vertexBuf.vertexOffset, 'now: ', currentBytes, currentBytes - indexBufferBytes,
            'uniq vertices: ', vertexBuf.vertexIndices.size, 'data texture size: ', modelTextureData.length, 'draw calls: ', drawRanges.length,
            'indices: ', indices.length);

        const heightMapTextureData = this.loadHeightMapTextureData(regionX, regionY);

        const drawRangesLowDetail = drawRanges.slice(0, drawCommands.length - drawCommandsLowDetail.length);

        return {
            regionX,
            regionY,
            vertices: new Uint8Array(vertexBuf.view.buffer).subarray(0, vertexBuf.vertexOffset * VertexBuffer.VERTEX_STRIDE),
            indices: new Int32Array(indices),
            modelTextureData,
            heightMapTextureData,
            drawRanges: drawRanges,
            drawRangesLowDetail: drawRangesLowDetail
        };
    }

    loadHeightMap(regionX: number, regionY: number, size: number): Int32Array[][] {
        const heightMap: Int32Array[][] = new Array(Scene.MAX_PLANE);

        const baseX = regionX * 64;
        const baseY = regionY * 64;

        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            heightMap[plane] = new Array(size);
            for (let x = 0; x < size; x++) {
                heightMap[plane][x] = new Int32Array(size);
                for (let y = 0; y < size; y++) {
                    heightMap[plane][x][y] = this.regionLoader.getHeight(baseX + x, baseY + y, plane);
                }
            }
        }

        return heightMap;
    }

    loadHeightMapTextureData(regionX: number, regionY: number): Float32Array {
        const heightMapTextureData = new Float32Array(Scene.MAX_PLANE * 72 * 72);

        const baseX = regionX * 64;
        const baseY = regionY * 64;

        let dataIndex = 0;
        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            for (let y = 0; y < 72; y++) {
                for (let x = 0; x < 72; x++) {
                    heightMapTextureData[dataIndex++] = (-this.regionLoader.getHeight(baseX + x, baseY + y, plane) / 8) | 0;
                }
            }
        }

        return heightMapTextureData;
    }
}

const TILE_SIZE = 128;
const HALF_TILE_SIZE = TILE_SIZE / 2;
const QUARTER_TILE_SIZE = TILE_SIZE / 4;
const THREE_QTR_TILE_SIZE = TILE_SIZE * 3 / 4;

const tileShapeVertexIndices = [
    [1, 3, 5, 7],
    [1, 3, 5, 7],
    [1, 3, 5, 7],
    [1, 3, 5, 7, 6],
    [1, 3, 5, 7, 6],
    [1, 3, 5, 7, 6],
    [1, 3, 5, 7, 6],
    [1, 3, 5, 7, 2, 6],
    [1, 3, 5, 7, 2, 8],
    [1, 3, 5, 7, 2, 8],
    [1, 3, 5, 7, 11, 12],
    [1, 3, 5, 7, 11, 12],
    [1, 3, 5, 7, 13, 14]
];

const tileShapeFaces = [
    [0, 1, 2, 3, 0, 0, 1, 3],
    [1, 1, 2, 3, 1, 0, 1, 3],
    [0, 1, 2, 3, 1, 0, 1, 3],
    [0, 0, 1, 2, 0, 0, 2, 4, 1, 0, 4, 3],
    [0, 0, 1, 4, 0, 0, 4, 3, 1, 1, 2, 4],
    [0, 0, 4, 3, 1, 0, 1, 2, 1, 0, 2, 4],
    [0, 1, 2, 4, 1, 0, 1, 4, 1, 0, 4, 3],
    [0, 4, 1, 2, 0, 4, 2, 5, 1, 0, 4, 5, 1, 0, 5, 3],
    [0, 4, 1, 2, 0, 4, 2, 3, 0, 4, 3, 5, 1, 0, 4, 5],
    [0, 0, 4, 5, 1, 4, 1, 2, 1, 4, 2, 3, 1, 4, 3, 5],
    [0, 0, 1, 5, 0, 1, 4, 5, 0, 1, 2, 4, 1, 0, 5, 3, 1, 5, 4, 3, 1, 4, 2, 3],
    [1, 0, 1, 5, 1, 1, 4, 5, 1, 1, 2, 4, 0, 0, 5, 3, 0, 5, 4, 3, 0, 4, 2, 3],
    [1, 0, 5, 4, 1, 0, 1, 5, 0, 0, 4, 3, 0, 4, 5, 3, 0, 5, 2, 3, 0, 1, 2, 5]
];

function addTileModel(shape: number, rotation: number, textureId: number, x: number, y: number,
    heightSw: number, heightSe: number, heightNe: number, heightNw: number,
    underlayHslSw: number, underlayHslSe: number, underlayHslNe: number, underlayHslNw: number,
    overlayHslSw: number, overlayHslSe: number, overlayHslNe: number, overlayHslNw: number,
    vertexBuf: VertexBuffer, indices: number[]) {
    const tileSize = TILE_SIZE;
    const halfTileSize = HALF_TILE_SIZE;
    const quarterTileSize = QUARTER_TILE_SIZE;
    const threeQuarterTileSize = THREE_QTR_TILE_SIZE;
    const vertexIndices = tileShapeVertexIndices[shape];
    const vertexCount = vertexIndices.length;
    const vertexX: number[] = new Array(vertexCount);
    const vertexY: number[] = new Array(vertexCount);
    const vertexZ: number[] = new Array(vertexCount);
    const underlayHsls: number[] = new Array(vertexCount);
    const overlayHsls: number[] = new Array(vertexCount);
    const tileX = x * tileSize;
    const tileY = y * tileSize;

    for (let i = 0; i < vertexCount; i++) {
        let vertexIndex = vertexIndices[i];
        if ((vertexIndex & 1) == 0 && vertexIndex <= 8) {
            vertexIndex = (vertexIndex - rotation - rotation - 1 & 7) + 1;
        }

        if (vertexIndex > 8 && vertexIndex <= 12) {
            vertexIndex = (vertexIndex - 9 - rotation & 3) + 9;
        }

        if (vertexIndex > 12 && vertexIndex <= 16) {
            vertexIndex = (vertexIndex - 13 - rotation & 3) + 13;
        }

        let vertX = 0;
        let vertZ = 0;
        let vertY = 0;
        let underlayHsl = 0;
        let overlayHsl = 0;

        if (vertexIndex == 1) {
            vertX = tileX;
            vertZ = tileY;
            vertY = heightSw;
            underlayHsl = underlayHslSw;
            overlayHsl = overlayHslSw;
        } else if (vertexIndex == 2) {
            vertX = tileX + halfTileSize;
            vertZ = tileY;
            vertY = heightSe + heightSw >> 1;
            underlayHsl = underlayHslSe + underlayHslSw >> 1;
            overlayHsl = overlayHslSe + overlayHslSw >> 1;
        } else if (vertexIndex == 3) {
            vertX = tileX + tileSize;
            vertZ = tileY;
            vertY = heightSe;
            underlayHsl = underlayHslSe;
            overlayHsl = overlayHslSe;
        } else if (vertexIndex == 4) {
            vertX = tileX + tileSize;
            vertZ = tileY + halfTileSize;
            vertY = heightNe + heightSe >> 1;
            underlayHsl = underlayHslSe + underlayHslNe >> 1;
            overlayHsl = overlayHslSe + overlayHslNe >> 1;
        } else if (vertexIndex == 5) {
            vertX = tileX + tileSize;
            vertZ = tileY + tileSize;
            vertY = heightNe;
            underlayHsl = underlayHslNe;
            overlayHsl = overlayHslNe;
        } else if (vertexIndex == 6) {
            vertX = tileX + halfTileSize;
            vertZ = tileY + tileSize;
            vertY = heightNe + heightNw >> 1;
            underlayHsl = underlayHslNw + underlayHslNe >> 1;
            overlayHsl = overlayHslNw + overlayHslNe >> 1;
        } else if (vertexIndex == 7) {
            vertX = tileX;
            vertZ = tileY + tileSize;
            vertY = heightNw;
            underlayHsl = underlayHslNw;
            overlayHsl = overlayHslNw;
        } else if (vertexIndex == 8) {
            vertX = tileX;
            vertZ = tileY + halfTileSize;
            vertY = heightNw + heightSw >> 1;
            underlayHsl = underlayHslNw + underlayHslSw >> 1;
            overlayHsl = overlayHslNw + overlayHslSw >> 1;
        } else if (vertexIndex == 9) {
            vertX = tileX + halfTileSize;
            vertZ = tileY + quarterTileSize;
            vertY = heightSe + heightSw >> 1;
            underlayHsl = underlayHslSe + underlayHslSw >> 1;
            overlayHsl = overlayHslSe + overlayHslSw >> 1;
        } else if (vertexIndex == 10) {
            vertX = tileX + threeQuarterTileSize;
            vertZ = tileY + halfTileSize;
            vertY = heightNe + heightSe >> 1;
            underlayHsl = underlayHslSe + underlayHslNe >> 1;
            overlayHsl = overlayHslSe + overlayHslNe >> 1;
        } else if (vertexIndex == 11) {
            vertX = tileX + halfTileSize;
            vertZ = tileY + threeQuarterTileSize;
            vertY = heightNe + heightNw >> 1;
            underlayHsl = underlayHslNw + underlayHslNe >> 1;
            overlayHsl = overlayHslNw + overlayHslNe >> 1;
        } else if (vertexIndex == 12) {
            vertX = tileX + quarterTileSize;
            vertZ = tileY + halfTileSize;
            vertY = heightNw + heightSw >> 1;
            underlayHsl = underlayHslNw + underlayHslSw >> 1;
            overlayHsl = overlayHslNw + overlayHslSw >> 1;
        } else if (vertexIndex == 13) {
            vertX = tileX + quarterTileSize;
            vertZ = tileY + quarterTileSize;
            vertY = heightSw;
            underlayHsl = underlayHslSw;
            overlayHsl = overlayHslSw;
        } else if (vertexIndex == 14) {
            vertX = tileX + threeQuarterTileSize;
            vertZ = tileY + quarterTileSize;
            vertY = heightSe;
            underlayHsl = underlayHslSe;
            overlayHsl = overlayHslSe;
        } else if (vertexIndex == 15) {
            vertX = tileX + threeQuarterTileSize;
            vertZ = tileY + threeQuarterTileSize;
            vertY = heightNe;
            underlayHsl = underlayHslNe;
            overlayHsl = overlayHslNe;
        } else {
            vertX = tileX + quarterTileSize;
            vertZ = tileY + threeQuarterTileSize;
            vertY = heightNw;
            underlayHsl = underlayHslNw;
            overlayHsl = overlayHslNw;
        }


        vertexX[i] = vertX;
        // vertexY[i] = vertY;
        vertexY[i] = 0;
        vertexZ[i] = vertZ;
        underlayHsls[i] = underlayHsl;
        overlayHsls[i] = overlayHsl;
    }

    const tileFaces = tileShapeFaces[shape];
    const faceCount = tileFaces.length / 4;


    let tileFaceIndex = 0;

    for (let i = 0; i < faceCount; i++) {
        const isOverlay = tileFaces[tileFaceIndex++] == 1;
        let a = tileFaces[tileFaceIndex++];
        let b = tileFaces[tileFaceIndex++];
        let c = tileFaces[tileFaceIndex++];

        if (a < 4) {
            a = a - rotation & 3;
        }

        if (b < 4) {
            b = b - rotation & 3;
        }

        if (c < 4) {
            c = c - rotation & 3;
        }

        let faceTextureId = -1;
        let hslA = 0;
        let hslB = 0;
        let hslC = 0;
        if (isOverlay) {
            hslA = overlayHsls[a];
            hslB = overlayHsls[b];
            hslC = overlayHsls[c];
            faceTextureId = textureId;
        } else {
            hslA = underlayHsls[a];
            hslB = underlayHsls[b];
            hslC = underlayHsls[c];
        }

        if (hslA === 12345678 && faceTextureId == -1) {
            continue;
        }

        const rgbA = HSL_RGB_MAP[hslA];
        const rgbB = HSL_RGB_MAP[hslB];
        const rgbC = HSL_RGB_MAP[hslC];


        const u0 = (vertexX[a] - tileX) / TILE_SIZE;
        const v0 = (vertexZ[a] - tileY) / TILE_SIZE;

        const u1 = (vertexX[b] - tileX) / TILE_SIZE;
        const v1 = (vertexZ[b] - tileY) / TILE_SIZE;

        const u2 = (vertexX[c] - tileX) / TILE_SIZE;
        const v2 = (vertexZ[c] - tileY) / TILE_SIZE;


        const index0 = vertexBuf.addVertex(vertexX[a], vertexY[a], vertexZ[a], rgbA, hslA, 0xFF, u0, v0, faceTextureId, 0);
        const index1 = vertexBuf.addVertex(vertexX[b], vertexY[b], vertexZ[b], rgbB, hslB, 0xFF, u1, v1, faceTextureId, 0);
        const index2 = vertexBuf.addVertex(vertexX[c], vertexY[c], vertexZ[c], rgbC, hslC, 0xFF, u2, v2, faceTextureId, 0);

        indices.push(
            index0,
            index1,
            index2,
        );
    }
}

function adjustUnderlayLight(hsl: number, light: number) {
    if (hsl == -1) {
        return 12345678;
    } else {
        light = (hsl & 127) * light >> 7;
        if (light < 2) {
            light = 2;
        } else if (light > 126) {
            light = 126;
        }

        return (hsl & 0xFF80) + light;
    }
}

function adjustOverlayLight(hsl: number, light: number) {
    if (hsl == -2) {
        return 12345678;
    } else if (hsl == -1) {
        if (light < 2) {
            light = 2;
        } else if (light > 126) {
            light = 126;
        }

        return light;
    } else {
        light = (hsl & 127) * light >> 7;
        if (light < 2) {
            light = 2;
        } else if (light > 126) {
            light = 126;
        }

        return (hsl & 0xFF80) + light;
    }
}
