import { mat4, vec3 } from "gl-matrix";

import { COSINE, SINE } from "../MathConstants";
import { Entity } from "../scene/entity/Entity";
import { ModelData } from "./ModelData";
import { SeqBase } from "./seq/SeqBase";
import { SeqFrame } from "./seq/SeqFrame";
import { SeqTransformType } from "./seq/SeqTransformType";
import { SkeletalBase } from "./skeletal/SkeletalBase";
import { SkeletalSeq } from "./skeletal/SkeletalSeq";

const scaleVector = vec3.create();

export class Model extends Entity {
    static animateOriginX: number = 0;
    static animateOriginY: number = 0;
    static animateOriginZ: number = 0;

    static sketetalTransformMatrix: mat4 = mat4.create();
    static skeletalScalingMatrix: mat4 = mat4.create();
    static skeletalBoneMatrix: mat4 = mat4.create();

    version: number = 0;

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

    faceColors1!: Int32Array;
    faceColors2!: Int32Array;
    faceColors3!: Int32Array;

    // For animations
    faceColors!: Uint16Array;
    changedLight: boolean = false;

    faceRenderPriorities!: Int8Array;
    faceAlphas!: Int8Array;

    textureCoords!: Int8Array;

    faceTextures?: Int16Array;

    priority: number;

    texTriangleCount: number;
    textureRenderTypes!: Int8Array;

    textureMappingP!: Int32Array;
    textureMappingM!: Int32Array;
    textureMappingN!: Int32Array;

    textureScaleX!: Int32Array;
    textureScaleY!: Int32Array;
    textureScaleZ!: Int32Array;
    textureRotation!: Int8Array;
    textureDirection!: Int8Array;
    textureSpeed!: Int32Array;

    textureTransU!: Int32Array;
    textureTransV!: Int32Array;

    uvs?: Float32Array;

    vertexLabels!: Int32Array[];
    faceLabels!: Int32Array[];

    animMayaGroups!: Int32Array[];
    animMayaScales!: Int32Array[];

    isClickable: boolean;

    boundsType!: number;
    bottomY!: number;
    xzRadius!: number;
    diameter!: number;
    radius!: number;

    minHeight!: number;
    minX!: number;
    maxX!: number;
    minY!: number;
    maxY!: number;
    maxZ!: number;
    minZ!: number;

    xMid!: number;
    yMid!: number;
    zMid!: number;

    xMidOffset: number;
    yMidOffset: number;
    zMidOffset: number;

    field2494!: number;
    field2495!: number;
    field2479!: number;
    field2474!: number;

    contourHeight: number = 0;

    static copy(model: Model): Model {
        return Model.merge([model], 1);
    }

    static copyAnimated(
        model: Model,
        shallowTransparencies: boolean,
        shallowColors: boolean,
    ): Model {
        const copy: Model = Object.assign(Object.create(Object.getPrototypeOf(model)), model);
        // const copy = new Model();

        copy.verticesX = new Int32Array(model.verticesCount);
        copy.verticesY = new Int32Array(model.verticesCount);
        copy.verticesZ = new Int32Array(model.verticesCount);

        for (let i = 0; i < model.verticesCount; i++) {
            copy.verticesX[i] = model.verticesX[i];
            copy.verticesY[i] = model.verticesY[i];
            copy.verticesZ[i] = model.verticesZ[i];
        }

        if (shallowTransparencies) {
            copy.faceAlphas = model.faceAlphas;
        } else {
            copy.faceAlphas = new Int8Array(model.faceCount);
            if (model.faceAlphas) {
                for (let i = 0; i < model.faceCount; i++) {
                    copy.faceAlphas[i] = model.faceAlphas[i];
                }
            } else {
                copy.faceAlphas.fill(0);
            }
        }

        if (!shallowColors) {
            copy.faceColors = new Uint16Array(model.faceCount);
            copy.faceColors1 = new Int32Array(model.faceCount);
            copy.faceColors2 = new Int32Array(model.faceCount);
            copy.faceColors3 = new Int32Array(model.faceCount);
            for (let i = 0; i < model.faceCount; i++) {
                copy.faceColors[i] = model.faceColors[i];
                copy.faceColors1[i] = model.faceColors1[i];
                copy.faceColors2[i] = model.faceColors2[i];
                copy.faceColors3[i] = model.faceColors3[i];
            }
        }

        return copy;
    }

