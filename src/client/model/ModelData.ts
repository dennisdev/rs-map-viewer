import { SINE, COSINE } from "../Client";
import { Renderable } from "../Renderable";
import { ByteBuffer } from "../util/ByteBuffer";
import { FaceNormal } from "./FaceNormal";
import { Model } from "./Model";
import { VertexNormal } from "./VertexNormal";

export class ModelData extends Renderable {
    version: number;

    verticesCount: number;

    verticesX!: Int32Array;

    verticesY!: Int32Array;

    verticesZ!: Int32Array;

    faceCount: number;

    indices1!: Int32Array;

    indices2!: Int32Array;

    indices3!: Int32Array;

    faceRenderTypes?: Int8Array;

    faceRenderPriorities!: Int8Array;

    faceAlphas!: Int8Array;

    textureCoords?: Int8Array;

    faceColors!: Int16Array;

    faceTextures?: Int16Array;

    priority: number;

    textureTriangleCount!: number;

    textureRenderTypes!: Int8Array;

    texTriangleX!: Int16Array;

    texTriangleY!: Int16Array;

    texTriangleZ!: Int16Array;

    vertexSkins?: Int32Array;

    faceSkins?: Int32Array;

    vertexLabels!: Int32Array[];

    faceLabelsAlpha!: Int32Array[];

    animayaGroups!: Int32Array[];

    animayaScales!: Int32Array[];

    faceNormals?: FaceNormal[];

    normals?: VertexNormal[];

    mergedNormals?: VertexNormal[];

    ambient!: number;

    contrast!: number;

    isBoundsCalculated: boolean;

    minHeight!: number;

    minX!: number;

    maxX!: number;

    maxZ!: number;

    minZ!: number;

    public static merge(models: ModelData[], count: number): ModelData {
        const model = new ModelData();
        model.merge(models, count);
        return model;
    }

    public static decode(data: Int8Array): ModelData {
        const model = new ModelData();
        model.decode(data);
        return model;
    }

    public static copyFrom(model: ModelData, shallowVertices: boolean, shallowColors: boolean, shallowTextures: boolean): ModelData {
        const copy = new ModelData();
        copy.copyFrom(model, shallowVertices, shallowColors, shallowTextures);
        return copy;
    }

    public static addLightness(hsl: number, lightness: number): number {
        lightness = (hsl & 127) * lightness >> 7;
        if (lightness < 2) {
            lightness = 2;
        } else if (lightness > 126) {
            lightness = 126;
        }

        return (hsl & 0xFF80) + lightness;
    }

    public static addLightness2(hsl: number, lightness: number): number {
        if ((lightness / 128 | 0) != lightness >> 7) {
            console.log((lightness / 128 | 0), lightness >> 7);
        }
        lightness = (hsl & 127) * (lightness / 128 | 0);
        if (lightness < 2) {
            lightness = 2;
        } else if (lightness > 126) {
            lightness = 126;
        }

        return (hsl & 0xFF80) + lightness;
    }

    public static clampLightness(lightness: number): number {
        if (lightness < 2) {
            lightness = 2;
        } else if (lightness > 126) {
            lightness = 126;
        }
        return lightness;
    }

    constructor() {
        super();
        this.version = -1;
        this.verticesCount = 0;
        this.faceCount = 0;
        this.priority = 0;
        this.isBoundsCalculated = false;
    }

