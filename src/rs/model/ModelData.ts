import { COSINE, SINE } from "../MathConstants";
import { ByteBuffer } from "../io/ByteBuffer";
import { Entity } from "../scene/entity/Entity";
import { TextureLoader } from "../texture/TextureLoader";
import { FaceNormal } from "./FaceNormal";
import { Model } from "./Model";
import { computeTextureCoords } from "./TextureMapper";
import { VertexNormal } from "./VertexNormal";

export class ModelData extends Entity {
    private static mergeModelNormalsCount: number = 0;

    private static mergedNormalsModel0Cache: Int32Array = new Int32Array(10000);
    private static mergedNormalsModel1Cache: Int32Array = new Int32Array(10000);

    version: number;

    verticesCount: number;
    usedVertexCount: number;

    verticesX!: Int32Array;
    verticesY!: Int32Array;
    verticesZ!: Int32Array;

    contourVerticesY?: Int32Array;

    faceCount: number;

    indices1!: Int32Array;
    indices2!: Int32Array;
    indices3!: Int32Array;

    faceRenderTypes?: Int8Array;
    faceRenderPriorities!: Int8Array;

    faceAlphas!: Int8Array;

    textureCoords?: Int8Array;

    faceColors!: Uint16Array;
    faceTextures?: Int16Array;

    priority: number;

    textureFaceCount!: number;
    textureRenderTypes!: Int8Array;

    textureMappingP!: Int16Array;
    textureMappingM!: Int16Array;
    textureMappingN!: Int16Array;

    textureScaleX!: Int32Array;
    textureScaleY!: Int32Array;
    textureScaleZ!: Int32Array;
    textureRotation!: Int8Array;
    textureDirection!: Int8Array;
    textureSpeed!: Int32Array;

    textureTransU!: Int32Array;
    textureTransV!: Int32Array;

    vertexSkins?: Int32Array;
    faceSkins?: Int32Array;

    vertexLabels!: Int32Array[];
    faceLabels!: Int32Array[];

    animMayaGroups!: Int32Array[];
    animMayaScales!: Int32Array[];

    faceNormals?: FaceNormal[];
    normals?: VertexNormal[];
    mergedNormals?: VertexNormal[];

    ambient!: number;
    contrast!: number;

    isBoundsCalculated: boolean;

    minHeight!: number;

    minX!: number;
    maxX!: number;

    minY!: number;
    maxY!: number;

    minZ!: number;
    maxZ!: number;

    static merge(models: ModelData[], count: number): ModelData {
        const model = new ModelData();
        model.merge(models, count);
        return model;
    }

    static decode(data: Int8Array): ModelData {
        const model = new ModelData();
        model.decode(data);
        return model;
    }

    static copyFrom(
        model: ModelData,
        shallowIndices: boolean,
        shallowVertices: boolean,
        shallowColors: boolean,
        shallowTextures: boolean,
    ): ModelData {
        const copy = new ModelData();
        copy.copyFrom(model, shallowIndices, shallowVertices, shallowColors, shallowTextures);
        return copy;
    }

    // TODO: replace with the one from ColorUtil
    static adjustLightness(hsl: number, lightness: number): number {
        lightness = ((hsl & 127) * lightness) >> 7;
        if (lightness < 2) {
            lightness = 2;
        } else if (lightness > 126) {
            lightness = 126;
        }

        return (hsl & 0xff80) + lightness;
    }

    static clampLightness(lightness: number): number {
        if (lightness < 2) {
            lightness = 2;
        } else if (lightness > 126) {
            lightness = 126;
        }
        return lightness | 0;
    }

    static mergeNormals(
        model0: ModelData,
        model1: ModelData,
        offsetX: number,
        offsetY: number,
        offsetZ: number,
        hideOccludedFaces: boolean,
    ): void {
        model0.calculateBounds();
        model0.calculateVertexNormals();
        model1.calculateBounds();
        model1.calculateVertexNormals();

        if (!model0.normals || !model1.normals) {
            return;
        }

        ModelData.mergeModelNormalsCount++;

        const verticesY0 = model0.contourVerticesY || model0.verticesY;
        const verticesY1 = model1.contourVerticesY || model1.verticesY;

        let mergedCount = 0;

        for (let v0 = 0; v0 < model0.usedVertexCount; v0++) {
            const normal0 = model0.normals[v0];
            if (normal0.magnitude === 0) {
                continue;
            }
            const y = verticesY0[v0] - offsetY;
            if (y > model1.minHeight) {
                continue;
            }
            const x = model0.verticesX[v0] - offsetX;
            if (x < model1.minX || x > model1.maxX) {
                continue;
            }
            const z = model0.verticesZ[v0] - offsetZ;
            if (z < model1.minZ || z > model1.maxZ) {
                continue;
            }

            for (let v1 = 0; v1 < model1.usedVertexCount; v1++) {
                const normal1 = model1.normals[v1];
                if (
                    x !== model1.verticesX[v1] ||
                    z !== model1.verticesZ[v1] ||
                    y !== verticesY1[v1] ||
                    normal1.magnitude === 0
                ) {
                    continue;
                }

                if (!model0.mergedNormals) {
                    model0.mergedNormals = new Array(model0.usedVertexCount);
                }
                if (!model1.mergedNormals) {
                    model1.mergedNormals = new Array(model1.usedVertexCount);
                }

                let mergedNormal0 = model0.mergedNormals[v0];
                if (!mergedNormal0) {
                    mergedNormal0 = model0.mergedNormals[v0] = VertexNormal.copy(normal0);
                }
                let mergedNormal1 = model1.mergedNormals[v1];
                if (!mergedNormal1) {
                    mergedNormal1 = model1.mergedNormals[v1] = VertexNormal.copy(normal1);
                }

                mergedNormal0.x += normal1.x;
                mergedNormal0.y += normal1.y;
                mergedNormal0.z += normal1.z;
                mergedNormal0.magnitude += normal1.magnitude;
                mergedNormal1.x += normal0.x;
                mergedNormal1.y += normal0.y;
                mergedNormal1.z += normal0.z;
                mergedNormal1.magnitude += normal0.magnitude;

                mergedCount++;

                ModelData.mergedNormalsModel0Cache[v0] = ModelData.mergeModelNormalsCount;
                ModelData.mergedNormalsModel1Cache[v1] = ModelData.mergeModelNormalsCount;
            }
        }

        if (mergedCount >= 3 && hideOccludedFaces) {
            for (let i = 0; i < model0.faceCount; i++) {
                if (
                    ModelData.mergedNormalsModel0Cache[model0.indices1[i]] ===
                        ModelData.mergeModelNormalsCount &&
                    ModelData.mergedNormalsModel0Cache[model0.indices2[i]] ===
                        ModelData.mergeModelNormalsCount &&
                    ModelData.mergedNormalsModel0Cache[model0.indices3[i]] ===
                        ModelData.mergeModelNormalsCount
                ) {
                    if (!model0.faceRenderTypes) {
                        model0.faceRenderTypes = new Int8Array(model0.faceCount);
                    }

                    model0.faceRenderTypes[i] = 2;
                }
            }
            for (let i = 0; i < model1.faceCount; i++) {
                if (
                    ModelData.mergedNormalsModel1Cache[model1.indices1[i]] ===
                        ModelData.mergeModelNormalsCount &&
                    ModelData.mergedNormalsModel1Cache[model1.indices2[i]] ===
                        ModelData.mergeModelNormalsCount &&
                    ModelData.mergedNormalsModel1Cache[model1.indices3[i]] ===
                        ModelData.mergeModelNormalsCount
                ) {
                    if (!model1.faceRenderTypes) {
                        model1.faceRenderTypes = new Int8Array(model1.faceCount);
                    }

                    model1.faceRenderTypes[i] = 2;
                }
            }
        }
    }

    constructor() {
        super();
        this.version = -1;
        this.verticesCount = 0;
        this.usedVertexCount = 0;
        this.faceCount = 0;
        this.priority = 0;
        this.isBoundsCalculated = false;
    }

    canMergeNormals(): boolean {
        return true;
    }

    mergeNormals(
        entity: Entity,
        offsetX: number,
        offsetY: number,
        offsetZ: number,
        hideOccluded: boolean,
    ): void {
        if (!(entity instanceof ModelData)) {
            return;
        }
        ModelData.mergeNormals(this, entity, offsetX, offsetY, offsetZ, hideOccluded);
    }