    static merge(models: Model[], count: number): Model {
        const model = new Model();
        model.merge(models, count);
        return model;
    }

    static resetAnimateOrigin() {
        Model.animateOriginX = 0;
        Model.animateOriginY = 0;
        Model.animateOriginZ = 0;
    }

    constructor() {
        super();
        this.verticesCount = 0;
        this.usedVertexCount = 0;
        this.faceCount = 0;
        this.priority = 0;
        this.texTriangleCount = 0;
        this.isClickable = false;
        this.xMidOffset = -1;
        this.yMidOffset = -1;
        this.zMidOffset = -1;
    }

    merge(models: Model[], count: number): void {
        let hasRenderPriority = false;
        let hasAlpha = false;
        let hasTexture = false;
        let hasTextureCoord = false;
        this.verticesCount = 0;
        this.faceCount = 0;
        this.texTriangleCount = 0;
        this.priority = -1;

        for (let i = 0; i < count; i++) {
            const model = models[i];
            if (model) {
                this.verticesCount += model.verticesCount;
                this.faceCount += model.faceCount;
                this.texTriangleCount += model.texTriangleCount;
                if (model.faceRenderPriorities) {
                    hasRenderPriority = true;
                } else {
                    if (this.priority === -1) {
                        this.priority = model.priority;
                    }

                    if (this.priority !== model.priority) {
                        hasRenderPriority = true;
                    }
                }

                hasAlpha ||= !!model.faceAlphas;
                hasTexture ||= !!model.faceTextures;
                hasTextureCoord ||= !!model.textureCoords;
            }
        }

        this.verticesX = new Int32Array(this.verticesCount);
        this.verticesY = new Int32Array(this.verticesCount);
        this.verticesZ = new Int32Array(this.verticesCount);
        this.indices1 = new Int32Array(this.faceCount);
        this.indices2 = new Int32Array(this.faceCount);
        this.indices3 = new Int32Array(this.faceCount);
        this.faceColors1 = new Int32Array(this.faceCount);
        this.faceColors2 = new Int32Array(this.faceCount);
        this.faceColors3 = new Int32Array(this.faceCount);
        this.faceColors = new Uint16Array(this.faceCount);
        if (hasRenderPriority) {
            this.faceRenderPriorities = new Int8Array(this.faceCount);
        }

        if (hasAlpha) {
            this.faceAlphas = new Int8Array(this.faceCount);
        }

        if (hasTexture) {
            this.faceTextures = new Int16Array(this.faceCount);
        }

        if (hasTextureCoord) {
            this.textureCoords = new Int8Array(this.faceCount);
        }

        if (this.texTriangleCount > 0) {
            this.textureMappingP = new Int32Array(this.texTriangleCount);
            this.textureMappingM = new Int32Array(this.texTriangleCount);
            this.textureMappingN = new Int32Array(this.texTriangleCount);
            this.textureScaleX = new Int32Array(this.texTriangleCount);
            this.textureScaleY = new Int32Array(this.texTriangleCount);
            this.textureScaleZ = new Int32Array(this.texTriangleCount);
            this.textureRotation = new Int8Array(this.texTriangleCount);
            this.textureDirection = new Int8Array(this.texTriangleCount);
            this.textureSpeed = new Int32Array(this.texTriangleCount);
            this.textureTransU = new Int32Array(this.texTriangleCount);
            this.textureTransV = new Int32Array(this.texTriangleCount);
        }

        this.verticesCount = 0;
        this.faceCount = 0;
        this.texTriangleCount = 0;

        for (let i = 0; i < count; i++) {
            const model = models[i];
            if (model) {
                for (let f = 0; f < model.faceCount; f++) {
                    this.indices1[this.faceCount] = this.verticesCount + model.indices1[f];
                    this.indices2[this.faceCount] = this.verticesCount + model.indices2[f];
                    this.indices3[this.faceCount] = this.verticesCount + model.indices3[f];
                    this.faceColors1[this.faceCount] = model.faceColors1[f];
                    this.faceColors2[this.faceCount] = model.faceColors2[f];
                    this.faceColors3[this.faceCount] = model.faceColors3[f];
                    this.faceColors[this.faceCount] = model.faceColors[f];
                    if (hasRenderPriority) {
                        if (model.faceRenderPriorities) {
                            this.faceRenderPriorities[this.faceCount] =
                                model.faceRenderPriorities[f];
                        } else {
                            this.faceRenderPriorities[this.faceCount] = model.priority;
                        }
                    }

                    if (hasAlpha && model.faceAlphas) {
                        this.faceAlphas[this.faceCount] = model.faceAlphas[f];
                    }

                    if (hasTexture && this.faceTextures) {
                        if (model.faceTextures) {
                            this.faceTextures[this.faceCount] = model.faceTextures[f];
                        } else {
                            this.faceTextures[this.faceCount] = -1;
                        }
                    }

                    if (hasTextureCoord) {
                        if (model.textureCoords && model.textureCoords[f] !== -1) {
                            this.textureCoords[this.faceCount] =
                                this.texTriangleCount + model.textureCoords[f];
                        } else {
                            this.textureCoords[this.faceCount] = -1;
                        }
                    }

                    this.faceCount++;
                }

                for (let v = 0; v < model.texTriangleCount; v++) {
                    this.textureMappingP[this.texTriangleCount] =
                        this.verticesCount + model.textureMappingP[v];
                    this.textureMappingM[this.texTriangleCount] =
                        this.verticesCount + model.textureMappingM[v];
                    this.textureMappingN[this.texTriangleCount] =
                        this.verticesCount + model.textureMappingN[v];
                    this.texTriangleCount++;
                }

                for (let v = 0; v < model.verticesCount; v++) {
                    this.verticesX[this.verticesCount] = model.verticesX[v];
                    this.verticesY[this.verticesCount] = model.verticesY[v];
                    this.verticesZ[this.verticesCount] = model.verticesZ[v];
                    this.verticesCount++;
                }
            }
        }
        this.usedVertexCount = this.verticesCount;
    }