    merge(models: ModelData[], count: number): void {
        let hasRenderTypes = false;
        let hasRenderPriorities = false;
        let hasAlphas = false;
        let hasSkins = false;
        let hasTextures = false;
        let hasTextureCoords = false;
        let hasUnknown = false;
        this.verticesCount = 0;
        this.faceCount = 0;
        this.textureTriangleCount = 0;
        this.priority = -1;

        for (let i = 0; i < count; i++) {
            const model = models[i];
            if (model) {
                this.verticesCount += model.verticesCount;
                this.faceCount += model.faceCount;
                this.textureTriangleCount += model.textureTriangleCount;
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
                hasSkins ||= !!model.faceSkins;
                hasTextures ||= !!model.faceTextures;
                hasTextureCoords ||= !!model.textureCoords;
                hasUnknown ||= !!model.animayaGroups;
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

        if (hasSkins) {
            this.faceSkins = new Int32Array(this.faceCount);
        }

        if (hasTextures) {
            this.faceTextures = new Int16Array(this.faceCount);
        }

        if (hasTextureCoords) {
            this.textureCoords = new Int8Array(this.faceCount);
        }

        if (hasUnknown) {
            this.animayaGroups = new Array(this.verticesCount);
            this.animayaScales = new Array(this.verticesCount);
        }

        this.faceColors = new Int16Array(this.faceCount);
        if (this.textureTriangleCount > 0) {
            this.textureRenderTypes = new Int8Array(this.textureTriangleCount);
            this.texTriangleX = new Int16Array(this.textureTriangleCount);
            this.texTriangleY = new Int16Array(this.textureTriangleCount);
            this.texTriangleZ = new Int16Array(this.textureTriangleCount);
        }

        this.verticesCount = 0;
        this.faceCount = 0;
        this.textureTriangleCount = 0;


        for (let i = 0; i < count; i++) {
            const model = models[i];
            if (model) {
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

                    if (hasSkins && model.faceSkins && this.faceSkins) {
                        this.faceSkins[this.faceCount] = model.faceSkins[f];
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
                            this.textureCoords[this.faceCount] = (this.textureTriangleCount + model.textureCoords[f]);
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

                for (let f = 0; f < model.textureTriangleCount; f++) {
                    const type = this.textureRenderTypes[this.textureTriangleCount] = model.textureRenderTypes[f];
                    if (type === 0) {
                        this.texTriangleX[this.textureTriangleCount] = this.copyVertex(model, model.texTriangleX[f]);
                        this.texTriangleY[this.textureTriangleCount] = this.copyVertex(model, model.texTriangleY[f]);
                        this.texTriangleZ[this.textureTriangleCount] = this.copyVertex(model, model.texTriangleZ[f]);
                    }

                    this.textureTriangleCount++;
                }
            }
        }
    }

    copyVertex(model: ModelData, index: number): number {
        let newVertexCount = -1;
        const vertX = model.verticesX[index];
        const vertY = model.verticesY[index];
        const vertZ = model.verticesZ[index];

        for (let i = 0; i < this.verticesCount; i++) {
            if (vertX === this.verticesX[i] && vertY === this.verticesY[i] && vertZ === this.verticesZ[i]) {
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
            }

            if (model.animayaGroups) {
                this.animayaGroups[this.verticesCount] = model.animayaGroups[index];
                this.animayaScales[this.verticesCount] = model.animayaScales[index];
            }

            newVertexCount = this.verticesCount++;
        }

        return newVertexCount;
    }

    decode(data: Int8Array): void {
        if (data[data.length - 1] === -3 && data[data.length - 2] === -1) {
            this.decodeV3(data);
        } else if (data[data.length - 1] === -2 && data[data.length - 2] === -1) {
            this.decodeV2(data);
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
        const var18 = buf1.readUnsignedByte();
        const var19 = buf1.readUnsignedShort();
        const var20 = buf1.readUnsignedShort();
        const var21 = buf1.readUnsignedShort();
        const var22 = buf1.readUnsignedShort();
        const var23 = buf1.readUnsignedShort();
        const var24 = buf1.readUnsignedShort();
        let var25 = 0;
        let var26 = 0;
        let var27 = 0;
        if (texTriangleCount > 0) {
            this.textureRenderTypes = new Int8Array(texTriangleCount);
            buf1.offset = 0;

            for (let i = 0; i < texTriangleCount; i++) {
                const type = this.textureRenderTypes[i] = buf1.readByte();
                if (type === 0) {
                    var25++;
                }

                if (type >= 1 && type <= 3) {
                    var26++;
                }

                if (type === 2) {
                    var27++;
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
        var28 += var25 * 6;
        const var44 = var28;
        var28 += var26 * 6;
        const var45 = var28;
        var28 += var26 * 6;
        const var46 = var28;
        var28 += var26 * 2;
        const var47 = var28;
        var28 += var26;
        const var48 = var28;
        var28 += var26 * 2 + var27 * 2;
        this.verticesCount = vertexCount;
        this.faceCount = faceCount;
        this.textureTriangleCount = texTriangleCount;
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

        if (var18 === 1) {
            this.animayaGroups = new Array(vertexCount);
            this.animayaScales = new Array(vertexCount);
        }

        this.faceColors = new Int16Array(faceCount);
        if (texTriangleCount > 0) {
            this.texTriangleX = new Int16Array(texTriangleCount);
            this.texTriangleY = new Int16Array(texTriangleCount);
            this.texTriangleZ = new Int16Array(texTriangleCount);
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

        if (var18 === 1) {
            for (let i = 0; i < vertexCount; i++) {
                const var54 = buf5.readUnsignedByte();
                this.animayaGroups[i] = new Int32Array(var54);
                this.animayaScales[i] = new Int32Array(var54);

                for (let j = 0; j < var54; j++) {
                    this.animayaGroups[i][j] = buf5.readUnsignedByte();
                    this.animayaScales[i][j] = buf5.readUnsignedByte();
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
                this.faceTextures[i] = (buf6.readUnsignedShort() - 1);
            }

            if (this.textureCoords && this.faceTextures && this.faceTextures[i] !== -1) {
                this.textureCoords[i] = (buf7.readUnsignedByte() - 1);
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
                this.texTriangleX[i] = buf1.readUnsignedShort();
                this.texTriangleY[i] = buf1.readUnsignedShort();
                this.texTriangleZ[i] = buf1.readUnsignedShort();
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
        const var16 = buf1.readUnsignedByte();
        const var17 = buf1.readUnsignedByte();
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
        const var10000 = var47 + var20;
        this.verticesCount = vertexCount;
        this.faceCount = faceCount;
        this.textureTriangleCount = texTriangleCount;
        this.verticesX = new Int32Array(vertexCount);
        this.verticesY = new Int32Array(vertexCount);
        this.verticesZ = new Int32Array(vertexCount);
        this.indices1 = new Int32Array(faceCount);
        this.indices2 = new Int32Array(faceCount);
        this.indices3 = new Int32Array(faceCount);
        if (texTriangleCount > 0) {
            this.textureRenderTypes = new Int8Array(texTriangleCount);
            this.texTriangleX = new Int16Array(texTriangleCount);
            this.texTriangleY = new Int16Array(texTriangleCount);
            this.texTriangleZ = new Int16Array(texTriangleCount);
        }

        if (var16 === 1) {
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

        if (var17 === 1) {
            this.animayaGroups = new Array(vertexCount);
            this.animayaScales = new Array(vertexCount);
        }

        this.faceColors = new Int16Array(faceCount);
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
            if (var16 === 1 && this.vertexSkins) {
                this.vertexSkins[i] = buf5.readUnsignedByte();
            }
        }

        if (var17 === 1) {
            for (let i = 0; i < vertexCount; i++) {
                const var41 = buf5.readUnsignedByte();
                this.animayaGroups[i] = new Int32Array(var41);
                this.animayaScales[i] = new Int32Array(var41);

                for (let j = 0; j < var41; j++) {
                    this.animayaGroups[i][j] = buf5.readUnsignedByte();
                    this.animayaScales[i][j] = buf5.readUnsignedByte();
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
                    this.textureCoords[i] = (var41 >> 2);
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
            this.texTriangleX[i] = buf1.readUnsignedShort();
            this.texTriangleY[i] = buf1.readUnsignedShort();
            this.texTriangleZ[i] = buf1.readUnsignedShort();
        }

        if (this.textureCoords) {
            let var48 = false;

            for (let i = 0; i < faceCount; i++) {
                const coord = this.textureCoords[i] & 255;
                if (coord !== 255) {
                    if (this.indices1[i] === (this.texTriangleX[coord] & 0xFFFF)
                        && this.indices2[i] === (this.texTriangleY[coord] & 0xFFFF)
                        && this.indices3[i] === (this.texTriangleZ[coord] & 0xFFFF)) {
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
        const texTriangleCount = buf1.readUnsignedByte();
        const var12 = buf1.readUnsignedByte();
        const var13 = buf1.readUnsignedByte();
        const var14 = buf1.readUnsignedByte();
        const var15 = buf1.readUnsignedByte();
        const var16 = buf1.readUnsignedByte();
        const var17 = buf1.readUnsignedByte();
        const var18 = buf1.readUnsignedShort();
        const var19 = buf1.readUnsignedShort();
        const var20 = buf1.readUnsignedShort();
        const var21 = buf1.readUnsignedShort();
        const var22 = buf1.readUnsignedShort();
        let var23 = 0;
        let var24 = 0;
        let var25 = 0;
        if (texTriangleCount > 0) {
            this.textureRenderTypes = new Int8Array(texTriangleCount);
            buf1.offset = 0;

            for (let i = 0; i < texTriangleCount; i++) {
                const type = this.textureRenderTypes[i] = buf1.readByte();
                if (type === 0) {
                    var23++;
                }

                if (type >= 1 && type <= 3) {
                    var24++;
                }

                if (type === 2) {
                    var25++;
                }
            }
        }

        let var26 = texTriangleCount + vertexCount;
        const var28 = var26;
        if (var12 === 1) {
            var26 += faceCount;
        }

        const var29 = var26;
        var26 += faceCount;
        const var30 = var26;
        if (var13 === 255) {
            var26 += faceCount;
        }

        const var31 = var26;
        if (var15 === 1) {
            var26 += faceCount;
        }

        const var32 = var26;
        if (var17 === 1) {
            var26 += vertexCount;
        }

        const var33 = var26;
        if (var14 === 1) {
            var26 += faceCount;
        }

        const var34 = var26;
        var26 += var21;
        const var35 = var26;
        if (var16 === 1) {
            var26 += faceCount * 2;
        }

        const var36 = var26;
        var26 += var22;
        const var37 = var26;
        var26 += faceCount * 2;
        const var38 = var26;
        var26 += var18;
        const var39 = var26;
        var26 += var19;
        const var40 = var26;
        var26 += var20;
        const var41 = var26;
        var26 += var23 * 6;
        const var42 = var26;
        var26 += var24 * 6;
        const var43 = var26;
        var26 += var24 * 6;
        const var44 = var26;
        var26 += var24 * 2;
        const var45 = var26;
        var26 += var24;
        const var46 = var26;
        var26 += var24 * 2 + var25 * 2;
        this.verticesCount = vertexCount;
        this.faceCount = faceCount;
        this.textureTriangleCount = texTriangleCount;
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

        this.faceColors = new Int16Array(faceCount);
        if (texTriangleCount > 0) {
            this.texTriangleX = new Int16Array(texTriangleCount);
            this.texTriangleY = new Int16Array(texTriangleCount);
            this.texTriangleZ = new Int16Array(texTriangleCount);
        }

        buf1.offset = texTriangleCount;
        buf2.offset = var38;
        buf3.offset = var39;
        buf4.offset = var40;
        buf5.offset = var32;
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

        buf1.offset = var37;
        buf2.offset = var28;
        buf3.offset = var30;
        buf4.offset = var33;
        buf5.offset = var31;
        buf6.offset = var35;
        buf7.offset = var36;

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
                this.faceTextures[i] = (buf6.readUnsignedShort() - 1);
            }

            if (this.textureCoords && this.faceTextures && this.faceTextures[i] !== -1) {
                this.textureCoords[i] = (buf7.readUnsignedByte() - 1);
            }
        }

        buf1.offset = var34;
        buf2.offset = var29;
        let var51 = 0;
        let var52 = 0;
        let var53 = 0;
        let var54 = 0;

        for (let i = 0; i < faceCount; i++) {
            const type = buf2.readUnsignedByte();
            if (type === 1) {
                var51 = buf1.readSmart2() + var54;
                var52 = buf1.readSmart2() + var51;
                var53 = buf1.readSmart2() + var52;
                var54 = var53;
                this.indices1[i] = var51;
                this.indices2[i] = var52;
                this.indices3[i] = var53;
            }

            if (type === 2) {
                var52 = var53;
                var53 = buf1.readSmart2() + var54;
                var54 = var53;
                this.indices1[i] = var51;
                this.indices2[i] = var52;
                this.indices3[i] = var53;
            }

            if (type === 3) {
                var51 = var53;
                var53 = buf1.readSmart2() + var54;
                var54 = var53;
                this.indices1[i] = var51;
                this.indices2[i] = var52;
                this.indices3[i] = var53;
            }

            if (type === 4) {
                const var57 = var51;
                var51 = var52;
                var52 = var57;
                var53 = buf1.readSmart2() + var54;
                var54 = var53;
                this.indices1[i] = var51;
                this.indices2[i] = var57;
                this.indices3[i] = var53;
            }
        }

        buf1.offset = var41;
        buf2.offset = var42;
        buf3.offset = var43;
        buf4.offset = var44;
        buf5.offset = var45;
        buf6.offset = var46;

        for (let i = 0; i < texTriangleCount; i++) {
            const type = this.textureRenderTypes[i] & 255;
            if (type === 0) {
                this.texTriangleX[i] = buf1.readUnsignedShort();
                this.texTriangleY[i] = buf1.readUnsignedShort();
                this.texTriangleZ[i] = buf1.readUnsignedShort();
            }
        }

        buf1.offset = var26;
        const var55 = buf1.readUnsignedByte();
        if (var55 !== 0) {
            // new ModelData0();
            buf1.readUnsignedShort();
            buf1.readUnsignedShort();
            buf1.readUnsignedShort();
            buf1.readInt();
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
        const var12 = buf1.readUnsignedByte();
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
        if (var12 === 1) {
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
        const var10000 = var45 + var19;
        this.verticesCount = vertexCount;
        this.faceCount = faceCount;
        this.textureTriangleCount = texTriangleCount;
        this.verticesX = new Int32Array(vertexCount);
        this.verticesY = new Int32Array(vertexCount);
        this.verticesZ = new Int32Array(vertexCount);
        this.indices1 = new Int32Array(faceCount);
        this.indices2 = new Int32Array(faceCount);
        this.indices3 = new Int32Array(faceCount);
        if (texTriangleCount > 0) {
            this.textureRenderTypes = new Int8Array(texTriangleCount);
            this.texTriangleX = new Int16Array(texTriangleCount);
            this.texTriangleY = new Int16Array(texTriangleCount);
            this.texTriangleZ = new Int16Array(texTriangleCount);
        }

        if (var16 === 1) {
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

        this.faceColors = new Int16Array(faceCount);
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
            if (var12 === 1 && this.faceRenderTypes && this.textureCoords && this.faceTextures) {
                const var39 = buf2.readUnsignedByte();
                if ((var39 & 1) === 1) {
                    this.faceRenderTypes[i] = 1;
                    var2 = true;
                } else {
                    this.faceRenderTypes[i] = 0;
                }

                if ((var39 & 2) === 2) {
                    this.textureCoords[i] = (var39 >> 2);
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
        let var38 = 0;
        let var39 = 0;
        let var40 = 0;
        let var41 = 0;

        for (let i = 0; i < faceCount; i++) {
            const type = buf2.readUnsignedByte();
            if (type === 1) {
                var38 = buf1.readSmart2() + var41;
                var39 = buf1.readSmart2() + var38;
                var40 = buf1.readSmart2() + var39;
                var41 = var40;
                this.indices1[i] = var38;
                this.indices2[i] = var39;
                this.indices3[i] = var40;
            }

            if (type === 2) {
                var39 = var40;
                var40 = buf1.readSmart2() + var41;
                var41 = var40;
                this.indices1[i] = var38;
                this.indices2[i] = var39;
                this.indices3[i] = var40;
            }

            if (type === 3) {
                var38 = var40;
                var40 = buf1.readSmart2() + var41;
                var41 = var40;
                this.indices1[i] = var38;
                this.indices2[i] = var39;
                this.indices3[i] = var40;
            }

            if (type === 4) {
                const var44 = var38;
                var38 = var39;
                var39 = var44;
                var40 = buf1.readSmart2() + var41;
                var41 = var40;
                this.indices1[i] = var38;
                this.indices2[i] = var44;
                this.indices3[i] = var40;
            }
        }

        buf1.offset = var31;

        for (let i = 0; i < texTriangleCount; i++) {
            this.textureRenderTypes[i] = 0;
            this.texTriangleX[i] = buf1.readUnsignedShort();
            this.texTriangleY[i] = buf1.readUnsignedShort();
            this.texTriangleZ[i] = buf1.readUnsignedShort();
        }

        if (this.textureCoords) {
            let hasValidTexFace = false;

            for (let i = 0; i < faceCount; i++) {
                const var44 = this.textureCoords[i] & 255;
                if (var44 !== 255) {
                    if (this.indices1[i] === (this.texTriangleX[var44] & 0xFFFF)
                        && this.indices2[i] === (this.texTriangleY[var44] & 0xFFFF)
                        && this.indices3[i] === (this.texTriangleZ[var44] & 0xFFFF)) {
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

    copyFrom(model: ModelData, shallowVertices: boolean, shallowColors: boolean, shallowTextures: boolean): void {
        this.verticesCount = model.verticesCount;
        this.faceCount = model.faceCount;
        this.textureTriangleCount = model.textureTriangleCount;
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
            this.faceColors = new Int16Array(this.faceCount);

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
        this.indices1 = model.indices1;
        this.indices2 = model.indices2;
        this.indices3 = model.indices3;
        this.faceRenderTypes = model.faceRenderTypes;
        this.faceRenderPriorities = model.faceRenderPriorities;
        this.textureCoords = model.textureCoords;
        this.priority = model.priority;
        this.textureRenderTypes = model.textureRenderTypes;
        this.texTriangleX = model.texTriangleX;
        this.texTriangleY = model.texTriangleY;
        this.texTriangleZ = model.texTriangleZ;
        this.vertexSkins = model.vertexSkins;
        this.faceSkins = model.faceSkins;
        this.vertexLabels = model.vertexLabels;
        this.faceLabelsAlpha = model.faceLabelsAlpha;
        this.normals = model.normals;
        this.faceNormals = model.faceNormals;
        this.mergedNormals = model.mergedNormals;
        this.animayaGroups = model.animayaGroups;
        this.animayaScales = model.animayaScales;
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
        model.faceCount = this.faceCount;
        model.textureTriangleCount = this.textureTriangleCount;
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
        model.texTriangleX = this.texTriangleX;
        model.texTriangleY = this.texTriangleY;
        model.texTriangleZ = this.texTriangleZ;
        model.vertexSkins = this.vertexSkins;
        model.faceSkins = this.faceSkins;
        model.vertexLabels = this.vertexLabels;
        model.faceLabelsAlpha = this.faceLabelsAlpha;
        model.normals = this.normals;
        model.faceNormals = this.faceNormals;
        model.ambient = this.ambient;
        model.contrast = this.contrast;
        return model;
    }

    contourGround(heightMap: number[][], tileX: number, tileHeight: number, tileY: number, var5: boolean, clipType: number): ModelData {
        this.calculateBounds();
        let var7 = tileX + this.minX;
        let var8 = tileX + this.maxX;
        let var9 = tileY + this.minZ;
        let var10 = tileY + this.maxZ;
        if (var7 >= 0 && var8 + 128 >> 7 < heightMap.length && var9 >= 0 && var10 + 128 >> 7 < heightMap[0].length) {
            var7 >>= 7;
            var8 = var8 + 127 >> 7;
            var9 >>= 7;
            var10 = var10 + 127 >> 7;
            if (tileHeight === heightMap[var7][var9] && tileHeight === heightMap[var8][var9] && tileHeight === heightMap[var7][var10] && tileHeight === heightMap[var8][var10]) {
                return this;
            } else {
                const model = new ModelData();
                model.verticesCount = this.verticesCount;
                model.faceCount = this.faceCount;
                model.textureTriangleCount = this.textureTriangleCount;
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
                model.texTriangleX = this.texTriangleX;
                model.texTriangleY = this.texTriangleY;
                model.texTriangleZ = this.texTriangleZ;
                model.vertexSkins = this.vertexSkins;
                model.faceSkins = this.faceSkins;
                model.vertexLabels = this.vertexLabels;
                model.faceLabelsAlpha = this.faceLabelsAlpha;
                model.ambient = this.ambient;
                model.contrast = this.contrast;
                model.verticesY = new Int32Array(model.verticesCount);
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

                model.invalidate();
                return model;
            }
        } else {
            return this;
        }
    }

    computeAnimationTables(): void {
        let var4;
        if (this.vertexSkins) {
            const var1 = new Array(256);
            let var2 = 0;

            for (let i = 0; i < this.verticesCount; i++) {
                var4 = this.vertexSkins[i];
                var1[var4]++;
                if (var4 > var2) {
                    var2 = var4;
                }
            }

            this.vertexLabels = new Array(var2 + 1);

            for (let i = 0; i <= var2; i++) {
                this.vertexLabels[i] = new Int32Array(var1[i]);
                var1[i] = 0;
            }

            for (let i = 0; i < this.verticesCount; this.vertexLabels[var4][var1[var4]++] = i++) {
                var4 = this.vertexSkins[i];
            }

            this.vertexSkins = undefined;
        }

        if (this.faceSkins) {
            const var1 = new Array(256);
            let var2 = 0;

            for (let i = 0; i < this.faceCount; i++) {
                var4 = this.faceSkins[i];
                var1[var4]++;
                if (var4 > var2) {
                    var2 = var4;
                }
            }

            this.faceLabelsAlpha = new Array(var2 + 1);

            for (let i = 0; i <= var2; i++) {
                this.faceLabelsAlpha[i] = new Int32Array(var1[i]);
                var1[i] = 0;
            }

            for (let i = 0; i < this.faceCount; this.faceLabelsAlpha[var4][var1[var4]++] = i++) {
                var4 = this.faceSkins[i];
            }

            this.faceSkins = undefined;
        }
    }

    rotate90(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            const var2 = this.verticesX[i];
            this.verticesX[i] = this.verticesZ[i];
            this.verticesZ[i] = -var2;
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
            const var2 = this.verticesZ[i];
            this.verticesZ[i] = this.verticesX[i];
            this.verticesX[i] = -var2;
        }

        this.invalidate();
    }

    rotate(angle: number): void {
        const sin = SINE[angle];
        const cos = COSINE[angle];

        for (let i = 0; i < this.verticesCount; i++) {
            const var5 = sin * this.verticesZ[i] + cos * this.verticesX[i] >> 16;
            this.verticesZ[i] = cos * this.verticesZ[i] - sin * this.verticesX[i] >> 16;
            this.verticesX[i] = var5;
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
            const var2 = this.indices1[i];
            this.indices1[i] = this.indices3[i];
            this.indices3[i] = var2;
        }

        this.invalidate();
    }

    resize(resizeX: number, resizeY: number, resizeZ: number): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] = this.verticesX[i] * resizeX / 128 | 0;
            this.verticesY[i] = this.verticesY[i] * resizeY / 128 | 0;
            this.verticesZ[i] = this.verticesZ[i] * resizeZ / 128 | 0;
        }

        this.invalidate();
    }

    calculateVertexNormals(): void {
        if (!this.normals) {
            this.normals = new Array(this.verticesCount);

            for (let i = 0; i < this.verticesCount; i++) {
                this.normals[i] = new VertexNormal();
            }

            for (let i = 0; i < this.faceCount; i++) {
                const var2 = this.indices1[i];
                const var3 = this.indices2[i];
                const var4 = this.indices3[i];
                const var5 = this.verticesX[var3] - this.verticesX[var2];
                const var6 = this.verticesY[var3] - this.verticesY[var2];
                const var7 = this.verticesZ[var3] - this.verticesZ[var2];
                const var8 = this.verticesX[var4] - this.verticesX[var2];
                const var9 = this.verticesY[var4] - this.verticesY[var2];
                const var10 = this.verticesZ[var4] - this.verticesZ[var2];
                let var11 = var6 * var10 - var9 * var7;
                let var12 = var7 * var8 - var10 * var5;
                let var13 = var5 * var9 - var8 * var6;

                while (var11 > 8192 || var12 > 8192 || var13 > 8192 || var11 < -8192 || var12 < -8192 || var13 < -8192) {
                    var11 >>= 1;
                    var12 >>= 1;
                    var13 >>= 1;
                }

                let var14 = Math.sqrt((var11 * var11 + var12 * var12 + var13 * var13)) | 0;
                if (var14 <= 0) {
                    var14 = 1;
                }

                
                // if (this.faceCount === 306 && var2 ==0) {
                //     console.log('normal', var14, var11, var12, var13, var11 * 256 / var14, var12 * 256 / var14, var13 * 256 / var14);
                // }

                var11 = (var11 * 256 / var14) | 0;
                var12 = (var12 * 256 / var14) | 0;
                var13 = (var13 * 256 / var14) | 0;
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
                    // if (this.faceCount === 306 && var2 == 0) {
                    //     console.log(normal, var11, var12, var13);
                    // }
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
            this.maxZ = -99999;
            this.minZ = 99999;

            for (let i = 0; i < this.verticesCount; i++) {
                const vertX = this.verticesX[i];
                const vertY = this.verticesY[i];
                const vertZ = this.verticesZ[i];
                if (vertX < this.minX) {
                    this.minX = vertX;
                }

                if (vertX > this.maxX) {
                    this.maxX = vertX;
                }

                if (vertZ < this.minZ) {
                    this.minZ = vertZ;
                }

                if (vertZ > this.maxZ) {
                    this.maxZ = vertZ;
                }

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

    light(ambient: number, contrast: number, lightX: number, lightY: number, lightZ: number): Model {
        this.calculateVertexNormals();
        if (!this.normals) {
            throw new Error('Failed to calculate normals. This should not be possible.')
        }
        const var6 = Math.sqrt(lightZ * lightZ + lightX * lightX + lightY * lightY) | 0;
        const var7 = var6 * contrast >> 8;
        const model = new Model();
        model.faceColors1 = new Int32Array(this.faceCount);
        model.faceColors2 = new Int32Array(this.faceCount);
        model.faceColors3 = new Int32Array(this.faceCount);
        if (this.textureTriangleCount > 0 && this.textureCoords) {
            const var9 = new Int32Array(this.textureTriangleCount);

            for (let i = 0; i < this.faceCount; i++) {
                if (this.textureCoords[i] !== -1) {
                    var9[this.textureCoords[i] & 0xFF]++;
                }
            }

            model.texTriangleCount = 0;

            for (let i = 0; i < this.textureTriangleCount; i++) {
                if (var9[i] > 0 && this.textureRenderTypes[i] === 0) {
                    model.texTriangleCount++;
                }
            }

            model.texTriangleX = new Int32Array(model.texTriangleCount);
            model.texTriangleY = new Int32Array(model.texTriangleCount);
            model.texTriangleZ = new Int32Array(model.texTriangleCount);
            let var10 = 0;

            for (let i = 0; i < this.textureTriangleCount; i++) {
                if (var9[i] > 0 && this.textureRenderTypes[i] === 0) {
                    model.texTriangleX[var10] = this.texTriangleX[i] & 0xFFFF;
                    model.texTriangleY[var10] = this.texTriangleY[i] & 0xFFFF;
                    model.texTriangleZ[var10] = this.texTriangleZ[i] & 0xFFFF;
                    var9[i] = var10++;
                } else {
                    var9[i] = -1;
                }
            }

            model.textureCoords = new Int8Array(this.faceCount);

            for (let i = 0; i < this.faceCount; i++) {
                if (this.textureCoords[i] !== -1) {
                    model.textureCoords[i] = var9[this.textureCoords[i] & 0xFF];
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
            if (!this.faceAlphas) {
                alpha = 0;
            } else {
                alpha = this.faceAlphas[i];
            }

            let texture;
            if (!this.faceTextures) {
                texture = -1;
            } else {
                texture = this.faceTextures[i];
            }

            if (alpha === -2) {
                type = 3;
            }

            if (alpha === -1) {
                type = 2;
            }

            // if (this.faceCount === 306 && i === 13) {

            //     console.log(this.faceCount, type, texture)
            // }

            if (texture === -1) {
                if (type !== 0) {
                    if (type === 1 && this.faceNormals) {
                        const normal = this.faceNormals[i];
                        const var14 = ((lightY * normal.y + lightZ * normal.z + lightX * normal.x) / ((var7 / 2 | 0) + var7) | 0) + ambient;
                        model.faceColors1[i] = ModelData.addLightness(this.faceColors[i] & 0xFFFF, var14);
                        model.faceColors3[i] = -1;

                        
                        // if (this.faceCount === 306 && i === 13) {
                        //     console.log(normal, var14, var7, (lightY * normal.y + lightZ * normal.z + lightX * normal.x), (var7 / 2 + var7),
                        //     (lightY * normal.y + lightZ * normal.z + lightX * normal.x) / (var7 / 2 + var7),
                        //         ambient,
                        //         this.indices1[i]);
                        // }
                    } else if (type === 3) {
                        model.faceColors1[i] = 128;
                        model.faceColors3[i] = -1;
                    } else {
                        model.faceColors3[i] = -2;
                    }
                } else {
                    const color = this.faceColors[i] & 0xFFFF;

                    let normal: VertexNormal;
                    if (this.mergedNormals && this.mergedNormals[this.indices1[i]]) {
                        normal = this.mergedNormals[this.indices1[i]];
                    } else {
                        normal = this.normals[this.indices1[i]];
                    }
                    let var14 = ((lightY * normal.y + lightZ * normal.z + lightX * normal.x) / (var7 * normal.magnitude) | 0) + ambient | 0;
                    model.faceColors1[i] = ModelData.addLightness(color, var14);
                    // if (this.faceCount === 306 && i === 13) {
                    //     console.log(normal, var14, var7, (lightY * normal.y + lightZ * normal.z + lightX * normal.x), (var7 * normal.magnitude),
                    //         (lightY * normal.y + lightZ * normal.z + lightX * normal.x) / (var7 * normal.magnitude),
                    //         ambient,
                    //         this.indices1[i]);
                    // }

                    if (this.mergedNormals && this.mergedNormals[this.indices2[i]]) {
                        normal = this.mergedNormals[this.indices2[i]];
                    } else {
                        normal = this.normals[this.indices2[i]];
                    }
                    var14 = ((lightY * normal.y + lightZ * normal.z + lightX * normal.x) / (var7 * normal.magnitude) | 0) + ambient | 0;
                    model.faceColors2[i] = ModelData.addLightness(color, var14);

                    if (this.mergedNormals && this.mergedNormals[this.indices3[i]]) {
                        normal = this.mergedNormals[this.indices3[i]];
                    } else {
                        normal = this.normals[this.indices3[i]];
                    }
                    var14 = ((lightY * normal.y + lightZ * normal.z + lightX * normal.x) / (var7 * normal.magnitude) | 0) + ambient | 0;
                    model.faceColors3[i] = ModelData.addLightness(color, var14);

                    
                    // if (this.faceCount === 306 && i === 13) {

                    //     console.log(this.faceCount, type, color, model.faceColors1[i]);
                    // }
                }
            } else if (type !== 0) {
                if (type === 1 && this.faceNormals) {
                    const var19 = this.faceNormals[i];
                    const var14 = ((lightY * var19.y + lightZ * var19.z + lightX * var19.x) / ((var7 / 2 | 0) + var7) | 0) + ambient | 0;
                    model.faceColors1[i] = ModelData.clampLightness(var14);
                    model.faceColors3[i] = -1;
                } else {
                    model.faceColors3[i] = -2;
                }
            } else {
                let normal: VertexNormal;
                if (this.mergedNormals && this.mergedNormals[this.indices1[i]]) {
                    normal = this.mergedNormals[this.indices1[i]];
                } else {
                    normal = this.normals[this.indices1[i]];
                }

                let var14 = ((lightY * normal.y + lightZ * normal.z + lightX * normal.x) / (var7 * normal.magnitude) | 0) + ambient | 0;
                model.faceColors1[i] = ModelData.clampLightness(var14);
                if (this.mergedNormals && this.mergedNormals[this.indices2[i]]) {
                    normal = this.mergedNormals[this.indices2[i]];
                } else {
                    normal = this.normals[this.indices2[i]];
                }

                var14 = ((lightY * normal.y + lightZ * normal.z + lightX * normal.x) / (var7 * normal.magnitude) | 0) + ambient | 0;
                model.faceColors2[i] = ModelData.clampLightness(var14);
                if (this.mergedNormals && this.mergedNormals[this.indices3[i]]) {
                    normal = this.mergedNormals[this.indices3[i]];
                } else {
                    normal = this.normals[this.indices3[i]];
                }

                var14 = ((lightY * normal.y + lightZ * normal.z + lightX * normal.x) / (var7 * normal.magnitude) | 0) + ambient | 0;
                model.faceColors3[i] = ModelData.clampLightness(var14);
            }
        }

        this.computeAnimationTables();
        model.verticesCount = this.verticesCount;
        model.verticesX = this.verticesX;
        model.verticesY = this.verticesY;
        model.verticesZ = this.verticesZ;
        model.faceCount = this.faceCount;
        model.indices1 = this.indices1;
        model.indices2 = this.indices2;
        model.indices3 = this.indices3;
        model.faceRenderPriorities = this.faceRenderPriorities;
        model.faceAlphas = this.faceAlphas;
        model.priority = this.priority;
        model.vertexLabels = this.vertexLabels;
        model.faceLabelsAlpha = this.faceLabelsAlpha;
        model.faceTextures = this.faceTextures;
        model.animayaGroups = this.animayaGroups;
        model.animayaScales = this.animayaScales;
        return model;
    }
}