    merge(models: ModelData[], count: number): void {
        this.version = 12;
        this.verticesCount = 0;
        this.faceCount = 0;
        this.textureFaceCount = 0;
        this.priority = -1;

        let hasRenderTypes = false;
        let hasRenderPriorities = false;
        let hasAlphas = false;
        let hasFaceSkins = false;
        let hasTextures = false;
        let hasTextureCoords = false;
        let hasMayaGroups = false;

        for (let i = 0; i < count; i++) {
            const model = models[i];
            if (model) {
                this.verticesCount += model.verticesCount;
                this.faceCount += model.faceCount;
                this.textureFaceCount += model.textureFaceCount;
                if (model.faceRenderPriorities) {
                    hasRenderPriorities = true;
                } else {
                    if (this.priority === -1) {
                        this.priority = model.priority;
                    }

                    if (this.priority !== model.priority) {
                        hasRenderPriorities = true;
                    }
                }

                hasRenderTypes ||= !!model.faceRenderTypes;
                hasAlphas ||= !!model.faceAlphas;
                hasFaceSkins ||= !!model.faceSkins;
                hasTextures ||= !!model.faceTextures;
                hasTextureCoords ||= !!model.textureCoords;
                hasMayaGroups ||= !!model.animMayaGroups;
            }
        }

        this.verticesX = new Int32Array(this.verticesCount);
        this.verticesY = new Int32Array(this.verticesCount);
        this.verticesZ = new Int32Array(this.verticesCount);
        this.vertexSkins = new Int32Array(this.verticesCount);
        this.indices1 = new Int32Array(this.faceCount);
        this.indices2 = new Int32Array(this.faceCount);
        this.indices3 = new Int32Array(this.faceCount);
        if (hasRenderTypes) {
            this.faceRenderTypes = new Int8Array(this.faceCount);
        }

        if (hasRenderPriorities) {
            this.faceRenderPriorities = new Int8Array(this.faceCount);
        }

        if (hasAlphas) {
            this.faceAlphas = new Int8Array(this.faceCount);
        }

        if (hasFaceSkins) {
            this.faceSkins = new Int32Array(this.faceCount);
        }

        if (hasTextures) {
            this.faceTextures = new Int16Array(this.faceCount);
        }

        if (hasTextureCoords) {
            this.textureCoords = new Int8Array(this.faceCount);
        }

        if (hasMayaGroups) {
            this.animMayaGroups = new Array(this.verticesCount);
            this.animMayaScales = new Array(this.verticesCount);
        }

        this.faceColors = new Uint16Array(this.faceCount);
        if (this.textureFaceCount > 0) {
            this.textureRenderTypes = new Int8Array(this.textureFaceCount);
            this.textureMappingP = new Int16Array(this.textureFaceCount);
            this.textureMappingM = new Int16Array(this.textureFaceCount);
            this.textureMappingN = new Int16Array(this.textureFaceCount);
            this.textureScaleX = new Int32Array(this.textureFaceCount);
            this.textureScaleY = new Int32Array(this.textureFaceCount);
            this.textureScaleZ = new Int32Array(this.textureFaceCount);
            this.textureRotation = new Int8Array(this.textureFaceCount);
            this.textureDirection = new Int8Array(this.textureFaceCount);
            this.textureSpeed = new Int32Array(this.textureFaceCount);
            this.textureTransU = new Int32Array(this.textureFaceCount);
            this.textureTransV = new Int32Array(this.textureFaceCount);
        }

        this.verticesCount = 0;
        this.faceCount = 0;
        this.textureFaceCount = 0;

        for (let i = 0; i < count; i++) {
            const model = models[i];
            if (!model) {
                continue;
            }
            for (let f = 0; f < model.faceCount; f++) {
                if (hasRenderTypes && model.faceRenderTypes && this.faceRenderTypes) {
                    this.faceRenderTypes[this.faceCount] = model.faceRenderTypes[f];
                }

                if (hasRenderPriorities) {
                    if (model.faceRenderPriorities) {
                        this.faceRenderPriorities[this.faceCount] = model.faceRenderPriorities[f];
                    } else {
                        this.faceRenderPriorities[this.faceCount] = model.priority;
                    }
                }

                if (hasAlphas && model.faceAlphas) {
                    this.faceAlphas[this.faceCount] = model.faceAlphas[f];
                }

                if (hasFaceSkins && this.faceSkins) {
                    if (model.faceSkins) {
                        this.faceSkins[this.faceCount] = model.faceSkins[f];
                    } else {
                        this.faceSkins[this.faceCount] = -1;
                    }
                }

                if (hasTextures && this.faceTextures) {
                    if (model.faceTextures) {
                        this.faceTextures[this.faceCount] = model.faceTextures[f];
                    } else {
                        this.faceTextures[this.faceCount] = -1;
                    }
                }

                if (hasTextureCoords && this.textureCoords) {
                    if (model.textureCoords && model.textureCoords[f] !== -1) {
                        this.textureCoords[this.faceCount] =
                            this.textureFaceCount + model.textureCoords[f];
                    } else {
                        this.textureCoords[this.faceCount] = -1;
                    }
                }

                this.faceColors[this.faceCount] = model.faceColors[f];
                this.indices1[this.faceCount] = this.copyVertex(model, model.indices1[f]);
                this.indices2[this.faceCount] = this.copyVertex(model, model.indices2[f]);
                this.indices3[this.faceCount] = this.copyVertex(model, model.indices3[f]);
                this.faceCount++;
            }

            for (let f = 0; f < model.textureFaceCount; f++) {
                const type = (this.textureRenderTypes[this.textureFaceCount] =
                    model.textureRenderTypes[f]);
                if (type === 0) {
                    this.textureMappingP[this.textureFaceCount] = this.copyVertex(
                        model,
                        model.textureMappingP[f],
                    );
                    this.textureMappingM[this.textureFaceCount] = this.copyVertex(
                        model,
                        model.textureMappingM[f],
                    );
                    this.textureMappingN[this.textureFaceCount] = this.copyVertex(
                        model,
                        model.textureMappingN[f],
                    );
                }
                if (type >= 1 && type <= 3) {
                    this.textureMappingP[this.textureFaceCount] = model.textureMappingP[f];
                    this.textureMappingM[this.textureFaceCount] = model.textureMappingM[f];
                    this.textureMappingN[this.textureFaceCount] = model.textureMappingN[f];
                    this.textureScaleX[this.textureFaceCount] = model.textureScaleX[f];
                    this.textureScaleY[this.textureFaceCount] = model.textureScaleY[f];
                    this.textureScaleZ[this.textureFaceCount] = model.textureScaleZ[f];
                    this.textureRotation[this.textureFaceCount] = model.textureRotation[f];
                    this.textureDirection[this.textureFaceCount] = model.textureDirection[f];
                    this.textureSpeed[this.textureFaceCount] = model.textureSpeed[f];
                }

                if (type === 2) {
                    this.textureTransU[this.textureFaceCount] = model.textureTransU[f];
                    this.textureTransV[this.textureFaceCount] = model.textureTransV[f];
                }

                this.textureFaceCount++;
            }
        }
        // TODO: this is different in rs2
        this.usedVertexCount = this.verticesCount;
    }

    copyVertex(model: ModelData, index: number): number {
        let newVertexCount = -1;
        const vertX = model.verticesX[index];
        const vertY = model.verticesY[index];
        const vertZ = model.verticesZ[index];

        for (let i = 0; i < this.verticesCount; i++) {
            if (
                vertX === this.verticesX[i] &&
                vertY === this.verticesY[i] &&
                vertZ === this.verticesZ[i]
            ) {
                newVertexCount = i;
                break;
            }
        }

        if (newVertexCount === -1) {
            this.verticesX[this.verticesCount] = vertX;
            this.verticesY[this.verticesCount] = vertY;
            this.verticesZ[this.verticesCount] = vertZ;
            if (model.vertexSkins && this.vertexSkins) {
                this.vertexSkins[this.verticesCount] = model.vertexSkins[index];
            } else if (this.vertexSkins) {
                this.vertexSkins![this.verticesCount] = -1;
            }

            if (model.animMayaGroups) {
                this.animMayaGroups[this.verticesCount] = model.animMayaGroups[index];
                this.animMayaScales[this.verticesCount] = model.animMayaScales[index];
            }

            newVertexCount = this.verticesCount++;
        }

        return newVertexCount;
    }

    decode(data: Int8Array): void {
        if (data[data.length - 1] === -3 && data[data.length - 2] === -1) {
            this.decodeV3(data);
            this.usedVertexCount = this.verticesCount;
        } else if (data[data.length - 1] === -2 && data[data.length - 2] === -1) {
            this.decodeV2(data);
            this.usedVertexCount = this.verticesCount;
        } else if (data[data.length - 1] === -1 && data[data.length - 2] === -1) {
            this.decodeV1(data);
        } else {
            this.decodeOld(data);
        }
    }

    decodeV3(data: Int8Array): void {
        this.version = 3;
        const buf1 = new ByteBuffer(data);
        const buf2 = new ByteBuffer(data);
        const buf3 = new ByteBuffer(data);
        const buf4 = new ByteBuffer(data);
        const buf5 = new ByteBuffer(data);
        const buf6 = new ByteBuffer(data);
        const buf7 = new ByteBuffer(data);
        buf1.offset = data.length - 26;
        const vertexCount = buf1.readUnsignedShort();
        const faceCount = buf1.readUnsignedShort();
        const texTriangleCount = buf1.readUnsignedByte();
        const var12 = buf1.readUnsignedByte();
        const var13 = buf1.readUnsignedByte();
        const var14 = buf1.readUnsignedByte();
        const var15 = buf1.readUnsignedByte();
        const var16 = buf1.readUnsignedByte();
        const var17 = buf1.readUnsignedByte();
        const hasMayaGroups = buf1.readUnsignedByte();
        const var19 = buf1.readUnsignedShort();
        const var20 = buf1.readUnsignedShort();
        const var21 = buf1.readUnsignedShort();
        const var22 = buf1.readUnsignedShort();
        const var23 = buf1.readUnsignedShort();
        const var24 = buf1.readUnsignedShort();
        let simpleTextureFaceCount = 0;
        let complexTextureFaceCount = 0;
        let cubeTextureFaceCount = 0;
        if (texTriangleCount > 0) {
            this.textureRenderTypes = new Int8Array(texTriangleCount);
            buf1.offset = 0;

            for (let i = 0; i < texTriangleCount; i++) {
                const type = (this.textureRenderTypes[i] = buf1.readByte());
                if (type === 0) {
                    simpleTextureFaceCount++;
                }

                if (type >= 1 && type <= 3) {
                    complexTextureFaceCount++;
                }

                if (type === 2) {
                    cubeTextureFaceCount++;
                }
            }
        }

        let var28 = texTriangleCount + vertexCount;
        const var30 = var28;
        if (var12 === 1) {
            var28 += faceCount;
        }

        const var31 = var28;
        var28 += faceCount;
        const var32 = var28;
        if (var13 === 255) {
            var28 += faceCount;
        }

        const var33 = var28;
        if (var15 === 1) {
            var28 += faceCount;
        }

        const var34 = var28;
        var28 += var24;
        const var35 = var28;
        if (var14 === 1) {
            var28 += faceCount;
        }

        const var36 = var28;
        var28 += var22;
        const var37 = var28;
        if (var16 === 1) {
            var28 += faceCount * 2;
        }

        const var38 = var28;
        var28 += var23;
        const var39 = var28;
        var28 += faceCount * 2;
        const var40 = var28;
        var28 += var19;
        const var41 = var28;
        var28 += var20;
        const var42 = var28;
        var28 += var21;
        const var43 = var28;
        var28 += simpleTextureFaceCount * 6;
        const var44 = var28;
        var28 += complexTextureFaceCount * 6;
        const var45 = var28;
        var28 += complexTextureFaceCount * 6;
        const var46 = var28;
        var28 += complexTextureFaceCount * 2;
        const var47 = var28;
        var28 += complexTextureFaceCount;
        const var48 = var28;
        var28 += complexTextureFaceCount * 2 + cubeTextureFaceCount * 2;
        this.verticesCount = vertexCount;
        this.faceCount = faceCount;
        this.textureFaceCount = texTriangleCount;
        this.verticesX = new Int32Array(vertexCount);
        this.verticesY = new Int32Array(vertexCount);
        this.verticesZ = new Int32Array(vertexCount);
        this.indices1 = new Int32Array(faceCount);
        this.indices2 = new Int32Array(faceCount);
        this.indices3 = new Int32Array(faceCount);
        if (var17 === 1) {
            this.vertexSkins = new Int32Array(vertexCount);
        }

        if (var12 === 1) {
            this.faceRenderTypes = new Int8Array(faceCount);
        }

        if (var13 === 255) {
            this.faceRenderPriorities = new Int8Array(faceCount);
        } else {
            this.priority = var13;
        }

        if (var14 === 1) {
            this.faceAlphas = new Int8Array(faceCount);
        }

        if (var15 === 1) {
            this.faceSkins = new Int32Array(faceCount);
        }

        if (var16 === 1) {
            this.faceTextures = new Int16Array(faceCount);
        }

        if (var16 === 1 && texTriangleCount > 0) {
            this.textureCoords = new Int8Array(faceCount);
        }

        if (hasMayaGroups === 1) {
            this.animMayaGroups = new Array(vertexCount);
            this.animMayaScales = new Array(vertexCount);
        }

        this.faceColors = new Uint16Array(faceCount);
        if (texTriangleCount > 0) {
            this.textureMappingP = new Int16Array(texTriangleCount);
            this.textureMappingM = new Int16Array(texTriangleCount);
            this.textureMappingN = new Int16Array(texTriangleCount);
            if (complexTextureFaceCount > 0) {
                this.textureScaleX = new Int32Array(complexTextureFaceCount);
                this.textureScaleY = new Int32Array(complexTextureFaceCount);
                this.textureScaleZ = new Int32Array(complexTextureFaceCount);
                this.textureRotation = new Int8Array(complexTextureFaceCount);
                this.textureDirection = new Int8Array(complexTextureFaceCount);
                this.textureSpeed = new Int32Array(complexTextureFaceCount);
            }
            if (cubeTextureFaceCount > 0) {
                this.textureTransU = new Int32Array(cubeTextureFaceCount);
                this.textureTransV = new Int32Array(cubeTextureFaceCount);
            }
        }

        buf1.offset = texTriangleCount;
        buf2.offset = var40;
        buf3.offset = var41;
        buf4.offset = var42;
        buf5.offset = var34;
        let lastVertX = 0;
        let lastVertY = 0;
        let lastVertZ = 0;

        for (let i = 0; i < vertexCount; i++) {
            const flag = buf1.readUnsignedByte();
            let deltaVertX = 0;
            if ((flag & 1) !== 0) {
                deltaVertX = buf2.readSmart2();
            }

            let deltaVertY = 0;
            if ((flag & 2) !== 0) {
                deltaVertY = buf3.readSmart2();
            }

            let deltaVertZ = 0;
            if ((flag & 4) !== 0) {
                deltaVertZ = buf4.readSmart2();
            }

            this.verticesX[i] = lastVertX + deltaVertX;
            this.verticesY[i] = lastVertY + deltaVertY;
            this.verticesZ[i] = lastVertZ + deltaVertZ;
            lastVertX = this.verticesX[i];
            lastVertY = this.verticesY[i];
            lastVertZ = this.verticesZ[i];
            if (var17 === 1 && this.vertexSkins) {
                this.vertexSkins[i] = buf5.readUnsignedByte();
            }
        }

        if (hasMayaGroups === 1) {
            for (let i = 0; i < vertexCount; i++) {
                const var54 = buf5.readUnsignedByte();
                this.animMayaGroups[i] = new Int32Array(var54);
                this.animMayaScales[i] = new Int32Array(var54);

                for (let j = 0; j < var54; j++) {
                    this.animMayaGroups[i][j] = buf5.readUnsignedByte();
                    this.animMayaScales[i][j] = buf5.readUnsignedByte();
                }
            }
        }

        buf1.offset = var39;
        buf2.offset = var30;
        buf3.offset = var32;
        buf4.offset = var35;
        buf5.offset = var33;
        buf6.offset = var37;
        buf7.offset = var38;

        for (let i = 0; i < faceCount; i++) {
            this.faceColors[i] = buf1.readUnsignedShort();
            if (var12 === 1 && this.faceRenderTypes) {
                this.faceRenderTypes[i] = buf2.readByte();
            }

            if (var13 === 255) {
                this.faceRenderPriorities[i] = buf3.readByte();
            }

            if (var14 === 1) {
                this.faceAlphas[i] = buf4.readByte();
            }

            if (var15 === 1 && this.faceSkins) {
                this.faceSkins[i] = buf5.readUnsignedByte();
            }

            if (var16 === 1 && this.faceTextures) {
                this.faceTextures[i] = buf6.readUnsignedShort() - 1;
            }

            if (this.textureCoords && this.faceTextures && this.faceTextures[i] !== -1) {
                this.textureCoords[i] = buf7.readUnsignedByte() - 1;
            }
        }

        buf1.offset = var36;
        buf2.offset = var31;
        let var53 = 0;
        let var54 = 0;
        let var55 = 0;
        let var56 = 0;

        for (let i = 0; i < faceCount; i++) {
            const type = buf2.readUnsignedByte();
            if (type === 1) {
                var53 = buf1.readSmart2() + var56;
                var54 = buf1.readSmart2() + var53;
                var55 = buf1.readSmart2() + var54;
                var56 = var55;
                this.indices1[i] = var53;
                this.indices2[i] = var54;
                this.indices3[i] = var55;
            }

            if (type === 2) {
                var54 = var55;
                var55 = buf1.readSmart2() + var56;
                var56 = var55;
                this.indices1[i] = var53;
                this.indices2[i] = var54;
                this.indices3[i] = var55;
            }

            if (type === 3) {
                var53 = var55;
                var55 = buf1.readSmart2() + var56;
                var56 = var55;
                this.indices1[i] = var53;
                this.indices2[i] = var54;
                this.indices3[i] = var55;
            }

            if (type === 4) {
                const var59 = var53;
                var53 = var54;
                var54 = var59;
                var55 = buf1.readSmart2() + var56;
                var56 = var55;
                this.indices1[i] = var53;
                this.indices2[i] = var59;
                this.indices3[i] = var55;
            }
        }

        buf1.offset = var43;
        buf2.offset = var44;
        buf3.offset = var45;
        buf4.offset = var46;
        buf5.offset = var47;
        buf6.offset = var48;

        for (let i = 0; i < texTriangleCount; i++) {
            const type = this.textureRenderTypes[i] & 255;
            if (type === 0) {
                this.textureMappingP[i] = buf1.readUnsignedShort();
                this.textureMappingM[i] = buf1.readUnsignedShort();
                this.textureMappingN[i] = buf1.readUnsignedShort();
            }
        }

        buf1.offset = var28;
        const var57 = buf1.readUnsignedByte();
        if (var57 !== 0) {
            // new ModelData0();
            buf1.readUnsignedShort();
            buf1.readUnsignedShort();
            buf1.readUnsignedShort();
            buf1.readInt();
        }
    }