    calculateBoundsCylinder(): void {
        if (this.boundsType !== 1) {
            this.boundsType = 1;
            this.height = 0;
            this.bottomY = 0;
            this.xzRadius = 0;

            for (let i = 0; i < this.usedVertexCount; i++) {
                const vertX = this.verticesX[i];
                const vertY = this.verticesY[i];
                const vertZ = this.verticesZ[i];
                if (-vertY > this.height) {
                    this.height = -vertY;
                }

                if (this.contourVerticesY) {
                    const contourY = this.contourVerticesY[i];
                    if (-contourY > this.contourHeight) {
                        this.contourHeight = -contourY;
                    }
                }

                if (vertY > this.bottomY) {
                    this.bottomY = vertY;
                }

                const var5 = vertX * vertX + vertZ * vertZ;
                if (var5 > this.xzRadius) {
                    this.xzRadius = var5;
                }
            }

            if (!this.contourVerticesY) {
                this.contourHeight = this.height;
            }

            this.xzRadius = (Math.sqrt(this.xzRadius) + 0.99) | 0;
            this.radius =
                (Math.sqrt(this.xzRadius * this.xzRadius + this.height * this.height) + 0.99) | 0;
            this.diameter =
                (this.radius +
                    (Math.sqrt(this.xzRadius * this.xzRadius + this.bottomY * this.bottomY) +
                        0.99)) |
                0;
        }
    }

    calculateBounds(): void {
        if (this.boundsType !== 2) {
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

            this.boundsType = 2;
        }
    }

    invalidateBounds(): void {
        this.boundsType = 0;
        this.xMidOffset = -1;
    }

