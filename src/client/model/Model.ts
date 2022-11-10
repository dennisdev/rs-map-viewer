import { TextureLoader } from "../fs/loader/TextureLoader";
import { Renderable } from "../Renderable";

export class Model extends Renderable {
    verticesCount: number;

    verticesX!: Int32Array;

    verticesY!: Int32Array;

    verticesZ!: Int32Array;

    faceCount: number;

    indices1!: Int32Array;

    indices2!: Int32Array;

    indices3!: Int32Array;

    faceColors1!: Int32Array;

    faceColors2!: Int32Array;

    faceColors3!: Int32Array;

    faceRenderPriorities!: Int8Array;

    faceAlphas!: Int8Array;

    textureCoords!: Int8Array;

    faceTextures?: Int16Array;

    priority: number;

    texTriangleCount: number;

    texTriangleX!: Int32Array;

    texTriangleY!: Int32Array;

    texTriangleZ!: Int32Array;

    vertexLabels!: Int32Array[];

    faceLabelsAlpha!: Int32Array[];

    animMayaGroups!: Int32Array[];

    animMayaScales!: Int32Array[];

    isClickable: boolean;

    boundsType!: number;

    bottomY!: number;

    xzRadius!: number;

    diameter!: number;

    radius!: number;

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

    public static merge(models: Model[], count: number): Model {
        const model = new Model();
        model.merge(models, count);
        return model;
    }

    constructor() {
        super();
        this.verticesCount = 0;
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
            this.texTriangleX = new Int32Array(this.texTriangleCount);
            this.texTriangleY = new Int32Array(this.texTriangleCount);
            this.texTriangleZ = new Int32Array(this.texTriangleCount);
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
                    if (hasRenderPriority) {
                        if (model.faceRenderPriorities) {
                            this.faceRenderPriorities[this.faceCount] = model.faceRenderPriorities[f];
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
                            this.textureCoords[this.faceCount] = (this.texTriangleCount + model.textureCoords[f]);
                        } else {
                            this.textureCoords[this.faceCount] = -1;
                        }
                    }

                    this.faceCount++;
                }

                for (let v = 0; v < model.texTriangleCount; v++) {
                    this.texTriangleX[this.texTriangleCount] = this.verticesCount + model.texTriangleX[v];
                    this.texTriangleY[this.texTriangleCount] = this.verticesCount + model.texTriangleY[v];
                    this.texTriangleZ[this.texTriangleCount] = this.verticesCount + model.texTriangleZ[v];
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
    }

    calculateBoundsCylinder(): void {
        if (this.boundsType !== 1) {
            this.boundsType = 1;
            this.height = 0;
            this.bottomY = 0;
            this.xzRadius = 0;

            for (let i = 0; i < this.verticesCount; i++) {
                const vertX = this.verticesX[i];
                const vertY = this.verticesY[i];
                const vertZ = this.verticesZ[i];
                if (-vertY > this.height) {
                    this.height = -vertY;
                }

                if (vertY > this.bottomY) {
                    this.bottomY = vertY;
                }

                const var5 = vertX * vertX + vertZ * vertZ;
                if (var5 > this.xzRadius) {
                    this.xzRadius = var5;
                }
            }

            this.xzRadius = (Math.sqrt(this.xzRadius) + 0.99) | 0;
            this.radius = (Math.sqrt(this.xzRadius * this.xzRadius + this.height * this.height) + 0.99) | 0;
            this.diameter = this.radius + (Math.sqrt((this.xzRadius * this.xzRadius + this.bottomY * this.bottomY)) + 0.99) | 0;
        }
    }

    invalidateBounds(): void {
        this.boundsType = 0;
        this.xMidOffset = -1;
    }

    contourGround(heightMap: number[][], tileX: number, tileHeight: number, tileY: number, var5: boolean, clipType: number): Model {
        this.calculateBoundsCylinder();
        let var7 = tileX - this.xzRadius;
        let var8 = tileX + this.xzRadius;
        let var9 = tileY - this.xzRadius;
        let var10 = tileY + this.xzRadius;
        if (var7 >= 0 && var8 + 128 >> 7 < heightMap.length && var9 >= 0 && var10 + 128 >> 7 < heightMap[0].length) {
            var7 >>= 7;
            var8 = var8 + 127 >> 7;
            var9 >>= 7;
            var10 = var10 + 127 >> 7;
            if (tileHeight === heightMap[var7][var9] && tileHeight === heightMap[var8][var9] && tileHeight === heightMap[var7][var10] && tileHeight === heightMap[var8][var10]) {
                return this;
            } else {
                let model: Model;
                if (var5) {
                    model = new Model();
                    model.verticesCount = this.verticesCount;
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
                    model.faceRenderPriorities = this.faceRenderPriorities;
                    model.faceAlphas = this.faceAlphas;
                    model.textureCoords = this.textureCoords;
                    model.faceTextures = this.faceTextures;
                    model.priority = this.priority;
                    model.texTriangleX = this.texTriangleX;
                    model.texTriangleY = this.texTriangleY;
                    model.texTriangleZ = this.texTriangleZ;
                    model.vertexLabels = this.vertexLabels;
                    model.faceLabelsAlpha = this.faceLabelsAlpha;
                    model.isClickable = this.isClickable;
                    model.verticesY = new Int32Array(model.verticesCount);
                } else {
                    model = this;
                }

                if (clipType == 0) {
                    for (let i = 0; i < model.verticesCount; i++) {
                        const var13 = tileX + this.verticesX[i];
                        const var14 = tileY + this.verticesZ[i];
                        const var15 = var13 & 127;
                        const var16 = var14 & 127;
                        const var17 = var13 >> 7;
                        const var18 = var14 >> 7;
                        const var19 = heightMap[var17][var18] * (128 - var15) + heightMap[var17 + 1][var18] * var15 >> 7;
                        const var20 = heightMap[var17][var18 + 1] * (128 - var15) + var15 * heightMap[var17 + 1][var18 + 1] >> 7;
                        const var21 = var19 * (128 - var16) + var20 * var16 >> 7;
                        model.verticesY[i] = var21 + this.verticesY[i] - tileHeight;
                    }
                } else {
                    for (let i = 0; i < model.verticesCount; i++) {
                        const var13 = (-this.verticesY[i] << 16) / this.height;
                        if (var13 < clipType) {
                            const var14 = tileX + this.verticesX[i];
                            const var15 = tileY + this.verticesZ[i];
                            const var16 = var14 & 127;
                            const var17 = var15 & 127;
                            const var18 = var14 >> 7;
                            const var19 = var15 >> 7;
                            const var20 = heightMap[var18][var19] * (128 - var16) + heightMap[var18 + 1][var19] * var16 >> 7;
                            const var21 = heightMap[var18][var19 + 1] * (128 - var16) + var16 * heightMap[var18 + 1][var19 + 1] >> 7;
                            const var22 = var20 * (128 - var17) + var21 * var17 >> 7;
                            model.verticesY[i] = (clipType - var13) * (var22 - tileHeight) / clipType + this.verticesY[i];
                        }
                    }
                }

                model.invalidateBounds();
                return model;
            }
        } else {
            return this;
        }
    }

    hasAlpha(textureLoader: TextureLoader): boolean {
        if (this.faceAlphas) {
            return true;
        }
        if (this.faceTextures) {
            for (let i = 0; i < this.faceCount; i++) {
                const textureId = this.faceTextures[i];
                if (textureId !== -1 && textureLoader.hasAlpha(textureId)) {
                    return true;
                }
            }
        }
        return false;
    }
}