    decodeV2(data: Int8Array): void {
        this.version = 2;
        let var2 = false;
        let var3 = false;
        const buf1 = new ByteBuffer(data);
        const buf2 = new ByteBuffer(data);
        const buf3 = new ByteBuffer(data);
        const buf4 = new ByteBuffer(data);
        const buf5 = new ByteBuffer(data);
        buf1.offset = data.length - 23;
        const vertexCount = buf1.readUnsignedShort();
        const faceCount = buf1.readUnsignedShort();
        const texTriangleCount = buf1.readUnsignedByte();
        const var12 = buf1.readUnsignedByte();
        const var13 = buf1.readUnsignedByte();
        const var14 = buf1.readUnsignedByte();
        const var15 = buf1.readUnsignedByte();
        const hasVertexSkins = buf1.readUnsignedByte();
        const hasMayaGroups = buf1.readUnsignedByte();
        const var18 = buf1.readUnsignedShort();
        const var19 = buf1.readUnsignedShort();
        const var20 = buf1.readUnsignedShort();
        const var21 = buf1.readUnsignedShort();
        const var22 = buf1.readUnsignedShort();
        let var23 = 0;
        let var47 = var23 + vertexCount;
        const var25 = var47;
        var47 += faceCount;
        const var26 = var47;
        if (var13 === 255) {
            var47 += faceCount;
        }

        const var27 = var47;
        if (var15 === 1) {
            var47 += faceCount;
        }

        const var28 = var47;
        if (var12 === 1) {
            var47 += faceCount;
        }

        const var29 = var47;
        var47 += var22;
        const var30 = var47;
        if (var14 === 1) {
            var47 += faceCount;
        }

        const var31 = var47;
        var47 += var21;
        const var32 = var47;
        var47 += faceCount * 2;
        const var33 = var47;
        var47 += texTriangleCount * 6;
        const var34 = var47;
        var47 += var18;
        const var35 = var47;
        var47 += var19;
        // const var10000 = var47 + var20;
        this.verticesCount = vertexCount;
        this.faceCount = faceCount;
        this.textureFaceCount = texTriangleCount;
        this.verticesX = new Int32Array(vertexCount);
        this.verticesY = new Int32Array(vertexCount);
        this.verticesZ = new Int32Array(vertexCount);
        this.indices1 = new Int32Array(faceCount);
        this.indices2 = new Int32Array(faceCount);
        this.indices3 = new Int32Array(faceCount);
        if (texTriangleCount > 0) {
            this.textureRenderTypes = new Int8Array(texTriangleCount);
            this.textureMappingP = new Int16Array(texTriangleCount);
            this.textureMappingM = new Int16Array(texTriangleCount);
            this.textureMappingN = new Int16Array(texTriangleCount);
        }

        if (hasVertexSkins === 1) {
            this.vertexSkins = new Int32Array(vertexCount);
        }

        if (var12 === 1) {
            this.faceRenderTypes = new Int8Array(faceCount);
            this.textureCoords = new Int8Array(faceCount);
            this.faceTextures = new Int16Array(faceCount);
        }

        if (var13 === 255) {
            this.faceRenderPriorities = new Int8Array(faceCount);
        } else {
            this.priority = var13;
        }

        if (var14 === 1) {
            this.faceAlphas = new Int8Array(faceCount);
        }

        if (var15 === 1) {
            this.faceSkins = new Int32Array(faceCount);
        }

        if (hasMayaGroups === 1) {
            this.animMayaGroups = new Array(vertexCount);
            this.animMayaScales = new Array(vertexCount);
        }

        this.faceColors = new Uint16Array(faceCount);
        buf1.offset = var23;
        buf2.offset = var34;
        buf3.offset = var35;
        buf4.offset = var47;
        buf5.offset = var29;
        let lastVertX = 0;
        let lastVertY = 0;
        let lastVertZ = 0;

        for (let i = 0; i < vertexCount; i++) {
            const flag = buf1.readUnsignedByte();
            let deltaVertX = 0;
            if ((flag & 1) !== 0) {
                deltaVertX = buf2.readSmart2();
            }

            let deltaVertY = 0;
            if ((flag & 2) !== 0) {
                deltaVertY = buf3.readSmart2();
            }

            let deltaVertZ = 0;
            if ((flag & 4) !== 0) {
                deltaVertZ = buf4.readSmart2();
            }

            this.verticesX[i] = lastVertX + deltaVertX;
            this.verticesY[i] = lastVertY + deltaVertY;
            this.verticesZ[i] = lastVertZ + deltaVertZ;
            lastVertX = this.verticesX[i];
            lastVertY = this.verticesY[i];
            lastVertZ = this.verticesZ[i];
            if (hasVertexSkins === 1 && this.vertexSkins) {
                this.vertexSkins[i] = buf5.readUnsignedByte();
            }
        }

        if (hasMayaGroups === 1) {
            for (let i = 0; i < vertexCount; i++) {
                const var41 = buf5.readUnsignedByte();
                this.animMayaGroups[i] = new Int32Array(var41);
                this.animMayaScales[i] = new Int32Array(var41);

                for (let j = 0; j < var41; j++) {
                    this.animMayaGroups[i][j] = buf5.readUnsignedByte();
                    this.animMayaScales[i][j] = buf5.readUnsignedByte();
                }
            }
        }

        buf1.offset = var32;
        buf2.offset = var28;
        buf3.offset = var26;
        buf4.offset = var30;
        buf5.offset = var27;

        for (let i = 0; i < faceCount; i++) {
            this.faceColors[i] = buf1.readUnsignedShort();
            if (var12 === 1 && this.faceRenderTypes && this.textureCoords && this.faceTextures) {
                const var41 = buf2.readUnsignedByte();
                if ((var41 & 1) === 1) {
                    this.faceRenderTypes[i] = 1;
                    var2 = true;
                } else {
                    this.faceRenderTypes[i] = 0;
                }

                if ((var41 & 2) === 2) {
                    this.textureCoords[i] = var41 >> 2;
                    this.faceTextures[i] = this.faceColors[i];
                    this.faceColors[i] = 127;
                    if (this.faceTextures[i] !== -1) {
                        var3 = true;
                    }
                } else {
                    this.textureCoords[i] = -1;
                    this.faceTextures[i] = -1;
                }
            }

            if (var13 === 255) {
                this.faceRenderPriorities[i] = buf3.readByte();
            }

            if (var14 === 1) {
                this.faceAlphas[i] = buf4.readByte();
            }

            if (var15 === 1 && this.faceSkins) {
                this.faceSkins[i] = buf5.readUnsignedByte();
            }
        }

        buf1.offset = var31;
        buf2.offset = var25;
        let var40 = 0;
        let var41 = 0;
        let var42 = 0;
        let var43 = 0;

        for (let i = 0; i < faceCount; i++) {
            const var45 = buf2.readUnsignedByte();
            if (var45 === 1) {
                var40 = buf1.readSmart2() + var43;
                var41 = buf1.readSmart2() + var40;
                var42 = buf1.readSmart2() + var41;
                var43 = var42;
                this.indices1[i] = var40;
                this.indices2[i] = var41;
                this.indices3[i] = var42;
            }

            if (var45 === 2) {
                var41 = var42;
                var42 = buf1.readSmart2() + var43;
                var43 = var42;
                this.indices1[i] = var40;
                this.indices2[i] = var41;
                this.indices3[i] = var42;
            }

            if (var45 === 3) {
                var40 = var42;
                var42 = buf1.readSmart2() + var43;
                var43 = var42;
                this.indices1[i] = var40;
                this.indices2[i] = var41;
                this.indices3[i] = var42;
            }

            if (var45 === 4) {
                const var46 = var40;
                var40 = var41;
                var41 = var46;
                var42 = buf1.readSmart2() + var43;
                var43 = var42;
                this.indices1[i] = var40;
                this.indices2[i] = var46;
                this.indices3[i] = var42;
            }
        }

        buf1.offset = var33;

        for (let i = 0; i < texTriangleCount; i++) {
            this.textureRenderTypes[i] = 0;
            this.textureMappingP[i] = buf1.readUnsignedShort();
            this.textureMappingM[i] = buf1.readUnsignedShort();
            this.textureMappingN[i] = buf1.readUnsignedShort();
        }

        if (this.textureCoords) {
            let var48 = false;

            for (let i = 0; i < faceCount; i++) {
                const coord = this.textureCoords[i] & 255;
                if (coord !== 255) {
                    if (
                        this.indices1[i] === (this.textureMappingP[coord] & 0xffff) &&
                        this.indices2[i] === (this.textureMappingM[coord] & 0xffff) &&
                        this.indices3[i] === (this.textureMappingN[coord] & 0xffff)
                    ) {
                        this.textureCoords[i] = -1;
                    } else {
                        var48 = true;
                    }
                }
            }

            if (!var48) {
                this.textureCoords = undefined;
            }
        }

        if (!var3) {
            this.faceTextures = undefined;
        }

        if (!var2) {
            this.faceRenderTypes = undefined;
        }
    }