    contourGround(
        type: number,
        param: number,
        heightMap: Int32Array[],
        heightMapAbove: Int32Array[] | undefined,
        sceneX: number,
        sceneHeight: number,
        sceneZ: number,
        createNew: boolean = true,
    ): Model {
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
        let model: Model = this;
        if (createNew) {
            model = new Model();
            model.verticesCount = this.verticesCount;
            model.usedVertexCount = this.usedVertexCount;
            model.faceCount = this.faceCount;
            model.texTriangleCount = this.texTriangleCount;
            model.verticesX = this.verticesX;
            model.verticesZ = this.verticesZ;
            model.indices1 = this.indices1;
            model.indices2 = this.indices2;
            model.indices3 = this.indices3;
            model.faceColors1 = this.faceColors1;
            model.faceColors2 = this.faceColors2;
            model.faceColors3 = this.faceColors3;
            model.faceColors = this.faceColors;
            model.faceRenderPriorities = this.faceRenderPriorities;
            model.faceAlphas = this.faceAlphas;
            model.textureCoords = this.textureCoords;
            model.faceTextures = this.faceTextures;
            model.priority = this.priority;
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
            model.uvs = this.uvs;
            model.vertexLabels = this.vertexLabels;
            model.faceLabels = this.faceLabels;
            model.isClickable = this.isClickable;
            model.verticesY = this.verticesY;
        }
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
                } else {
                    model.contourVerticesY[i] = this.verticesY[i];
                }
            }
        } else if (type === 2) {
            for (let i = 0; i < model.usedVertexCount; i++) {
                const yRatio = ((this.verticesY[i] << 16) / this.minY) | 0;
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
                const yRatio = ((this.verticesY[i] << 16) / this.minY) | 0;
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
            }
        }

        model.invalidateBounds();
        return model;
    }

    rotate90(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            const temp = this.verticesX[i];
            this.verticesX[i] = this.verticesZ[i];
            this.verticesZ[i] = -temp;
        }

        this.invalidateBounds();
    }

    rotate180(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] = -this.verticesX[i];
            this.verticesZ[i] = -this.verticesZ[i];
        }

        this.invalidateBounds();
    }

    rotate270(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            const temp = this.verticesZ[i];
            this.verticesZ[i] = this.verticesX[i];
            this.verticesX[i] = -temp;
        }

        this.invalidateBounds();
    }

    rotate(angle: number): void {
        const sin = SINE[angle];
        const cos = COSINE[angle];

        for (let i = 0; i < this.verticesCount; i++) {
            const temp = (sin * this.verticesZ[i] + cos * this.verticesX[i]) >> 16;
            this.verticesZ[i] = (cos * this.verticesZ[i] - sin * this.verticesX[i]) >> 16;
            this.verticesX[i] = temp;
        }

        this.invalidateBounds();
    }

    translate(x: number, y: number, z: number): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] += x;
            this.verticesY[i] += y;
            this.verticesZ[i] += z;
        }

        this.invalidateBounds();
    }

    scale(x: number, y: number, z: number): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] = ((this.verticesX[i] * x) / 128) | 0;
            this.verticesY[i] = ((this.verticesY[i] * y) / 128) | 0;
            this.verticesZ[i] = ((this.verticesZ[i] * z) / 128) | 0;
        }

        this.invalidateBounds();
    }

    getXZRadius(): number {
        this.calculateBoundsCylinder();
        return this.xzRadius;
    }

    animateOld(frame: SeqFrame | undefined) {
        if (this.vertexLabels && frame) {
            Model.resetAnimateOrigin();

            const base = frame.base;

            for (let i = 0; i < frame.transformCount; i++) {
                const group = frame.transformGroups[i];
                this.transform(
                    base.types[group],
                    base.labels[group],
                    frame.transformX[i],
                    frame.transformY[i],
                    frame.transformZ[i],
                );
            }

            this.postAnimate();
        }
    }

    animate(frame: SeqFrame, nextFrame: SeqFrame | undefined, op14: boolean): void {
        if (this.vertexLabels) {
            Model.resetAnimateOrigin();

            const base = frame.base;
            if (base !== nextFrame?.base) {
                nextFrame = undefined;
            }

            this.transformInterpolated(base, frame, nextFrame, undefined, true, op14, 0xffff);
            this.postAnimate();
        }
    }

    transformInterpolated(
        base: SeqBase,
        frame: SeqFrame,
        nextFrame: SeqFrame | undefined,
        animateLabels: boolean[] | undefined,
        condition: boolean,
        op14: boolean,
        mask: number,
    ): void {
        if (!nextFrame) {
            for (let i = 0; i < frame.transformCount; i++) {
                const group = frame.transformGroups[i];
                const type = base.types[group];
                if (
                    !animateLabels ||
                    animateLabels[group] === condition ||
                    type === SeqTransformType.ORIGIN
                ) {
                    const resetOriginGroup = frame.resetOriginGroups[i];
                    if (resetOriginGroup !== -1) {
                        this.transform(
                            SeqTransformType.ORIGIN,
                            base.labels[resetOriginGroup],
                            0,
                            0,
                            0,
                            op14,
                            base.masks[resetOriginGroup] & mask,
                        );
                    }

                    this.transform(
                        base.types[group],
                        base.labels[group],
                        frame.transformX[i],
                        frame.transformY[i],
                        frame.transformZ[i],
                        op14,
                        base.masks[group] & mask,
                    );
                }
            }
        }
    }

    transform(
        type: SeqTransformType,
        labels: number[],
        tx: number,
        ty: number,
        tz: number,
        op14: boolean = false,
        mask: number = 0xffff,
    ): void {
        if (mask !== 0xffff) {
            // console.error("animate mask", mask);
            // throw new Error("animate mask");
        } else {
            this.transform0(type, labels, tx, ty, tz, op14);
        }
    }

    transform0(
        type: SeqTransformType,
        labels: number[],
        tx: number,
        ty: number,
        tz: number,
        op14: boolean,
    ) {
        switch (type) {
            case SeqTransformType.ORIGIN:
                Model.resetAnimateOrigin();

                let groupVertexCount = 0;

                for (const label of labels) {
                    if (label < this.vertexLabels.length) {
                        for (const v of this.vertexLabels[label]) {
                            Model.animateOriginX += this.verticesX[v];
                            Model.animateOriginY += this.verticesY[v];
                            Model.animateOriginZ += this.verticesZ[v];
                            groupVertexCount++;
                        }
                    }
                }

                if (groupVertexCount > 0) {
                    Model.animateOriginX = tx + ((Model.animateOriginX / groupVertexCount) | 0);
                    Model.animateOriginY = ty + ((Model.animateOriginY / groupVertexCount) | 0);
                    Model.animateOriginZ = tz + ((Model.animateOriginZ / groupVertexCount) | 0);
                } else {
                    Model.animateOriginX = tx;
                    Model.animateOriginY = ty;
                    Model.animateOriginZ = tz;
                }
                break;
            case SeqTransformType.TRANSLATE:
                for (const label of labels) {
                    if (label < this.vertexLabels.length) {
                        for (const v of this.vertexLabels[label]) {
                            this.verticesX[v] += tx;
                            this.verticesY[v] += ty;
                            this.verticesZ[v] += tz;
                        }
                    }
                }
                break;
            case SeqTransformType.ROTATE:
                for (const label of labels) {
                    if (label < this.vertexLabels.length) {
                        for (const v of this.vertexLabels[label]) {
                            this.verticesX[v] -= Model.animateOriginX;
                            this.verticesY[v] -= Model.animateOriginY;
                            this.verticesZ[v] -= Model.animateOriginZ;

                            const angleX = (tx & 0xff) * 8;
                            const angleY = (ty & 0xff) * 8;
                            const angleZ = (tz & 0xff) * 8;

                            // const angleX = tx;
                            // const angleY = ty;
                            // const angleZ = tz;

                            // roll
                            if (angleZ !== 0) {
                                const sin = SINE[angleZ];
                                const cos = COSINE[angleZ];
                                const temp =
                                    (sin * this.verticesY[v] + cos * this.verticesX[v]) >> 16;
                                this.verticesY[v] =
                                    (cos * this.verticesY[v] - sin * this.verticesX[v]) >> 16;
                                this.verticesX[v] = temp;
                            }

                            // pitch
                            if (angleX !== 0) {
                                const sin = SINE[angleX];
                                const cos = COSINE[angleX];
                                const temp =
                                    (cos * this.verticesY[v] - sin * this.verticesZ[v]) >> 16;
                                this.verticesZ[v] =
                                    (sin * this.verticesY[v] + cos * this.verticesZ[v]) >> 16;
                                this.verticesY[v] = temp;
                            }

                            // yaw
                            if (angleY !== 0) {
                                const sin = SINE[angleY];
                                const cos = COSINE[angleY];
                                const temp =
                                    (sin * this.verticesZ[v] + cos * this.verticesX[v]) >> 16;
                                this.verticesZ[v] =
                                    (cos * this.verticesZ[v] - sin * this.verticesX[v]) >> 16;
                                this.verticesX[v] = temp;
                            }

                            this.verticesX[v] += Model.animateOriginX;
                            this.verticesY[v] += Model.animateOriginY;
                            this.verticesZ[v] += Model.animateOriginZ;
                        }
                    }
                }
                break;
            case SeqTransformType.SCALE:
                for (const label of labels) {
                    if (label < this.vertexLabels.length) {
                        for (const v of this.vertexLabels[label]) {
                            this.verticesX[v] -= Model.animateOriginX;
                            this.verticesY[v] -= Model.animateOriginY;
                            this.verticesZ[v] -= Model.animateOriginZ;

                            this.verticesX[v] = ((tx * this.verticesX[v]) / 128) | 0;
                            this.verticesY[v] = ((ty * this.verticesY[v]) / 128) | 0;
                            this.verticesZ[v] = ((tz * this.verticesZ[v]) / 128) | 0;

                            this.verticesX[v] += Model.animateOriginX;
                            this.verticesY[v] += Model.animateOriginY;
                            this.verticesZ[v] += Model.animateOriginZ;
                        }
                    }
                }
                break;
            case SeqTransformType.ALPHA:
                if (this.faceLabels && this.faceAlphas) {
                    for (const label of labels) {
                        if (label < this.faceLabels.length) {
                            for (const f of this.faceLabels[label]) {
                                let newAlpha = (this.faceAlphas[f] & 0xff) + tx * 8;
                                if (newAlpha < 0) {
                                    newAlpha = 0;
                                } else if (newAlpha > 255) {
                                    newAlpha = 255;
                                }

                                this.faceAlphas[f] = newAlpha;
                            }
                        }
                    }
                }
                break;
            case SeqTransformType.LIGHT:
                if (!this.faceLabels) {
                    return;
                }

                for (const label of labels) {
                    if (label >= this.faceLabels.length) {
                        continue;
                    }
                    for (const f of this.faceLabels[label]) {
                        const color = this.faceColors[f];
                        let hue = (color >> 10) & 0x3f;
                        let saturation = (color >> 7) & 0x7;
                        let lightness = color & 0x7f;
                        hue = (hue + tx) & 0x3f;
                        saturation += ty;
                        if (saturation < 0) {
                            saturation = 0;
                        } else if (saturation > 7) {
                            saturation = 7;
                        }
                        lightness += tz;
                        if (lightness < 0) {
                            lightness = 0;
                        } else if (lightness > 127) {
                            lightness = 127;
                        }
                        this.faceColors[f] = (hue << 10) + (saturation << 7) + lightness;
                    }
                    this.changedLight = true;
                }
                break;
        }
    }

    animateSkeletal(skeletalSeq: SkeletalSeq, frame: number): void {
        const skeletalBase = skeletalSeq.skeletalBase;
        if (skeletalBase) {
            skeletalBase.updateAnimMatrices(skeletalSeq, frame);
            this.transformSkeletal(skeletalBase, skeletalSeq.poseId, frame);
        }

        if (skeletalSeq.hasAlphaTransform) {
            this.transformSkeletalAlpha(skeletalSeq, frame);
        }

        this.invalidateBounds();
    }

    transformSkeletal(skeletalBase: SkeletalBase, poseId: number, frame: number): void {
        if (!this.animMayaGroups) {
            return;
        }
        for (let v = 0; v < this.verticesCount; v++) {
            const group = this.animMayaGroups[v];
            if (group && group.length !== 0) {
                const scalings = this.animMayaScales[v];

                Model.sketetalTransformMatrix.fill(0);
                for (let i = 0; i < group.length; i++) {
                    const boneId = group[i];
                    const bone = skeletalBase.getBone(boneId);
                    if (bone) {
                        const scale = scalings[i] / 255;
                        vec3.set(scaleVector, scale, scale, scale);
                        mat4.fromScaling(Model.skeletalScalingMatrix, scaleVector);

                        mat4.mul(
                            Model.skeletalBoneMatrix,
                            Model.skeletalScalingMatrix,
                            bone.getFinalMatrix(poseId),
                        );

                        mat4.add(
                            Model.sketetalTransformMatrix,
                            Model.sketetalTransformMatrix,
                            Model.skeletalBoneMatrix,
                        );
                    }
                }

                this.transformVertex(v, Model.sketetalTransformMatrix);
            }
        }
    }

    transformVertex(v: number, m: mat4): void {
        const vx = this.verticesX[v];
        const vy = -this.verticesY[v];
        const vz = -this.verticesZ[v];
        const scale = 1.0;
        // TODO: maybe use gl-matrix function instead
        this.verticesX[v] = Math.round(m[0] * vx + m[4] * vy + m[8] * vz + m[12] * scale);
        this.verticesY[v] = -Math.round(m[1] * vx + m[5] * vy + m[9] * vz + m[13] * scale);
        this.verticesZ[v] = -Math.round(m[2] * vx + m[6] * vy + m[10] * vz + m[14] * scale);
    }

    transformSkeletalAlpha(skeletalSeq: SkeletalSeq, frame: number): void {
        const base = skeletalSeq.base;

        for (let i = 0; i < base.count; i++) {
            const type = base.types[i];
            if (
                type === SeqTransformType.ALPHA &&
                skeletalSeq.curves &&
                skeletalSeq.curves[i] &&
                skeletalSeq.curves[i][0] &&
                this.faceLabels &&
                this.faceAlphas
            ) {
                const curve = skeletalSeq.curves[i][0];
                const labels = base.labels[i];
                for (const l of labels) {
                    if (l < this.faceLabels.length) {
                        for (const f of this.faceLabels[l]) {
                            let newAlpha =
                                (this.faceAlphas[f] & 0xff) + curve.getValue(frame) * 255;
                            if (newAlpha < 0) {
                                newAlpha = 0;
                            } else if (newAlpha > 255) {
                                newAlpha = 255;
                            }

                            this.faceAlphas[f] = newAlpha;
                        }
                    }
                }
            }
        }
    }

    postAnimate() {
        if (this.changedLight) {
            for (let i = 0; i < this.faceCount; i++) {
                const textureId = this.faceTextures ? this.faceTextures[i] : -1;
                if (textureId !== -1) {
                    continue;
                }
                const color = this.faceColors[i] & 0xffff;
                if (this.faceColors3[i] === -1) {
                    const i_617_ = this.faceColors1[i] & ~0x1ffff;
                    this.faceColors1[i] = i_617_ | ModelData.adjustLightness(color, i_617_ >> 17);
                } else if (this.faceColors3[i] !== -2) {
                    let c = this.faceColors1[i] & ~0x1ffff;
                    this.faceColors1[i] = c | ModelData.adjustLightness(color, c >> 17);
                    c = this.faceColors2[i] & ~0x1ffff;
                    this.faceColors2[i] = c | ModelData.adjustLightness(color, c >> 17);
                    c = this.faceColors3[i] & ~0x1ffff;
                    this.faceColors3[i] = c | ModelData.adjustLightness(color, c >> 17);
                }
            }
            this.changedLight = false;
        }
        this.invalidateBounds();
    }
}