    scaleDown(n: number): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] >>= n;
            this.verticesY[i] >>= n;
            this.verticesZ[i] >>= n;
        }
        if (this.textureFaceCount > 0 && this.textureScaleX) {
            for (let i = 0; i < this.textureFaceCount; i++) {
                this.textureScaleX[i] >>= n;
                this.textureScaleY[i] >>= n;
                if (this.textureRenderTypes[i] !== 1) {
                    this.textureScaleZ[i] >>= n;
                }
            }
        }
    }

    decodeV1(data: Int8Array): void {
        this.version = 1;
        const buf1 = new ByteBuffer(data);
        const buf2 = new ByteBuffer(data);
        const buf3 = new ByteBuffer(data);
        const buf4 = new ByteBuffer(data);
        const buf5 = new ByteBuffer(data);
        const buf6 = new ByteBuffer(data);
        const buf7 = new ByteBuffer(data);
        buf1.offset = data.length - 23;
        const vertexCount = buf1.readUnsignedShort();
        const faceCount = buf1.readUnsignedShort();
        const texFaceCount = buf1.readUnsignedByte();
        const flags = buf1.readUnsignedByte();
        const hasFaceRenderTypes = (flags & 0x1) === 1;
        const hasParticles = (flags & 0x2) === 2;
        const hasBillboards = (flags & 0x4) === 4;
        const hasVersion = (flags & 0x8) === 8;
        if (hasVersion) {
            buf1.offset -= 7;
            this.version = buf1.readUnsignedByte();
            buf1.offset += 6;
        }
        const modelPriority = buf1.readUnsignedByte();
        const hasFaceAlpha = buf1.readUnsignedByte();
        const hasFaceSkins = buf1.readUnsignedByte();
        const hasFaceTextures = buf1.readUnsignedByte();
        const hasVertexSkins = buf1.readUnsignedByte();
        const modelVerticesX = buf1.readUnsignedShort();
        const modelVerticesY = buf1.readUnsignedShort();
        const modelVerticesZ = buf1.readUnsignedShort();
        const faceIndices = buf1.readUnsignedShort();
        const textureIndices = buf1.readUnsignedShort();
        let simpleTextureFaceCount = 0;
        let complexTextureFaceCount = 0;
        let cubeTextureFaceCount = 0;
        if (texFaceCount > 0) {
            this.textureRenderTypes = new Int8Array(texFaceCount);
            buf1.offset = 0;

            for (let i = 0; i < texFaceCount; i++) {
                const type = (this.textureRenderTypes[i] = buf1.readByte());
                if (type === 0) {
                    simpleTextureFaceCount++;
                }

                if (type >= 1 && type <= 3) {
                    complexTextureFaceCount++;
                }

                if (type === 2) {
                    cubeTextureFaceCount++;
                }
            }
        }

        let offset = texFaceCount + vertexCount;
        const vertexFlagsOffset = offset;
        if (hasFaceRenderTypes) {
            offset += faceCount;
        }

        const faceCompressTypeOffset = offset;
        offset += faceCount;
        const facePrioritiesOffset = offset;
        if (modelPriority === 255) {
            offset += faceCount;
        }

        const faceSkinsOffset = offset;
        if (hasFaceSkins === 1) {
            offset += faceCount;
        }

        const vertexSkinsOffset = offset;
        if (hasVertexSkins === 1) {
            offset += vertexCount;
        }

        const faceAlphasOffset = offset;
        if (hasFaceAlpha === 1) {
            offset += faceCount;
        }

        const faceIndicesOffset = offset;
        offset += faceIndices;
        const faceMaterialsOffset = offset;
        if (hasFaceTextures === 1) {
            offset += faceCount * 2;
        }

        const faceTextureIndicesOffset = offset;
        offset += textureIndices;
        const faceColorsOffset = offset;
        offset += faceCount * 2;
        const xVertexOffset = offset;
        offset += modelVerticesX;
        const yVertexOffset = offset;
        offset += modelVerticesY;
        const zVertexOffset = offset;
        offset += modelVerticesZ;
        const simpleTexturesOffset = offset;
        offset += simpleTextureFaceCount * 6;
        const complexTexturesOffset = offset;
        offset += complexTextureFaceCount * 6;
        let textureBytes = 6;
        if (this.version === 14) {
            textureBytes = 7;
        } else if (this.version >= 15) {
            textureBytes = 9;
        }
        const texturesScalesOffset = offset;
        offset += complexTextureFaceCount * textureBytes;
        const texturesRotationOffset = offset;
        offset += complexTextureFaceCount;
        const texturesDirectionOffset = offset;
        offset += complexTextureFaceCount;
        const texturesTranslationOffset = offset;
        offset += complexTextureFaceCount + cubeTextureFaceCount * 2;
        const particleEffectsOffset = offset;
        this.verticesCount = vertexCount;
        this.faceCount = faceCount;
        this.textureFaceCount = texFaceCount;
        this.verticesX = new Int32Array(vertexCount);
        this.verticesY = new Int32Array(vertexCount);
        this.verticesZ = new Int32Array(vertexCount);
        this.indices1 = new Int32Array(faceCount);
        this.indices2 = new Int32Array(faceCount);
        this.indices3 = new Int32Array(faceCount);
        if (hasVertexSkins === 1) {
            this.vertexSkins = new Int32Array(vertexCount);
        }

        if (hasFaceRenderTypes) {
            this.faceRenderTypes = new Int8Array(faceCount);
        }

        if (modelPriority === 255) {
            this.faceRenderPriorities = new Int8Array(faceCount);
        } else {
            this.priority = modelPriority;
        }

        if (hasFaceAlpha === 1) {
            this.faceAlphas = new Int8Array(faceCount);
        }

        if (hasFaceSkins === 1) {
            this.faceSkins = new Int32Array(faceCount);
        }

        if (hasFaceTextures === 1) {
            this.faceTextures = new Int16Array(faceCount);
        }

        if (hasFaceTextures === 1 && texFaceCount > 0) {
            this.textureCoords = new Int8Array(faceCount);
        }

        this.faceColors = new Uint16Array(faceCount);
        if (texFaceCount > 0) {
            this.textureMappingP = new Int16Array(texFaceCount);
            this.textureMappingM = new Int16Array(texFaceCount);
            this.textureMappingN = new Int16Array(texFaceCount);
            if (complexTextureFaceCount > 0) {
                this.textureScaleX = new Int32Array(complexTextureFaceCount);
                this.textureScaleY = new Int32Array(complexTextureFaceCount);
                this.textureScaleZ = new Int32Array(complexTextureFaceCount);
                this.textureRotation = new Int8Array(complexTextureFaceCount);
                this.textureDirection = new Int8Array(complexTextureFaceCount);
                this.textureSpeed = new Int32Array(complexTextureFaceCount);
            }
            if (cubeTextureFaceCount > 0) {
                this.textureTransU = new Int32Array(cubeTextureFaceCount);
                this.textureTransV = new Int32Array(cubeTextureFaceCount);
            }
        }

        buf1.offset = texFaceCount;
        buf2.offset = xVertexOffset;
        buf3.offset = yVertexOffset;
        buf4.offset = zVertexOffset;
        buf5.offset = vertexSkinsOffset;
        let lastVertX = 0;
        let lastVertY = 0;
        let lastVertZ = 0;

        for (let i = 0; i < vertexCount; i++) {
            const flag = buf1.readUnsignedByte();
            let deltaVertX = 0;
            if ((flag & 1) !== 0) {
                deltaVertX = buf2.readSmart2();
            }

            let deltaVertY = 0;
            if ((flag & 2) !== 0) {
                deltaVertY = buf3.readSmart2();
            }

            let deltaVertZ = 0;
            if ((flag & 4) !== 0) {
                deltaVertZ = buf4.readSmart2();
            }

            this.verticesX[i] = lastVertX + deltaVertX;
            this.verticesY[i] = lastVertY + deltaVertY;
            this.verticesZ[i] = lastVertZ + deltaVertZ;
            lastVertX = this.verticesX[i];
            lastVertY = this.verticesY[i];
            lastVertZ = this.verticesZ[i];
            if (hasVertexSkins === 1 && this.vertexSkins) {
                this.vertexSkins[i] = buf5.readUnsignedByte();
            }
        }

        buf1.offset = faceColorsOffset;
        buf2.offset = vertexFlagsOffset;
        buf3.offset = facePrioritiesOffset;
        buf4.offset = faceAlphasOffset;
        buf5.offset = faceSkinsOffset;
        buf6.offset = faceMaterialsOffset;
        buf7.offset = faceTextureIndicesOffset;

        for (let i = 0; i < faceCount; i++) {
            this.faceColors[i] = buf1.readUnsignedShort();
            if (hasFaceRenderTypes && this.faceRenderTypes) {
                this.faceRenderTypes[i] = buf2.readByte();
            }

            if (modelPriority === 255) {
                this.faceRenderPriorities[i] = buf3.readByte();
            }

            if (hasFaceAlpha === 1) {
                this.faceAlphas[i] = buf4.readByte();
            }

            if (hasFaceSkins === 1 && this.faceSkins) {
                this.faceSkins[i] = buf5.readUnsignedByte();
            }

            if (hasFaceTextures === 1 && this.faceTextures) {
                this.faceTextures[i] = buf6.readUnsignedShort() - 1;
            }

            if (this.textureCoords) {
                if (this.faceTextures && this.faceTextures[i] !== -1) {
                    this.textureCoords[i] = buf7.readUnsignedByte() - 1;
                } else {
                    this.textureCoords[i] = -1;
                }
            }
        }

        buf1.offset = faceIndicesOffset;
        buf2.offset = faceCompressTypeOffset;
        let index1 = 0;
        let index2 = 0;
        let index3 = 0;
        let var54 = 0;

        this.usedVertexCount = -1;
        for (let i = 0; i < faceCount; i++) {
            const type = buf2.readUnsignedByte();
            if (type === 1) {
                index1 = buf1.readSmart2() + var54;
                index2 = buf1.readSmart2() + index1;
                index3 = buf1.readSmart2() + index2;
                var54 = index3;
                this.indices1[i] = index1;
                this.indices2[i] = index2;
                this.indices3[i] = index3;
                if (index1 > this.usedVertexCount) {
                    this.usedVertexCount = index1;
                }
                if (index2 > this.usedVertexCount) {
                    this.usedVertexCount = index2;
                }
                if (index3 > this.usedVertexCount) {
                    this.usedVertexCount = index3;
                }
            }

            if (type === 2) {
                index2 = index3;
                index3 = buf1.readSmart2() + var54;
                var54 = index3;
                this.indices1[i] = index1;
                this.indices2[i] = index2;
                this.indices3[i] = index3;
                if (index3 > this.usedVertexCount) {
                    this.usedVertexCount = index3;
                }
            }

            if (type === 3) {
                index1 = index3;
                index3 = buf1.readSmart2() + var54;
                var54 = index3;
                this.indices1[i] = index1;
                this.indices2[i] = index2;
                this.indices3[i] = index3;
                if (index3 > this.usedVertexCount) {
                    this.usedVertexCount = index3;
                }
            }

            if (type === 4) {
                const var57 = index1;
                index1 = index2;
                index2 = var57;
                index3 = buf1.readSmart2() + var54;
                var54 = index3;
                this.indices1[i] = index1;
                this.indices2[i] = var57;
                this.indices3[i] = index3;
                if (index3 > this.usedVertexCount) {
                    this.usedVertexCount = index3;
                }
            }
        }
        this.usedVertexCount++;

        buf1.offset = simpleTexturesOffset;
        buf2.offset = complexTexturesOffset;
        buf3.offset = texturesScalesOffset;
        buf4.offset = texturesRotationOffset;
        buf5.offset = texturesDirectionOffset;
        buf6.offset = texturesTranslationOffset;

        this.decodeTextureMapping(buf1, buf2, buf3, buf4, buf5, buf6);

        buf1.offset = offset;

        if (this.version >= 13) {
            this.scaleDown(2);
        }

        // const var55 = buf1.readUnsignedByte();
        // if (var55 !== 0) {
        //     // new ModelData0();
        //     buf1.readUnsignedShort();
        //     buf1.readUnsignedShort();
        //     buf1.readUnsignedShort();
        //     buf1.readInt();
        // }
    }

    decodeTextureMapping(
        simpleBuffer: ByteBuffer,
        complexBuffer: ByteBuffer,
        scaleBuffer: ByteBuffer,
        rotationBuffer: ByteBuffer,
        directionBuffer: ByteBuffer,
        translationBuffer: ByteBuffer,
    ): void {
        for (let i = 0; i < this.textureFaceCount; i++) {
            const type = this.textureRenderTypes[i] & 0xff;
            if (type === 0) {
                this.textureMappingP[i] = simpleBuffer.readUnsignedShort();
                this.textureMappingM[i] = simpleBuffer.readUnsignedShort();
                this.textureMappingN[i] = simpleBuffer.readUnsignedShort();
            }
            if (type === 1) {
                this.textureMappingP[i] = complexBuffer.readUnsignedShort();
                this.textureMappingM[i] = complexBuffer.readUnsignedShort();
                this.textureMappingN[i] = complexBuffer.readUnsignedShort();
                if (this.version < 15) {
                    this.textureScaleX[i] = scaleBuffer.readUnsignedShort();
                    if (this.version >= 14) {
                        this.textureScaleY[i] = scaleBuffer.readMedium();
                    } else {
                        this.textureScaleY[i] = scaleBuffer.readUnsignedShort();
                    }
                    this.textureScaleZ[i] = scaleBuffer.readUnsignedShort();
                } else {
                    this.textureScaleX[i] = scaleBuffer.readMedium();
                    this.textureScaleY[i] = scaleBuffer.readMedium();
                    this.textureScaleZ[i] = scaleBuffer.readMedium();
                }
                this.textureRotation[i] = rotationBuffer.readByte();
                this.textureDirection[i] = directionBuffer.readByte();
                this.textureSpeed[i] = translationBuffer.readByte();
            }
            if (type === 2) {
                this.textureMappingP[i] = complexBuffer.readUnsignedShort();
                this.textureMappingM[i] = complexBuffer.readUnsignedShort();
                this.textureMappingN[i] = complexBuffer.readUnsignedShort();
                if (this.version < 15) {
                    this.textureScaleX[i] = scaleBuffer.readUnsignedShort();
                    if (this.version >= 14) {
                        this.textureScaleY[i] = scaleBuffer.readMedium();
                    } else {
                        this.textureScaleY[i] = scaleBuffer.readUnsignedShort();
                    }
                    this.textureScaleZ[i] = scaleBuffer.readUnsignedShort();
                } else {
                    this.textureScaleX[i] = scaleBuffer.readMedium();
                    this.textureScaleY[i] = scaleBuffer.readMedium();
                    this.textureScaleZ[i] = scaleBuffer.readMedium();
                }
                this.textureRotation[i] = rotationBuffer.readByte();
                this.textureDirection[i] = directionBuffer.readByte();
                this.textureSpeed[i] = translationBuffer.readByte();
                this.textureTransU[i] = translationBuffer.readByte();
                this.textureTransV[i] = translationBuffer.readByte();
            }
            if (type === 3) {
                // same as 1, TODO: combine
                this.textureMappingP[i] = complexBuffer.readUnsignedShort();
                this.textureMappingM[i] = complexBuffer.readUnsignedShort();
                this.textureMappingN[i] = complexBuffer.readUnsignedShort();
                if (this.version < 15) {
                    this.textureScaleX[i] = scaleBuffer.readUnsignedShort();
                    if (this.version >= 14) {
                        this.textureScaleY[i] = scaleBuffer.readMedium();
                    } else {
                        this.textureScaleY[i] = scaleBuffer.readUnsignedShort();
                    }
                    this.textureScaleZ[i] = scaleBuffer.readUnsignedShort();
                } else {
                    this.textureScaleX[i] = scaleBuffer.readMedium();
                    this.textureScaleY[i] = scaleBuffer.readMedium();
                    this.textureScaleZ[i] = scaleBuffer.readMedium();
                }
                this.textureRotation[i] = rotationBuffer.readByte();
                this.textureDirection[i] = directionBuffer.readByte();
                this.textureSpeed[i] = translationBuffer.readByte();
            }
        }
    }

    decodeOld(data: Int8Array): void {
        this.version = 0;
        let var2 = false;
        let var3 = false;
        const buf1 = new ByteBuffer(data);
        const buf2 = new ByteBuffer(data);
        const buf3 = new ByteBuffer(data);
        const buf4 = new ByteBuffer(data);
        const buf5 = new ByteBuffer(data);
        buf1.offset = data.length - 18;
        const vertexCount = buf1.readUnsignedShort();
        const faceCount = buf1.readUnsignedShort();
        const texTriangleCount = buf1.readUnsignedByte();
        const usesTextures = buf1.readUnsignedByte();
        const var13 = buf1.readUnsignedByte();
        const var14 = buf1.readUnsignedByte();
        const var15 = buf1.readUnsignedByte();
        const var16 = buf1.readUnsignedByte();
        const var17 = buf1.readUnsignedShort();
        const var18 = buf1.readUnsignedShort();
        const var19 = buf1.readUnsignedShort();
        const var20 = buf1.readUnsignedShort();
        let var21 = 0;
        let var45 = var21 + vertexCount;
        let var23 = var45;
        var45 += faceCount;
        const var24 = var45;
        if (var13 === 255) {
            var45 += faceCount;
        }

        const var25 = var45;
        if (var15 === 1) {
            var45 += faceCount;
        }

        const var26 = var45;
        if (usesTextures === 1) {
            var45 += faceCount;
        }

        const var27 = var45;
        if (var16 === 1) {
            var45 += vertexCount;
        }

        const var28 = var45;
        if (var14 === 1) {
            var45 += faceCount;
        }

        const var29 = var45;
        var45 += var20;
        const var30 = var45;
        var45 += faceCount * 2;
        const var31 = var45;
        var45 += texTriangleCount * 6;
        const var32 = var45;
        var45 += var17;
        const var33 = var45;
        var45 += var18;
        // const var10000 = var45 + var19;
        this.verticesCount = vertexCount;
        this.faceCount = faceCount;
        this.textureFaceCount = texTriangleCount;
        this.verticesX = new Int32Array(vertexCount);
        this.verticesY = new Int32Array(vertexCount);
        this.verticesZ = new Int32Array(vertexCount);
        this.indices1 = new Int32Array(faceCount);
        this.indices2 = new Int32Array(faceCount);
        this.indices3 = new Int32Array(faceCount);
        if (texTriangleCount > 0) {
            this.textureRenderTypes = new Int8Array(texTriangleCount);
            this.textureMappingP = new Int16Array(texTriangleCount);
            this.textureMappingM = new Int16Array(texTriangleCount);
            this.textureMappingN = new Int16Array(texTriangleCount);
        }

        if (var16 === 1) {
            this.vertexSkins = new Int32Array(vertexCount);
        }

        if (usesTextures === 1) {
            this.faceRenderTypes = new Int8Array(faceCount);
            this.textureCoords = new Int8Array(faceCount);
            this.faceTextures = new Int16Array(faceCount);
        }

        if (var13 === 255) {
            this.faceRenderPriorities = new Int8Array(faceCount);
        } else {
            this.priority = var13;
        }

        if (var14 === 1) {
            this.faceAlphas = new Int8Array(faceCount);
        }

        if (var15 === 1) {
            this.faceSkins = new Int32Array(faceCount);
        }

        this.faceColors = new Uint16Array(faceCount);
        buf1.offset = var21;
        buf2.offset = var32;
        buf3.offset = var33;
        buf4.offset = var45;
        buf5.offset = var27;
        let lastVertX = 0;
        let lastVertY = 0;
        let lastVertZ = 0;

        for (let i = 0; i < vertexCount; i++) {
            const flag = buf1.readUnsignedByte();
            let deltaVertX = 0;
            if ((flag & 1) !== 0) {
                deltaVertX = buf2.readSmart2();
            }

            let deltaVertY = 0;
            if ((flag & 2) !== 0) {
                deltaVertY = buf3.readSmart2();
            }

            let deltaVertZ = 0;
            if ((flag & 4) !== 0) {
                deltaVertZ = buf4.readSmart2();
            }

            this.verticesX[i] = lastVertX + deltaVertX;
            this.verticesY[i] = lastVertY + deltaVertY;
            this.verticesZ[i] = lastVertZ + deltaVertZ;
            lastVertX = this.verticesX[i];
            lastVertY = this.verticesY[i];
            lastVertZ = this.verticesZ[i];
            if (var16 === 1 && this.vertexSkins) {
                this.vertexSkins[i] = buf5.readUnsignedByte();
            }
        }

        buf1.offset = var30;
        buf2.offset = var26;
        buf3.offset = var24;
        buf4.offset = var28;
        buf5.offset = var25;

        for (let i = 0; i < faceCount; i++) {
            this.faceColors[i] = buf1.readUnsignedShort();
            if (
                usesTextures === 1 &&
                this.faceRenderTypes &&
                this.textureCoords &&
                this.faceTextures
            ) {
                const flag = buf2.readUnsignedByte();
                if ((flag & 1) === 1) {
                    this.faceRenderTypes[i] = 1;
                    var2 = true;
                } else {
                    this.faceRenderTypes[i] = 0;
                }

                if ((flag & 2) === 2) {
                    this.textureCoords[i] = flag >> 2;
                    this.faceTextures[i] = this.faceColors[i];
                    this.faceColors[i] = 127;
                    if (this.faceTextures[i] !== -1) {
                        var3 = true;
                    }
                } else {
                    this.textureCoords[i] = -1;
                    this.faceTextures[i] = -1;
                }
            }

            if (var13 === 255) {
                this.faceRenderPriorities[i] = buf3.readByte();
            }

            if (var14 === 1) {
                this.faceAlphas[i] = buf4.readByte();
            }

            if (var15 === 1 && this.faceSkins) {
                this.faceSkins[i] = buf5.readUnsignedByte();
            }
        }

        buf1.offset = var29;
        buf2.offset = var23;
        let index1 = 0;
        let index2 = 0;
        let index3 = 0;
        let var41 = 0;

        this.usedVertexCount = -1;
        for (let i = 0; i < faceCount; i++) {
            const type = buf2.readUnsignedByte();
            if (type === 1) {
                index1 = buf1.readSmart2() + var41;
                index2 = buf1.readSmart2() + index1;
                index3 = buf1.readSmart2() + index2;
                var41 = index3;
                this.indices1[i] = index1;
                this.indices2[i] = index2;
                this.indices3[i] = index3;
                if (index1 > this.usedVertexCount) {
                    this.usedVertexCount = index1;
                }
                if (index2 > this.usedVertexCount) {
                    this.usedVertexCount = index2;
                }
                if (index3 > this.usedVertexCount) {
                    this.usedVertexCount = index3;
                }
            }

            if (type === 2) {
                index2 = index3;
                index3 = buf1.readSmart2() + var41;
                var41 = index3;
                this.indices1[i] = index1;
                this.indices2[i] = index2;
                this.indices3[i] = index3;
                if (index3 > this.usedVertexCount) {
                    this.usedVertexCount = index3;
                }
            }

            if (type === 3) {
                index1 = index3;
                index3 = buf1.readSmart2() + var41;
                var41 = index3;
                this.indices1[i] = index1;
                this.indices2[i] = index2;
                this.indices3[i] = index3;
                if (index3 > this.usedVertexCount) {
                    this.usedVertexCount = index3;
                }
            }

            if (type === 4) {
                const var44 = index1;
                index1 = index2;
                index2 = var44;
                index3 = buf1.readSmart2() + var41;
                var41 = index3;
                this.indices1[i] = index1;
                this.indices2[i] = var44;
                this.indices3[i] = index3;
                if (index3 > this.usedVertexCount) {
                    this.usedVertexCount = index3;
                }
            }
        }
        this.usedVertexCount++;

        buf1.offset = var31;

        for (let i = 0; i < texTriangleCount; i++) {
            this.textureRenderTypes[i] = 0;
            this.textureMappingP[i] = buf1.readUnsignedShort();
            this.textureMappingM[i] = buf1.readUnsignedShort();
            this.textureMappingN[i] = buf1.readUnsignedShort();
        }

        if (this.textureCoords) {
            let hasValidTexFace = false;

            for (let i = 0; i < faceCount; i++) {
                const var44 = this.textureCoords[i] & 255;
                if (var44 !== 255) {
                    if (
                        this.indices1[i] === (this.textureMappingP[var44] & 0xffff) &&
                        this.indices2[i] === (this.textureMappingM[var44] & 0xffff) &&
                        this.indices3[i] === (this.textureMappingN[var44] & 0xffff)
                    ) {
                        this.textureCoords[i] = -1;
                    } else {
                        hasValidTexFace = true;
                    }
                }
            }

            if (!hasValidTexFace) {
                this.textureCoords = undefined;
            }
        }

        if (!var3) {
            this.faceTextures = undefined;
        }

        if (!var2) {
            this.faceRenderTypes = undefined;
        }
    }

    copyFrom(
        model: ModelData,
        shallowIndices: boolean,
        shallowVertices: boolean,
        shallowColors: boolean,
        shallowTextures: boolean,
    ): void {
        this.verticesCount = model.verticesCount;
        this.usedVertexCount = model.usedVertexCount;
        this.faceCount = model.faceCount;
        this.textureFaceCount = model.textureFaceCount;

        if (shallowIndices) {
            this.indices1 = model.indices1;
            this.indices2 = model.indices2;
            this.indices3 = model.indices3;
        } else {
            this.indices1 = new Int32Array(this.faceCount);
            this.indices2 = new Int32Array(this.faceCount);
            this.indices3 = new Int32Array(this.faceCount);

            for (let i = 0; i < this.faceCount; i++) {
                this.indices1[i] = model.indices1[i];
                this.indices2[i] = model.indices2[i];
                this.indices3[i] = model.indices3[i];
            }
        }

        if (shallowVertices) {
            this.verticesX = model.verticesX;
            this.verticesY = model.verticesY;
            this.verticesZ = model.verticesZ;
        } else {
            this.verticesX = new Int32Array(this.verticesCount);
            this.verticesY = new Int32Array(this.verticesCount);
            this.verticesZ = new Int32Array(this.verticesCount);

            for (let i = 0; i < this.verticesCount; i++) {
                this.verticesX[i] = model.verticesX[i];
                this.verticesY[i] = model.verticesY[i];
                this.verticesZ[i] = model.verticesZ[i];
            }
        }

        if (shallowColors) {
            this.faceColors = model.faceColors;
        } else {
            this.faceColors = new Uint16Array(this.faceCount);

            for (let i = 0; i < this.faceCount; i++) {
                this.faceColors[i] = model.faceColors[i];
            }
        }

        if (!shallowTextures && model.faceTextures) {
            this.faceTextures = new Int16Array(this.faceCount);

            for (let i = 0; i < this.faceCount; i++) {
                this.faceTextures[i] = model.faceTextures[i];
            }
        } else {
            this.faceTextures = model.faceTextures;
        }

        this.faceAlphas = model.faceAlphas;
        this.faceRenderTypes = model.faceRenderTypes;
        this.faceRenderPriorities = model.faceRenderPriorities;
        this.textureCoords = model.textureCoords;
        this.priority = model.priority;
        this.textureRenderTypes = model.textureRenderTypes;
        this.textureMappingP = model.textureMappingP;
        this.textureMappingM = model.textureMappingM;
        this.textureMappingN = model.textureMappingN;
        this.textureScaleX = model.textureScaleX;
        this.textureScaleY = model.textureScaleY;
        this.textureScaleZ = model.textureScaleZ;
        this.textureRotation = model.textureRotation;
        this.textureDirection = model.textureDirection;
        this.textureSpeed = model.textureSpeed;
        this.textureTransU = model.textureTransU;
        this.textureTransV = model.textureTransV;
        this.vertexSkins = model.vertexSkins;
        this.faceSkins = model.faceSkins;
        this.vertexLabels = model.vertexLabels;
        this.faceLabels = model.faceLabels;
        this.normals = model.normals;
        this.faceNormals = model.faceNormals;
        this.mergedNormals = model.mergedNormals;
        this.animMayaGroups = model.animMayaGroups;
        this.animMayaScales = model.animMayaScales;
        this.ambient = model.ambient;
        this.contrast = model.contrast;
    }

    copy(): ModelData {
        const model = new ModelData();
        if (this.faceRenderTypes) {
            model.faceRenderTypes = new Int8Array(this.faceCount);

            for (let i = 0; i < this.faceCount; i++) {
                model.faceRenderTypes[i] = this.faceRenderTypes[i];
            }
        }

        model.verticesCount = this.verticesCount;
        model.usedVertexCount = this.usedVertexCount;
        model.faceCount = this.faceCount;
        model.textureFaceCount = this.textureFaceCount;
        model.verticesX = this.verticesX;
        model.verticesY = this.verticesY;
        model.verticesZ = this.verticesZ;
        model.indices1 = this.indices1;
        model.indices2 = this.indices2;
        model.indices3 = this.indices3;
        model.faceRenderPriorities = this.faceRenderPriorities;
        model.faceAlphas = this.faceAlphas;
        model.textureCoords = this.textureCoords;
        model.faceColors = this.faceColors;
        model.faceTextures = this.faceTextures;
        model.priority = this.priority;
        model.textureRenderTypes = this.textureRenderTypes;
        model.textureMappingP = this.textureMappingP;
        model.textureMappingM = this.textureMappingM;
        model.textureMappingN = this.textureMappingN;
        model.textureScaleX = this.textureScaleX;
        model.textureScaleY = this.textureScaleY;
        model.textureScaleZ = this.textureScaleZ;
        model.textureRotation = this.textureRotation;
        model.textureDirection = this.textureDirection;
        model.textureSpeed = this.textureSpeed;
        model.textureTransU = this.textureTransU;
        model.textureTransV = this.textureTransV;
        model.vertexSkins = this.vertexSkins;
        model.faceSkins = this.faceSkins;
        model.vertexLabels = this.vertexLabels;
        model.faceLabels = this.faceLabels;
        model.normals = this.normals;
        model.faceNormals = this.faceNormals;
        model.ambient = this.ambient;
        model.contrast = this.contrast;
        return model;
    }

    contourGround(
        type: number,
        param: number,
        heightMap: Int32Array[],
        heightMapAbove: Int32Array[] | undefined,
        sceneX: number,
        sceneHeight: number,
        sceneZ: number,
    ): ModelData {
        if (this.usedVertexCount === 0) {
            return this;
        }
        this.calculateBounds();
        let startX = sceneX + this.minX;
        let endX = sceneX + this.maxX;
        let startY = sceneZ + this.minZ;
        let endY = sceneZ + this.maxZ;
        if (
            (type === 1 || type === 2 || type === 3 || type === 5) &&
            (startX < 0 ||
                (endX + 128) >> 7 >= heightMap.length ||
                startY < 0 ||
                (endY + 128) >> 7 >= heightMap[0].length)
        ) {
            return this;
        }
        if (type === 4 || type === 5) {
            if (heightMapAbove === undefined) {
                return this;
            }
            if (
                startX < 0 ||
                (endX + 128) >> 7 >= heightMapAbove.length ||
                startY < 0 ||
                (endY + 128) >> 7 >= heightMapAbove[0].length
            ) {
                return this;
            }
        } else {
            startX >>= 7;
            endX = (endX + 127) >> 7;
            startY >>= 7;
            endY = (endY + 127) >> 7;
            if (
                heightMap[startX][startY] === sceneHeight &&
                heightMap[endX][startY] === sceneHeight &&
                heightMap[startX][endY] === sceneHeight &&
                heightMap[endX][endY] === sceneHeight
            ) {
                return this;
            }
        }
        const model = new ModelData();
        model.verticesCount = this.verticesCount;
        model.usedVertexCount = this.usedVertexCount;
        model.faceCount = this.faceCount;
        model.textureFaceCount = this.textureFaceCount;
        model.verticesX = this.verticesX;
        model.verticesZ = this.verticesZ;
        model.indices1 = this.indices1;
        model.indices2 = this.indices2;
        model.indices3 = this.indices3;
        model.faceRenderTypes = this.faceRenderTypes;
        model.faceRenderPriorities = this.faceRenderPriorities;
        model.faceAlphas = this.faceAlphas;
        model.textureCoords = this.textureCoords;
        model.faceColors = this.faceColors;
        model.faceTextures = this.faceTextures;
        model.priority = this.priority;
        model.textureRenderTypes = this.textureRenderTypes;
        model.textureMappingP = this.textureMappingP;
        model.textureMappingM = this.textureMappingM;
        model.textureMappingN = this.textureMappingN;
        model.textureScaleX = this.textureScaleX;
        model.textureScaleY = this.textureScaleY;
        model.textureScaleZ = this.textureScaleZ;
        model.textureRotation = this.textureRotation;
        model.textureDirection = this.textureDirection;
        model.textureSpeed = this.textureSpeed;
        model.textureTransU = this.textureTransU;
        model.textureTransV = this.textureTransV;
        model.vertexSkins = this.vertexSkins;
        model.faceSkins = this.faceSkins;
        model.vertexLabels = this.vertexLabels;
        model.faceLabels = this.faceLabels;
        model.ambient = this.ambient;
        model.contrast = this.contrast;
        model.verticesY = this.verticesY;
        model.contourVerticesY = new Int32Array(model.verticesCount);

        if (type === 1) {
            for (let i = 0; i < model.usedVertexCount; i++) {
                const vx = this.verticesX[i] + sceneX;
                const vz = this.verticesZ[i] + sceneZ;
                const rx = vx & 0x7f;
                const rz = vz & 0x7f;
                const tx = vx >> 7;
                const tz = vz >> 7;
                const h0 = (heightMap[tx][tz] * (128 - rx) + heightMap[tx + 1][tz] * rx) >> 7;
                const h1 =
                    (heightMap[tx][tz + 1] * (128 - rx) + heightMap[tx + 1][tz + 1] * rx) >> 7;
                const height = (h0 * (128 - rz) + h1 * rz) >> 7;
                model.contourVerticesY[i] = this.verticesY[i] + height - sceneHeight;
            }
            for (let i = model.usedVertexCount; i < model.verticesCount; i++) {
                const vx = this.verticesX[i] + sceneX;
                const vz = this.verticesZ[i] + sceneZ;
                const rx = vx & 0x7f;
                const rz = vz & 0x7f;
                const tx = vx >> 7;
                const tz = vz >> 7;
                if (
                    tx >= 0 &&
                    tx < heightMap.length - 1 &&
                    tz >= 0 &&
                    tz < heightMap[0].length - 1
                ) {
                    const h0 = (heightMap[tx][tz] * (128 - rx) + heightMap[tx + 1][tz] * rx) >> 7;
                    const h1 =
                        (heightMap[tx][tz + 1] * (128 - rx) + heightMap[tx + 1][tz + 1] * rx) >> 7;
                    const height = (h0 * (128 - rz) + h1 * rz) >> 7;
                    model.contourVerticesY[i] = this.verticesY[i] + height - sceneHeight;
                }
            }
        } else if (type === 2) {
            for (let i = 0; i < model.usedVertexCount; i++) {
                const yRatio = ((this.verticesY[i] << 16) / -this.height) | 0;
                if (yRatio < param) {
                    const vx = this.verticesX[i] + sceneX;
                    const vz = this.verticesZ[i] + sceneZ;
                    const rx = vx & 0x7f;
                    const rz = vz & 0x7f;
                    const tx = vx >> 7;
                    const tz = vz >> 7;
                    const h0 = (heightMap[tx][tz] * (128 - rx) + heightMap[tx + 1][tz] * rx) >> 7;
                    const h1 =
                        (heightMap[tx][tz + 1] * (128 - rx) + heightMap[tx + 1][tz + 1] * rx) >> 7;
                    const height = (h0 * (128 - rz) + h1 * rz) >> 7;
                    model.contourVerticesY[i] =
                        this.verticesY[i] + ((height - sceneHeight) * (param - yRatio)) / param;
                } else {
                    model.contourVerticesY[i] = this.verticesY[i];
                }
            }
            for (let i = model.usedVertexCount; i < model.verticesCount; i++) {
                const yRatio = ((this.verticesY[i] << 16) / -this.height) | 0;
                if (yRatio < param) {
                    const vx = this.verticesX[i] + sceneX;
                    const vz = this.verticesZ[i] + sceneZ;
                    const rx = vx & 0x7f;
                    const rz = vz & 0x7f;
                    const tx = vx >> 7;
                    const tz = vz >> 7;
                    if (
                        tx >= 0 &&
                        tx < heightMap.length - 1 &&
                        tz >= 0 &&
                        tz < heightMap[0].length - 1
                    ) {
                        const h0 =
                            (heightMap[tx][tz] * (128 - rx) + heightMap[tx + 1][tz] * rx) >> 7;
                        const h1 =
                            (heightMap[tx][tz + 1] * (128 - rx) + heightMap[tx + 1][tz + 1] * rx) >>
                            7;
                        const height = (h0 * (128 - rz) + h1 * rz) >> 7;
                        model.contourVerticesY[i] =
                            this.verticesY[i] + ((height - sceneHeight) * (param - yRatio)) / param;
                    }
                } else {
                    model.contourVerticesY[i] = this.verticesY[i];
                }
            }
        } else if (type === 3) {
            // TODO: implement contourGround type 3
            for (let i = 0; i < model.usedVertexCount; i++) {
                model.contourVerticesY[i] = this.verticesY[i];
            }
        } else if (type === 4) {
            const deltaY = this.maxY - this.minY;
            for (let i = 0; i < model.usedVertexCount; i++) {
                const vx = this.verticesX[i] + sceneX;
                const vz = this.verticesZ[i] + sceneZ;
                const rx = vx & 0x7f;
                const rz = vz & 0x7f;
                const tx = vx >> 7;
                const tz = vz >> 7;
                const h0 =
                    (heightMapAbove![tx][tz] * (128 - rx) + heightMapAbove![tx + 1][tz] * rx) >> 7;
                const h1 =
                    (heightMapAbove![tx][tz + 1] * (128 - rx) +
                        heightMapAbove![tx + 1][tz + 1] * rx) >>
                    7;
                const height = (h0 * (128 - rz) + h1 * rz) >> 7;
                model.contourVerticesY[i] = this.verticesY[i] + height - sceneHeight + deltaY;
            }
        } else if (type === 5) {
            const deltaY = this.maxY - this.minY;
            for (let i = 0; i < model.usedVertexCount; i++) {
                const vx = this.verticesX[i] + sceneX;
                const vz = this.verticesZ[i] + sceneZ;
                const rx = vx & 0x7f;
                const rz = vz & 0x7f;
                const tx = vx >> 7;
                const tz = vz >> 7;
                let h0 = (heightMap[tx][tz] * (128 - rx) + heightMap[tx + 1][tz] * rx) >> 7;
                let h1 = (heightMap[tx][tz + 1] * (128 - rx) + heightMap[tx + 1][tz + 1] * rx) >> 7;
                const height = (h0 * (128 - rz) + h1 * rz) >> 7;
                h0 = (heightMapAbove![tx][tz] * (128 - rx) + heightMapAbove![tx + 1][tz] * rx) >> 7;
                h1 =
                    (heightMapAbove![tx][tz + 1] * (128 - rx) +
                        heightMapAbove![tx + 1][tz + 1] * rx) >>
                    7;
                const heightAbove = (h0 * (128 - rz) + h1 * rz) >> 7;
                const deltaHeight = height - heightAbove;

                model.contourVerticesY[i] =
                    (((((this.verticesY[i] << 8) / deltaY) | 0) * deltaHeight) >> 8) -
                    (sceneHeight - height);

                // there is something wrong with this calculation, possibly something to do with scaling down
                // model.contourVerticesY[i] -= 13;
                // model.contourVerticesY[i] = this.verticesY[i];
            }
        }

        model.invalidate();
        return model;
    }

    computeAnimationTables(): void {
        let skin: number;
        if (this.vertexSkins) {
            const labelCounts: number[] = new Array(256).fill(0);
            let highestSkin = 0;

            const vertexCount = this.usedVertexCount;
            for (let i = 0; i < vertexCount; i++) {
                skin = this.vertexSkins[i];
                if (skin >= 0) {
                    labelCounts[skin]++;
                    if (skin > highestSkin) {
                        highestSkin = skin;
                    }
                }
            }

            this.vertexLabels = new Array(highestSkin + 1);

            for (let i = 0; i <= highestSkin; i++) {
                this.vertexLabels[i] = new Int32Array(labelCounts[i]);
                labelCounts[i] = 0;
            }

            for (let label = 0; label < vertexCount; label++) {
                const skin = this.vertexSkins[label];
                if (skin >= 0) {
                    this.vertexLabels[skin][labelCounts[skin]++] = label;
                }
            }

            this.vertexSkins = undefined;
        }

        if (this.faceSkins) {
            const labelCounts: number[] = new Array(256).fill(0);
            let highestSkin = 0;

            for (let i = 0; i < this.faceCount; i++) {
                skin = this.faceSkins[i];
                if (skin >= 0) {
                    labelCounts[skin]++;
                    if (skin > highestSkin) {
                        highestSkin = skin;
                    }
                }
            }

            this.faceLabels = new Array(highestSkin + 1);

            for (let i = 0; i <= highestSkin; i++) {
                this.faceLabels[i] = new Int32Array(labelCounts[i]);
                labelCounts[i] = 0;
            }

            for (let label = 0; label < this.faceCount; label++) {
                const skin = this.faceSkins[label];
                if (skin >= 0) {
                    this.faceLabels[skin][labelCounts[skin]++] = label;
                }
            }

            this.faceSkins = undefined;
        }
    }

    rotate90(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            const temp = this.verticesX[i];
            this.verticesX[i] = this.verticesZ[i];
            this.verticesZ[i] = -temp;
        }

        this.invalidate();
    }

    rotate180(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] = -this.verticesX[i];
            this.verticesZ[i] = -this.verticesZ[i];
        }

        this.invalidate();
    }

    rotate270(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            const temp = this.verticesZ[i];
            this.verticesZ[i] = this.verticesX[i];
            this.verticesX[i] = -temp;
        }

        this.invalidate();
    }

    rotate(angle: number): void {
        const sin = SINE[angle];
        const cos = COSINE[angle];

        for (let i = 0; i < this.verticesCount; i++) {
            const temp = (sin * this.verticesZ[i] + cos * this.verticesX[i]) >> 16;
            this.verticesZ[i] = (cos * this.verticesZ[i] - sin * this.verticesX[i]) >> 16;
            this.verticesX[i] = temp;
        }

        this.invalidate();
    }

    translate(x: number, y: number, z: number): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] += x;
            this.verticesY[i] += y;
            this.verticesZ[i] += z;
        }

        this.invalidate();
    }

    recolor(from: number, to: number): void {
        for (let i = 0; i < this.faceCount; i++) {
            if (this.faceColors[i] === from) {
                this.faceColors[i] = to;
            }
        }
    }

    retexture(from: number, to: number): void {
        if (this.faceTextures) {
            for (let i = 0; i < this.faceCount; i++) {
                if (this.faceTextures[i] === from) {
                    this.faceTextures[i] = to;
                }
            }
        }
    }

    mirror() {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesZ[i] = -this.verticesZ[i];
        }

        for (let i = 0; i < this.faceCount; i++) {
            const temp = this.indices1[i];
            this.indices1[i] = this.indices3[i];
            this.indices3[i] = temp;
        }

        this.invalidate();
    }

    resize(resizeX: number, resizeY: number, resizeZ: number): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] = ((this.verticesX[i] * resizeX) / 128) | 0;
            this.verticesY[i] = ((this.verticesY[i] * resizeY) / 128) | 0;
            this.verticesZ[i] = ((this.verticesZ[i] * resizeZ) / 128) | 0;
        }

        this.invalidate();
    }

    calculateVertexNormals(): void {
        if (!this.normals) {
            this.normals = new Array(this.usedVertexCount);

            for (let i = 0; i < this.usedVertexCount; i++) {
                this.normals[i] = new VertexNormal();
            }

            const verticesY = this.contourVerticesY || this.verticesY;

            for (let i = 0; i < this.faceCount; i++) {
                const var2 = this.indices1[i];
                const var3 = this.indices2[i];
                const var4 = this.indices3[i];
                const var5 = this.verticesX[var3] - this.verticesX[var2];
                const var6 = verticesY[var3] - verticesY[var2];
                const var7 = this.verticesZ[var3] - this.verticesZ[var2];
                const var8 = this.verticesX[var4] - this.verticesX[var2];
                const var9 = verticesY[var4] - verticesY[var2];
                const var10 = this.verticesZ[var4] - this.verticesZ[var2];
                let var11 = var6 * var10 - var9 * var7;
                let var12 = var7 * var8 - var10 * var5;
                let var13 = var5 * var9 - var8 * var6;

                while (
                    var11 > 8192 ||
                    var12 > 8192 ||
                    var13 > 8192 ||
                    var11 < -8192 ||
                    var12 < -8192 ||
                    var13 < -8192
                ) {
                    var11 >>= 1;
                    var12 >>= 1;
                    var13 >>= 1;
                }

                let var14 = Math.sqrt(var11 * var11 + var12 * var12 + var13 * var13) | 0;
                if (var14 <= 0) {
                    var14 = 1;
                }

                var11 = ((var11 * 256) / var14) | 0;
                var12 = ((var12 * 256) / var14) | 0;
                var13 = ((var13 * 256) / var14) | 0;
                let type;
                if (!this.faceRenderTypes) {
                    type = 0;
                } else {
                    type = this.faceRenderTypes[i];
                }

                if (type === 0) {
                    let normal = this.normals[var2];
                    normal.x += var11;
                    normal.y += var12;
                    normal.z += var13;
                    normal.magnitude++;
                    normal = this.normals[var3];
                    normal.x += var11;
                    normal.y += var12;
                    normal.z += var13;
                    normal.magnitude++;
                    normal = this.normals[var4];
                    normal.x += var11;
                    normal.y += var12;
                    normal.z += var13;
                    normal.magnitude++;
                } else if (type === 1) {
                    if (!this.faceNormals) {
                        this.faceNormals = new Array(this.faceCount);
                    }

                    this.faceNormals[i] = new FaceNormal(var11, var12, var13);
                }
            }
        }
    }

    invalidate(): void {
        this.normals = undefined;
        this.mergedNormals = undefined;
        this.faceNormals = undefined;
        this.isBoundsCalculated = false;
    }

    calculateBounds(): void {
        if (!this.isBoundsCalculated) {
            this.height = 0;
            this.minHeight = 0;

            this.minX = 999999;
            this.maxX = -999999;

            this.minY = 999999;
            this.maxY = -999999;

            this.minZ = 99999;
            this.maxZ = -99999;

            const verticesY = this.contourVerticesY ?? this.verticesY;

            for (let i = 0; i < this.usedVertexCount; i++) {
                const vertX = this.verticesX[i];
                const vertY = verticesY[i];
                const vertZ = this.verticesZ[i];
                // min/max x
                if (vertX < this.minX) {
                    this.minX = vertX;
                }
                if (vertX > this.maxX) {
                    this.maxX = vertX;
                }

                // min/max y
                if (this.minY > vertY) {
                    this.minY = vertY;
                }
                if (this.maxY < vertY) {
                    this.maxY = vertY;
                }

                // min/max z
                if (vertZ < this.minZ) {
                    this.minZ = vertZ;
                }
                if (vertZ > this.maxZ) {
                    this.maxZ = vertZ;
                }

                // height
                if (-vertY > this.height) {
                    this.height = -vertY;
                }
                if (vertY > this.minHeight) {
                    this.minHeight = vertY;
                }
            }

            this.isBoundsCalculated = true;
        }
    }

    light(
        textureLoader: TextureLoader,
        ambient: number,
        contrast: number,
        lightX: number,
        lightY: number,
        lightZ: number,
    ): Model {
        this.calculateVertexNormals();
        if (!this.normals) {
            throw new Error("Failed to calculate normals. This should not be possible.");
        }
        const magnitude = Math.sqrt(lightZ * lightZ + lightX * lightX + lightY * lightY) | 0;
        const lightIntensity = (magnitude * contrast) >> 8;
        const model = new Model();
        model.faceColors1 = new Int32Array(this.faceCount);
        model.faceColors2 = new Int32Array(this.faceCount);
        model.faceColors3 = new Int32Array(this.faceCount);
        model.faceColors = this.faceColors;

        model.uvs = computeTextureCoords(textureLoader, this);
        if (this.faceTextures) {
            model.faceTextures = new Int16Array(this.faceCount);
            for (let i = 0; i < this.faceCount; i++) {
                const textureId = this.faceTextures[i];
                if (textureId !== -1 && textureLoader.isSd(textureId)) {
                    model.faceTextures[i] = this.faceTextures[i];
                } else {
                    model.faceTextures[i] = -1;
                }
            }
        } else {
            model.faceTextures = undefined;
        }
        if (this.textureFaceCount > 0 && this.textureCoords) {
            const textureCoords = new Int32Array(this.textureFaceCount);

            for (let i = 0; i < this.faceCount; i++) {
                if (this.textureCoords[i] !== -1) {
                    textureCoords[this.textureCoords[i] & 0xff]++;
                }
            }

            model.texTriangleCount = 0;

            for (let i = 0; i < this.textureFaceCount; i++) {
                if (textureCoords[i] > 0 && this.textureRenderTypes[i] === 0) {
                    model.texTriangleCount++;
                }
            }

            model.textureMappingP = new Int32Array(model.texTriangleCount);
            model.textureMappingM = new Int32Array(model.texTriangleCount);
            model.textureMappingN = new Int32Array(model.texTriangleCount);

            let mapIndex = 0;
            for (let i = 0; i < this.textureFaceCount; i++) {
                if (textureCoords[i] > 0 && this.textureRenderTypes[i] === 0) {
                    model.textureMappingP[mapIndex] = this.textureMappingP[i] & 0xffff;
                    model.textureMappingM[mapIndex] = this.textureMappingM[i] & 0xffff;
                    model.textureMappingN[mapIndex] = this.textureMappingN[i] & 0xffff;
                    textureCoords[i] = mapIndex++;
                } else {
                    textureCoords[i] = -1;
                }
            }

            model.textureCoords = new Int8Array(this.faceCount);

            for (let i = 0; i < this.faceCount; i++) {
                if (this.textureCoords[i] !== -1) {
                    model.textureCoords[i] = textureCoords[this.textureCoords[i] & 0xff];
                } else {
                    model.textureCoords[i] = -1;
                }
            }
        }

        for (let i = 0; i < this.faceCount; i++) {
            let type;
            if (!this.faceRenderTypes) {
                type = 0;
            } else {
                type = this.faceRenderTypes[i];
            }

            let alpha;
            if (this.faceAlphas) {
                alpha = this.faceAlphas[i];
            } else {
                alpha = 0;
            }

            let texture;
            if (model.faceTextures) {
                texture = model.faceTextures[i];
            } else {
                texture = -1;
            }

            if (alpha === -2) {
                type = 3;
            }

            if (alpha === -1) {
                type = 2;
            }

            if (texture === -1) {
                if (type === 0) {
                    const color = this.faceColors[i] & 0xffff;

                    let normal: VertexNormal;
                    if (this.mergedNormals && this.mergedNormals[this.indices1[i]]) {
                        normal = this.mergedNormals[this.indices1[i]];
                    } else {
                        normal = this.normals[this.indices1[i]];
                    }
                    let var14 =
                        (ambient +
                            (lightY * normal.y + lightZ * normal.z + lightX * normal.x) /
                                (lightIntensity * normal.magnitude)) <<
                        17;
                    model.faceColors1[i] = var14 | ModelData.adjustLightness(color, var14 >> 17);

                    if (this.mergedNormals && this.mergedNormals[this.indices2[i]]) {
                        normal = this.mergedNormals[this.indices2[i]];
                    } else {
                        normal = this.normals[this.indices2[i]];
                    }
                    var14 =
                        (ambient +
                            (lightY * normal.y + lightZ * normal.z + lightX * normal.x) /
                                (lightIntensity * normal.magnitude)) <<
                        17;
                    model.faceColors2[i] = var14 | ModelData.adjustLightness(color, var14 >> 17);

                    if (this.mergedNormals && this.mergedNormals[this.indices3[i]]) {
                        normal = this.mergedNormals[this.indices3[i]];
                    } else {
                        normal = this.normals[this.indices3[i]];
                    }
                    var14 =
                        (ambient +
                            (lightY * normal.y + lightZ * normal.z + lightX * normal.x) /
                                (lightIntensity * normal.magnitude)) <<
                        17;
                    model.faceColors3[i] = var14 | ModelData.adjustLightness(color, var14 >> 17);
                } else if (type === 1 && this.faceNormals) {
                    const normal = this.faceNormals[i];
                    const var14 =
                        (ambient +
                            (lightY * normal.y + lightZ * normal.z + lightX * normal.x) /
                                ((lightIntensity >> 1) + lightIntensity)) <<
                        17;
                    model.faceColors1[i] =
                        var14 | ModelData.adjustLightness(this.faceColors[i] & 0xffff, var14 >> 17);
                    model.faceColors3[i] = -1;
                } else if (type === 3) {
                    model.faceColors1[i] = 128;
                    model.faceColors3[i] = -1;
                } else {
                    model.faceColors3[i] = -2;
                }
            } else if (type === 0) {
                let normal: VertexNormal;
                if (this.mergedNormals && this.mergedNormals[this.indices1[i]]) {
                    normal = this.mergedNormals[this.indices1[i]];
                } else {
                    normal = this.normals[this.indices1[i]];
                }

                let var14 =
                    ambient +
                    (lightY * normal.y + lightZ * normal.z + lightX * normal.x) /
                        (lightIntensity * normal.magnitude);
                model.faceColors1[i] = ModelData.clampLightness(var14);
                if (this.mergedNormals && this.mergedNormals[this.indices2[i]]) {
                    normal = this.mergedNormals[this.indices2[i]];
                } else {
                    normal = this.normals[this.indices2[i]];
                }

                var14 =
                    ambient +
                    (lightY * normal.y + lightZ * normal.z + lightX * normal.x) /
                        (lightIntensity * normal.magnitude);
                model.faceColors2[i] = ModelData.clampLightness(var14);
                if (this.mergedNormals && this.mergedNormals[this.indices3[i]]) {
                    normal = this.mergedNormals[this.indices3[i]];
                } else {
                    normal = this.normals[this.indices3[i]];
                }

                var14 =
                    ambient +
                    (lightY * normal.y + lightZ * normal.z + lightX * normal.x) /
                        (lightIntensity * normal.magnitude);
                model.faceColors3[i] = ModelData.clampLightness(var14);
            } else if (type === 1 && this.faceNormals) {
                const normal = this.faceNormals[i];
                const var14 =
                    ambient +
                    (lightY * normal.y + lightZ * normal.z + lightX * normal.x) /
                        ((lightIntensity >> 1) + lightIntensity);
                model.faceColors1[i] = ModelData.clampLightness(var14);
                model.faceColors3[i] = -1;
            } else {
                model.faceColors3[i] = -2;
            }
        }

        this.computeAnimationTables();
        model.verticesCount = this.verticesCount;
        model.usedVertexCount = this.usedVertexCount;
        model.verticesX = this.verticesX;
        model.verticesY = this.verticesY;
        model.verticesZ = this.verticesZ;
        model.contourVerticesY = this.contourVerticesY;
        model.faceCount = this.faceCount;
        model.indices1 = this.indices1;
        model.indices2 = this.indices2;
        model.indices3 = this.indices3;
        model.faceRenderPriorities = this.faceRenderPriorities;
        model.faceAlphas = this.faceAlphas;
        model.priority = this.priority;
        model.vertexLabels = this.vertexLabels;
        model.faceLabels = this.faceLabels;
        // model.faceTextures = this.faceTextures;
        model.textureScaleX = this.textureScaleX;
        model.textureScaleY = this.textureScaleY;
        model.textureScaleZ = this.textureScaleZ;
        model.textureRotation = this.textureRotation;
        model.textureDirection = this.textureDirection;
        model.textureSpeed = this.textureSpeed;
        model.textureTransU = this.textureTransU;
        model.textureTransV = this.textureTransV;
        model.animMayaGroups = this.animMayaGroups;
        model.animMayaScales = this.animMayaScales;
        return model;
    }
}