export function computeTextureCoords(model: Model): Float32Array | undefined {
    const faceTextures = model.faceTextures;

    if (!faceTextures) {
        return undefined;
    }

    const verticesX = model.verticesX;
    const verticesY = model.verticesY;
    const verticesZ = model.verticesZ;

    const indices0 = model.indices1;
    const indices1 = model.indices2;
    const indices2 = model.indices3;

    const textureMappingP = model.textureMappingP;
    const textureMappingM = model.textureMappingM;
    const textureMappingN = model.textureMappingN;

    const textureCoords = model.textureCoords;

    const faceCount = model.faceCount;
    const faceTextureUCoordinates: Float32Array = new Float32Array(faceCount * 6);

    for (let i = 0; i < faceCount; i++) {
        const index0 = indices0[i];
        const index1 = indices1[i];
        const index2 = indices2[i];

        const textureIdx = faceTextures[i];

        if (textureIdx !== -1) {
            let p: number;
            let m: number;
            let n: number;

            if (textureCoords && textureCoords[i] !== -1) {
                const textureCoordinate = textureCoords[i] & 255;
                p = textureMappingP[textureCoordinate];
                m = textureMappingM[textureCoordinate];
                n = textureMappingN[textureCoordinate];
            } else {
                p = index0;
                m = index1;
                n = index2;
            }

            const vx = verticesX[p];
            const vy = verticesY[p];
            const vz = verticesZ[p];

            const f_882_ = verticesX[m] - vx;
            const f_883_ = verticesY[m] - vy;
            const f_884_ = verticesZ[m] - vz;
            const f_885_ = verticesX[n] - vx;
            const f_886_ = verticesY[n] - vy;
            const f_887_ = verticesZ[n] - vz;
            const f_888_ = verticesX[index0] - vx;
            const f_889_ = verticesY[index0] - vy;
            const f_890_ = verticesZ[index0] - vz;
            const f_891_ = verticesX[index1] - vx;
            const f_892_ = verticesY[index1] - vy;
            const f_893_ = verticesZ[index1] - vz;
            const f_894_ = verticesX[index2] - vx;
            const f_895_ = verticesY[index2] - vy;
            const f_896_ = verticesZ[index2] - vz;

            const f_897_ = f_883_ * f_887_ - f_884_ * f_886_;
            const f_898_ = f_884_ * f_885_ - f_882_ * f_887_;
            const f_899_ = f_882_ * f_886_ - f_883_ * f_885_;
            let f_900_ = f_886_ * f_899_ - f_887_ * f_898_;
            let f_901_ = f_887_ * f_897_ - f_885_ * f_899_;
            let f_902_ = f_885_ * f_898_ - f_886_ * f_897_;
            let f_903_ = 1.0 / (f_900_ * f_882_ + f_901_ * f_883_ + f_902_ * f_884_);

            const u0 = (f_900_ * f_888_ + f_901_ * f_889_ + f_902_ * f_890_) * f_903_;
            const u1 = (f_900_ * f_891_ + f_901_ * f_892_ + f_902_ * f_893_) * f_903_;
            const u2 = (f_900_ * f_894_ + f_901_ * f_895_ + f_902_ * f_896_) * f_903_;

            f_900_ = f_883_ * f_899_ - f_884_ * f_898_;
            f_901_ = f_884_ * f_897_ - f_882_ * f_899_;
            f_902_ = f_882_ * f_898_ - f_883_ * f_897_;
            f_903_ = 1.0 / (f_900_ * f_885_ + f_901_ * f_886_ + f_902_ * f_887_);

            const v0 = (f_900_ * f_888_ + f_901_ * f_889_ + f_902_ * f_890_) * f_903_;
            const v1 = (f_900_ * f_891_ + f_901_ * f_892_ + f_902_ * f_893_) * f_903_;
            const v2 = (f_900_ * f_894_ + f_901_ * f_895_ + f_902_ * f_896_) * f_903_;

            const idx = i * 6;
            faceTextureUCoordinates[idx] = u0;
            faceTextureUCoordinates[idx + 1] = v0;
            faceTextureUCoordinates[idx + 2] = u1;
            faceTextureUCoordinates[idx + 3] = v1;
            faceTextureUCoordinates[idx + 4] = u2;
            faceTextureUCoordinates[idx + 5] = v2;
        }
    }

    return faceTextureUCoordinates;
}
