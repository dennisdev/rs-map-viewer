import { vec3 } from "gl-matrix";
import { ObjectDefinition } from "./client/fs/definition/ObjectDefinition";
import { IndexSync } from "./client/fs/Index";
import { TextureLoader } from "./client/fs/loader/TextureLoader";
import { StoreSync } from "./client/fs/Store";
import { Model } from "./client/model/Model";
import { ModelData } from "./client/model/ModelData";
import { RegionLoader } from "./client/RegionLoader";
import { Scene } from "./client/Scene";
import { ByteBuffer } from "./client/util/ByteBuffer";
import { HSL_RGB_MAP, packHsl } from "./client/util/ColorUtil";
import xxhash, { XXHashAPI } from "xxhash-wasm";
import { CachedModelLoader, IndexModelLoader, ModelLoader } from "./client/fs/loader/ModelLoader";
import { GameObject, ObjectModelLoader, Scene2 } from "./client/scene/Scene";


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

function method5679(var0: number, var1: number) {
    if (var0 == -1) {
        return 12345678;
    } else {
        var1 = (var0 & 127) * var1 >> 7;
        if (var1 < 2) {
            var1 = 2;
        } else if (var1 > 126) {
            var1 = 126;
        }

        return (var0 & 0xFF80) + var1;
    }
}

function method3516(var0: number, var1: number) {
    if (var0 == -2) {
        return 12345678;
    } else if (var0 == -1) {
        if (var1 < 2) {
            var1 = 2;
        } else if (var1 > 126) {
            var1 = 126;
        }

        return var1;
    } else {
        var1 = (var0 & 127) * var1 >> 7;
        if (var1 < 2) {
            var1 = 2;
        } else if (var1 > 126) {
            var1 = 126;
        }

        return (var0 & 0xFF80) + var1;
    }
}

function computeTextureCoords(model: Model): number[] | undefined {
    const faceTextures = model.faceTextures;

    if (!faceTextures) {
        return undefined;
    }

    const vertexPositionsX = model.verticesX;
    const vertexPositionsY = model.verticesY;
    const vertexPositionsZ = model.verticesZ;

    const trianglePointsX = model.indices1;
    const trianglePointsY = model.indices2;
    const trianglePointsZ = model.indices3;

    const texTriangleX = model.texTriangleX;
    const texTriangleY = model.texTriangleY;
    const texTriangleZ = model.texTriangleZ;

    const textureCoords = model.textureCoords;

    const faceCount = model.faceCount;
    const faceTextureUCoordinates: number[] = new Array(faceCount * 6).fill(0);

    for (let i = 0; i < faceCount; i++) {
        const trianglePointX = trianglePointsX[i];
        const trianglePointY = trianglePointsY[i];
        const trianglePointZ = trianglePointsZ[i];

        const textureIdx = faceTextures[i];

        if (textureIdx != -1) {
            let triangleVertexIdx1: number;
            let triangleVertexIdx2: number;
            let triangleVertexIdx3: number;

            if (textureCoords && textureCoords[i] != -1) {
                const textureCoordinate = textureCoords[i] & 255;
                triangleVertexIdx1 = texTriangleX[textureCoordinate];
                triangleVertexIdx2 = texTriangleY[textureCoordinate];
                triangleVertexIdx3 = texTriangleZ[textureCoordinate];
            }
            else {
                triangleVertexIdx1 = trianglePointX;
                triangleVertexIdx2 = trianglePointY;
                triangleVertexIdx3 = trianglePointZ;
            }

            const triangleX = vertexPositionsX[triangleVertexIdx1];
            const triangleY = vertexPositionsY[triangleVertexIdx1];
            const triangleZ = vertexPositionsZ[triangleVertexIdx1];

            const f_882_ = vertexPositionsX[triangleVertexIdx2] - triangleX;
            const f_883_ = vertexPositionsY[triangleVertexIdx2] - triangleY;
            const f_884_ = vertexPositionsZ[triangleVertexIdx2] - triangleZ;
            const f_885_ = vertexPositionsX[triangleVertexIdx3] - triangleX;
            const f_886_ = vertexPositionsY[triangleVertexIdx3] - triangleY;
            const f_887_ = vertexPositionsZ[triangleVertexIdx3] - triangleZ;
            const f_888_ = vertexPositionsX[trianglePointX] - triangleX;
            const f_889_ = vertexPositionsY[trianglePointX] - triangleY;
            const f_890_ = vertexPositionsZ[trianglePointX] - triangleZ;
            const f_891_ = vertexPositionsX[trianglePointY] - triangleX;
            const f_892_ = vertexPositionsY[trianglePointY] - triangleY;
            const f_893_ = vertexPositionsZ[trianglePointY] - triangleZ;
            const f_894_ = vertexPositionsX[trianglePointZ] - triangleX;
            const f_895_ = vertexPositionsY[trianglePointZ] - triangleY;
            const f_896_ = vertexPositionsZ[trianglePointZ] - triangleZ;

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

const SCALE = TILE_SIZE;

export type ChunkData = {
    regionX: number,
    regionY: number,
    vertices: Uint8Array,
    indices: Int32Array,
    perModelTextureData: Int32Array,
    heightMapTextureData: Float32Array,
    drawRanges: DrawCommand[];
    drawRangesLowDetail: DrawCommand[];
};

type ObjectData = {
    localX: number,
    localY: number,
    plane: number,
    contourGround: number,
    priority: number,
};

type DrawCommand = [number, number, number];

function newDrawCommand(offset: number, elements: number, instances: number): DrawCommand {
    // console.log(offset, offset * 2, elements);
    // return [offset, elements, instances];
    return [offset, elements, instances];
}

type InstancedDrawCommand = {
    vertexOffset: number,
    vertexCount: number,
    objectDatas: ObjectData[]
};

type ModelSpawns = {
    model: Model,
    hasAlpha: boolean,
    def: ObjectDefinition,
    type: number,
    objectDatas: ObjectData[],
    objectDatasLowDetail: ObjectData[],
}

function floatToIntBits(n: number): number {
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = n;
    return new Int32Array(buf)[0];
}

function stringify(ns: number[]): string {
    return ns.join(',');
}

function packFloat16(v: number): number {
    const exponent = (v | 0);
    const mantissa = (v - exponent) * 1024 | 0;
    return (exponent << 10) + mantissa;
}

function unpackFloat16(v: number): number {
    const exponent = v >> 10;
    const mantissa = (v & 0x3FF) / 1024;
    return exponent + mantissa;
}

let xxhashApi: XXHashAPI | undefined;

xxhash().then(hasher => {
    xxhashApi = hasher;
});

class VertexBuffer {
    public static readonly VERTEX_STRIDE = 16;

    view: DataView;

    byteArray: Uint8Array;

    vertexOffset: number;

    vertexIndices: Map<bigint, number> = new Map();

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

    addVertex(x: number, y: number, z: number, rgb: number, hsl: number, faceAlpha: number, u: number, v: number, textureId: number, priority: number) {
        this.ensureSize(1);
        const vertexBufIndex = this.vertexOffset * VertexBuffer.VERTEX_STRIDE;

        this.view.setInt16(vertexBufIndex, x, true);
        this.view.setInt16(vertexBufIndex + 2, y, true);
        this.view.setInt16(vertexBufIndex + 4, z, true);

        if (textureId !== -1) {
            const lightA = (hsl & 127) / 127 * 255;

            this.view.setUint8(vertexBufIndex + 6, lightA);
            this.view.setUint8(vertexBufIndex + 7, lightA);
            this.view.setUint8(vertexBufIndex + 8, lightA);
            this.view.setUint8(vertexBufIndex + 9, 255);
        } else {
            this.view.setUint8(vertexBufIndex + 6, (rgb >> 16) & 0xFF);
            this.view.setUint8(vertexBufIndex + 7, (rgb >> 8) & 0xFF);
            this.view.setUint8(vertexBufIndex + 8, rgb & 0xFF);
            this.view.setUint8(vertexBufIndex + 9, faceAlpha);
        }

        this.view.setUint16(vertexBufIndex + 10, packFloat16(u), true);
        this.view.setUint16(vertexBufIndex + 12, packFloat16(v), true);

        this.view.setUint8(vertexBufIndex + 14, textureId + 1);

        this.view.setUint8(vertexBufIndex + 15, priority);

        if (xxhashApi) {
            const hash = xxhashApi.h64Raw(this.byteArray.subarray(vertexBufIndex, vertexBufIndex + VertexBuffer.VERTEX_STRIDE));
            const cachedIndex = this.vertexIndices.get(hash);
            if (cachedIndex) {
                return cachedIndex;
            }
            this.vertexIndices.set(hash, this.vertexOffset);
        }

        return this.vertexOffset++;
    }
}

function getModel(modelLoader: ModelLoader, def: ObjectDefinition, type: number, rotation: number): Model | undefined {
    const modelIds = [];

    // if (type === 22 && def.int1 === 0 && def.clipType != 1 && !def.obstructsGround) {
    //     return undefined;
    // }

    if (def.objectTypes) {
        for (let i = 0; i < def.objectTypes.length; i++) {
            if (def.objectTypes[i] === type) {
                modelIds.push(def.objectModels[i]);
                break;
            }
        }
    }
    if (!modelIds.length && def.objectModels) {
        modelIds.push(...def.objectModels);
    }

    if (!modelIds.length) {
        return undefined;
    }

    // def.isRotated ^ rotation > 3;
    const mirrored = def.isRotated != rotation > 3;

    // if (mirrored) {
    //     return;
    // }

    const hasResize = def.modelSizeX !== 128 || def.modelSizeHeight !== 128 || def.modelSizeY !== 128;

    const hasOffset = def.offsetX !== 0 || def.offsetHeight !== 0 || def.offsetY !== 0;

    const models: ModelData[] = [];

    for (let i = 0; i < modelIds.length; i++) {
        let model = modelLoader.getModel(modelIds[i]);
        if (!model) {
            continue;
        }

        if (mirrored) {
            model = ModelData.copyFrom(model, false, false, true, true);
            model.mirror();
        }

        models.push(model);
    }

    if (!models.length) {
        return undefined;
    }

    const model = models.length === 1 ? models[0] : ModelData.merge(models, models.length);

    if (model.faceCount === 0) {
        return undefined;
    }

    const copy = ModelData.copyFrom(model, true, rotation === 0 && !hasResize && !hasOffset, !def.recolorFrom, !def.retextureFrom);

    if (type == 4 && rotation > 3) {
        copy.rotate(256);
        copy.translate(45, 0, -45);
    }

    rotation &= 3;
    if (rotation == 1) {
        copy.rotate90();
    } else if (rotation == 2) {
        copy.rotate180();
    } else if (rotation == 3) {
        copy.rotate270();
    }

    if (def.recolorFrom) {
        for (let var7 = 0; var7 < def.recolorFrom.length; var7++) {
            copy.recolor(def.recolorFrom[var7], def.recolorTo[var7]);
        }
    }

    if (def.retextureFrom) {
        for (let var7 = 0; var7 < def.retextureFrom.length; var7++) {
            copy.retexture(def.retextureFrom[var7], def.retextureTo[var7]);
        }
    }

    if (hasResize) {
        copy.resize(def.modelSizeX, def.modelSizeHeight, def.modelSizeY);
    }

    if (hasOffset) {
        copy.translate(def.offsetX, def.offsetHeight, def.offsetY);
    }

    return copy.light(def.ambient + 64, def.contrast + 768, -50, -10, -50);
};

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

type ModelFace = {
    index: number,
    alpha: number,
    priority: number,
    textureId: number
};

export class ChunkDataLoader {
    regionLoader: RegionLoader;

    modelLoader: CachedModelLoader;

    textureProvider: TextureLoader;

    constructor(regionLoader: RegionLoader, modelLoader: CachedModelLoader, textureProvider: TextureLoader) {
        this.regionLoader = regionLoader;
        this.modelLoader = modelLoader;
        this.textureProvider = textureProvider;
    }

    load(regionX: number, regionY: number): ChunkData | undefined {
        const baseX = regionX * 64;
        const baseY = regionY * 64;

        const region = this.regionLoader.getRegion(regionX, regionY);
        if (!region) {
            return undefined;
        }

        const vertexBuf = new VertexBuffer(100000);

        const indices: number[] = [];

        const drawCommands: InstancedDrawCommand[] = [];

        const drawCommandsLowDetail: InstancedDrawCommand[] = [];

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

        const underlayIdSet: Set<number> = new Set();
        const overlayIdSet: Set<number> = new Set();
        const heightSet: Set<number> = new Set();
        const lightSet: Set<number> = new Set();

        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            const indexOffset = indices.length * 4;
            for (let x = 0; x < Scene.MAP_SIZE; x++) {
                for (let y = 0; y < Scene.MAP_SIZE; y++) {
                    const underlayId = underlayIds[plane][x][y] - 1;

                    const overlayId = overlayIds[plane][x][y] - 1;

                    underlayIdSet.add(underlayId);
                    overlayIdSet.add(overlayId);

                    if (underlayId == -1 && overlayId == -1) {
                        continue;
                    }

                    const heightSw = heights[plane][x][y];
                    let heightSe: number;
                    let heightNe: number;
                    let heightNw: number;

                    heightSet.add(heightSw);

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

                    lightSet.add(lightSw);
                    lightSet.add(lightSe);
                    lightSet.add(lightNe);
                    lightSet.add(lightNw);

                    let underlayHsl = -1;
                    if (underlayId !== -1) {
                        underlayHsl = blendedColors[plane][x][y];
                    }

                    if (overlayId == -1) {
                        addTileModel(0, 0, -1, x, y, heightSw, heightSe, heightNe, heightNw,
                            method5679(underlayHsl, lightSw), method5679(underlayHsl, lightSe), method5679(underlayHsl, lightNe), method5679(underlayHsl, lightNw),
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
                            method5679(underlayHsl, lightSw), method5679(underlayHsl, lightSe), method5679(underlayHsl, lightNe), method5679(underlayHsl, lightNw),
                            method3516(overlayHsl, lightSw), method3516(overlayHsl, lightSe), method3516(overlayHsl, lightNe), method3516(overlayHsl, lightNw),
                            vertexBuf, indices);
                    }
                }
            }

            const planeVertexCount = (indices.length * 4 - indexOffset) / 4;

            if (planeVertexCount > 0) {
                drawCommands.push({
                    vertexOffset: indexOffset,
                    vertexCount: planeVertexCount,
                    objectDatas: [{ localX: 0, localY: 0, plane: plane, contourGround: 1, priority: 0 }],
                });
            }
        }

        terrainVertexCount = vertexBuf.vertexOffset;

        const landscapeData = this.regionLoader.getLandscapeData(regionX, regionY);

        // check if is empty water region
        // if (overlayIdSet.size == 2 && overlayIdSet.has(5) 
        //         && heightSet.size === 1 && heightSet.has(0)
        //         && lightSet.size === 1 && lightSet.has(84)
        //         && (!landscapeData || landscapeData.length <= 1)) {
        //     console.log(underlayIdSet, overlayIdSet, heightSet, lightSet, landscapeData)
        //     return undefined;
        // }

        if (landscapeData && 1) {
            const spawns = region.decodeLandscape(new ByteBuffer(landscapeData));

            const regionModelSpawns: Map<number, ModelSpawns> = new Map();

            const lowDetailOcclusionMap: boolean[][][] = new Array(Scene.MAX_PLANE);
            for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
                lowDetailOcclusionMap[plane] = new Array(Scene.MAP_SIZE);
                for (let x = 0; x < Scene.MAP_SIZE; x++) {
                    lowDetailOcclusionMap[plane][x] = new Array(Scene.MAP_SIZE).fill(false);
                }
            }

            for (let x = 0; x < Scene.MAP_SIZE; x++) {
                for (let y = 0; y < Scene.MAP_SIZE; y++) {
                    let occluded = false;
                    for (let plane = Scene.MAX_PLANE - 1; plane >= 0; plane--) {
                        lowDetailOcclusionMap[plane][x][y] = occluded;
                        const underlayId = underlayIds[plane][x][y];
                        const overlayId = overlayIds[plane][x][y];
                        // everything below a roof or tile can be occluded
                        if ((renderFlags[plane][x][y] & 16) != 0 || underlayId || overlayId) {
                            occluded = true;
                        }
                    }
                }
            }

            // console.log(lowDetailOcclusionMap);

            const objectModels: Map<number, Model> = new Map();

            for (const spawn of spawns) {
                let { id, type, rotation, localX, localY, plane } = spawn;
                const def = this.regionLoader.getObjectDef(id);

                // if (def.animationId !== -1) {
                //     continue;
                // }

                if (def.mergeNormals) {
                    // continue;
                }

                if (def.contouredGround >= 0) {
                    // continue;
                }

                if (type !== 5 && 1) {
                    // continue;
                }

                // only roofs?
                // if (/*(renderFlags[0][localX][localY] & 2) != 0 || */(renderFlags[plane][localX][localY] & 16) == 0) {
                //     continue;
                // }


                // if ((renderFlags[0][localX][localY] & 2) != 0) {
                //     continue;
                // }

                let sizeX = def.sizeX;
                let sizeY = def.sizeY;

                if (rotation == 1 || rotation == 3) {
                    sizeX = def.sizeY;
                    sizeY = def.sizeX;
                }

                const pos = [localX + sizeX / 2, localY + sizeY / 2];

                let modelKey = rotation << 24 | type << 16 | id;

                let model = objectModels.get(modelKey);

                if (!model) {
                    // corner walls
                    if (type == 2) {
                        const wall0 = getModel(this.modelLoader, def, type, rotation + 1 & 3);
                        const wall1 = getModel(this.modelLoader, def, type, rotation + 4);
                        if (wall0 && wall1) {
                            model = Model.merge([wall0, wall1], 2);
                        }
                    } else {
                        model = getModel(this.modelLoader, def, type, rotation);
                    }
                    if (!model) {
                        continue;
                    }
                    objectModels.set(modelKey, model);
                }

                let modelSpawns = regionModelSpawns.get(modelKey);
                if (!modelSpawns) {
                    modelSpawns = { model: model, hasAlpha: model.hasAlpha(this.textureProvider), def, type, objectDatas: [], objectDatasLowDetail: [] };
                }

                let priority = 1;
                if (type >= 0 && type <= 2 || type == 9) {
                    // priority = 3;
                } else if (type >= 4 && type <= 8) {
                    // priority = 6;
                }

                const objectData = { localX: pos[0], localY: pos[1], plane: plane, contourGround: def.contouredGround, priority };

                if (isLowDetail(type, def, localX, localY, plane, lowDetailOcclusionMap)) {
                    modelSpawns.objectDatasLowDetail.push(objectData);
                } else {
                    modelSpawns.objectDatas.push(objectData);
                }

                regionModelSpawns.set(modelKey, modelSpawns);
            }

            console.log('diff models: ', regionModelSpawns.size);

            const allModelSpawns = Array.from(regionModelSpawns.values());

            // draw transparent objects last
            allModelSpawns.sort((a, b) => (a.hasAlpha ? 1 : 0) - (b.hasAlpha ? 1 : 0));

            // allModelSpawns.sort((a, b) => a.type - b.type);

            for (let i = 0; i < allModelSpawns.length; i++) {
                const modelSpawns = allModelSpawns[i];

                const model = modelSpawns.model;

                const verticesX = model.verticesX;
                const verticesY = model.verticesY;
                const verticesZ = model.verticesZ;

                const facesA = model.indices1;
                const facesB = model.indices2;
                const facesC = model.indices3;

                const faceAlphas = model.faceAlphas;

                const priorities = model.faceRenderPriorities;

                const modelTexCoords = computeTextureCoords(model);

                const indexOffset = indices.length * 4;

                // if (model.faceTextures) {
                //     console.log(model.faceTextures)
                // }

                const faces: ModelFace[] = [];

                for (let f = 0; f < model.faceCount; f++) {
                    let faceAlpha = (faceAlphas && faceAlphas[f] & 0xFF) || 255;

                    if (faceAlpha === 0 || faceAlpha == 0xfe) {
                        continue;
                    }

                    let hslC = model.faceColors3[f];

                    if (hslC == -2) {
                        continue;
                    }

                    const priority = (priorities && priorities[f]) || 0;

                    const textureId = (model.faceTextures && model.faceTextures[f]) || -1;

                    faces.push({ index: f, alpha: faceAlpha, priority, textureId });

                }

                // sort on priority, has alpha, texture id, face index
                faces.sort((a, b) => a.priority - b.priority
                    || (a.alpha < 0xFF ? 1 : 0) - (b.alpha < 0xFF ? 1 : 0)
                    || a.textureId - b.textureId
                    || b.index - a.index);

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

                    const textureIndex = this.textureProvider.getTextureIndex(textureId) || -1;

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
                    }

                    let rgbA = HSL_RGB_MAP[hslA];
                    let rgbB = HSL_RGB_MAP[hslB];
                    let rgbC = HSL_RGB_MAP[hslC];

                    // const SCALE = 128;
                    const fa = facesA[f];
                    const fb = facesB[f];
                    const fc = facesC[f];

                    const vxa = verticesX[fa];
                    const vxb = verticesX[fb];
                    const vxc = verticesX[fc];

                    const vya = verticesY[fa];
                    const vyb = verticesY[fb];
                    const vyc = verticesY[fc];

                    const vza = verticesZ[fa];
                    const vzb = verticesZ[fb];
                    const vzc = verticesZ[fc];

                    const index0 = vertexBuf.addVertex(vxa, vya, vza, rgbA, hslA, faceAlpha, u0, v0, textureIndex, priority + 1);
                    const index1 = vertexBuf.addVertex(vxb, vyb, vzb, rgbB, hslB, faceAlpha, u1, v1, textureIndex, priority + 1);
                    const index2 = vertexBuf.addVertex(vxc, vyc, vzc, rgbC, hslC, faceAlpha, u2, v2, textureIndex, priority + 1);

                    indices.push(
                        index0,
                        index1,
                        index2,
                    );
                }

                const modelVertexCount = (indices.length * 4 - indexOffset) / 4;

                if (modelVertexCount == 0) {
                    continue;
                }

                const objectDatas: ObjectData[] = modelSpawns.objectDatas;
                const objectDatasLowDetail: ObjectData[] = modelSpawns.objectDatasLowDetail;

                if (objectDatas.length) {
                    drawCommands.push({
                        vertexOffset: indexOffset,
                        vertexCount: modelVertexCount,
                        objectDatas
                    });
                }
                if (objectDatasLowDetail.length) {
                    drawCommandsLowDetail.push({
                        vertexOffset: indexOffset,
                        vertexCount: modelVertexCount,
                        objectDatas: objectDatasLowDetail
                    });
                }
            }

            // console.log(uniqueVertices);
        }


        const triangles = drawCommands.map(cmd => cmd.vertexCount / 3 * cmd.objectDatas.length).reduce((a, b) => a + b, 0);
        const lowDetailTriangles = drawCommandsLowDetail.map(cmd => cmd.vertexCount / 3 * cmd.objectDatas.length).reduce((a, b) => a + b, 0);
        const totalTriangles = triangles + lowDetailTriangles;

        drawCommands.push(...drawCommandsLowDetail);

        const uniqTotalTriangles = drawCommands.map(cmd => cmd.vertexCount / 3).reduce((a, b) => a + b, 0);

        const indexBufferBytes = indices.length * 4;
        const currentBytes = vertexBuf.vertexOffset * VertexBuffer.VERTEX_STRIDE + indexBufferBytes;

        const drawRanges: DrawCommand[] = [];

        const objectDatas = drawCommands.map(cmd => cmd.objectDatas).reduce((a, b) => a.concat(b), []);
        const objectDataCount = objectDatas.length;

        const paddedModelDataLength = ((drawCommands.length + objectDataCount) / 16 + 1) * 16;
        let objectDataOffset = 0;
        const perModelTextureData = new Int32Array(paddedModelDataLength);
        drawCommands.forEach((cmd, index) => {
            perModelTextureData[index] = (drawCommands.length + objectDataOffset);

            drawRanges.push(newDrawCommand(cmd.vertexOffset, cmd.vertexCount, cmd.objectDatas.length));

            objectDataOffset += cmd.objectDatas.length;
        })

        objectDatas.forEach((data, index) => {
            // multiply so we can divide in shader and get the half tile
            // maybe use * 4 if there are 0.25 offsets
            const xEncoded = data.localX * 32;
            const yEncoded = data.localY * 32;
            const contourGround = Math.min(data.contourGround + 1, 1);
            perModelTextureData[drawCommands.length + index] = xEncoded << 20 | yEncoded << 8 | data.plane << 6 | contourGround << 5 | data.priority;
        });

        console.log('total triangles', totalTriangles, 'low detail: ', triangles, 'uniq triangles: ', uniqTotalTriangles,
            'terrain verts: ', terrainVertexCount, 'total vertices: ', vertexBuf.vertexOffset, 'now: ', currentBytes, currentBytes - indexBufferBytes,
            'uniq vertices: ', vertexBuf.vertexIndices.size, 'data texture size: ', perModelTextureData.length, 'draw calls: ', drawRanges.length);

        const heightMapTextureData = this.loadHeightMapTextureData(regionX, regionY);

        const drawRangesLowDetail = drawRanges.slice(0, drawCommands.length - drawCommandsLowDetail.length);

        try {
            console.time('convert');
            return {
                regionX,
                regionY,
                vertices: new Uint8Array(vertexBuf.view.buffer).subarray(0, vertexBuf.vertexOffset * VertexBuffer.VERTEX_STRIDE),
                indices: new Int32Array(indices),
                perModelTextureData,
                heightMapTextureData,
                drawRanges: drawRanges,
                drawRangesLowDetail: drawRangesLowDetail
            };
        } finally {
            console.timeEnd('convert');
        }
    }

    load2(regionX: number, regionY: number): ChunkData | undefined {
        const baseX = regionX * 64;
        const baseY = regionY * 64;

        const region = this.regionLoader.getRegion(regionX, regionY);
        if (!region) {
            return undefined;
        }


        const objectModelLoader = new ObjectModelLoader(new IndexModelLoader(this.modelLoader.modelIndex));

        const vertexBuf = new VertexBuffer(100000);

        const indices: number[] = [];

        const drawCommands: InstancedDrawCommand[] = [];

        const drawCommandsLowDetail: InstancedDrawCommand[] = [];

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

        const underlayIdSet: Set<number> = new Set();
        const overlayIdSet: Set<number> = new Set();
        const heightSet: Set<number> = new Set();
        const lightSet: Set<number> = new Set();

        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            const indexOffset = indices.length * 4;
            for (let x = 0; x < Scene.MAP_SIZE; x++) {
                for (let y = 0; y < Scene.MAP_SIZE; y++) {
                    const underlayId = underlayIds[plane][x][y] - 1;

                    const overlayId = overlayIds[plane][x][y] - 1;

                    underlayIdSet.add(underlayId);
                    overlayIdSet.add(overlayId);

                    if (underlayId == -1 && overlayId == -1) {
                        continue;
                    }

                    const heightSw = heights[plane][x][y];
                    let heightSe: number;
                    let heightNe: number;
                    let heightNw: number;

                    heightSet.add(heightSw);

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

                    lightSet.add(lightSw);
                    lightSet.add(lightSe);
                    lightSet.add(lightNe);
                    lightSet.add(lightNw);

                    let underlayHsl = -1;
                    if (underlayId !== -1) {
                        underlayHsl = blendedColors[plane][x][y];
                    }

                    if (overlayId == -1) {
                        addTileModel(0, 0, -1, x, y, heightSw, heightSe, heightNe, heightNw,
                            method5679(underlayHsl, lightSw), method5679(underlayHsl, lightSe), method5679(underlayHsl, lightNe), method5679(underlayHsl, lightNw),
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
                            method5679(underlayHsl, lightSw), method5679(underlayHsl, lightSe), method5679(underlayHsl, lightNe), method5679(underlayHsl, lightNw),
                            method3516(overlayHsl, lightSw), method3516(overlayHsl, lightSe), method3516(overlayHsl, lightNe), method3516(overlayHsl, lightNw),
                            vertexBuf, indices);
                    }
                }
            }

            const planeVertexCount = (indices.length * 4 - indexOffset) / 4;

            if (planeVertexCount > 0) {
                drawCommands.push({
                    vertexOffset: indexOffset,
                    vertexCount: planeVertexCount,
                    objectDatas: [{ localX: 0, localY: 0, plane: plane, contourGround: 1, priority: 0 }],
                });
            }
        }

        terrainVertexCount = vertexBuf.vertexOffset;

        const landscapeData = this.regionLoader.getLandscapeData(regionX, regionY);

        // check if is empty water region
        // if (overlayIdSet.size == 2 && overlayIdSet.has(5) 
        //         && heightSet.size === 1 && heightSet.has(0)
        //         && lightSet.size === 1 && lightSet.has(84)
        //         && (!landscapeData || landscapeData.length <= 1)) {
        //     console.log(underlayIdSet, overlayIdSet, heightSet, lightSet, landscapeData)
        //     return undefined;
        // }

        if (landscapeData && 1) {
            const heightMap = this.loadHeightMap(regionX, regionY, 72);

            const scene = new Scene2(4, 64, 64, heightMap);
            scene.decodeLandscape(this.regionLoader, objectModelLoader, landscapeData);

            scene.applyLighting(-50, -10, -50);

            const lowDetailOcclusionMap: boolean[][][] = new Array(Scene.MAX_PLANE);
            for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
                lowDetailOcclusionMap[plane] = new Array(Scene.MAP_SIZE);
                for (let x = 0; x < Scene.MAP_SIZE; x++) {
                    lowDetailOcclusionMap[plane][x] = new Array(Scene.MAP_SIZE).fill(false);
                }
            }

            for (let x = 0; x < Scene.MAP_SIZE; x++) {
                for (let y = 0; y < Scene.MAP_SIZE; y++) {
                    let occluded = false;
                    for (let plane = Scene.MAX_PLANE - 1; plane >= 0; plane--) {
                        lowDetailOcclusionMap[plane][x][y] = occluded;
                        const underlayId = underlayIds[plane][x][y];
                        const overlayId = overlayIds[plane][x][y];
                        // everything below a roof or tile can be occluded
                        if ((renderFlags[plane][x][y] & 16) != 0 || underlayId || overlayId) {
                            occluded = true;
                        }
                    }
                }
            }

            const regionModelSpawns: Map<number, ModelSpawns> = new Map();

            const gameObjects: Set<GameObject> = new Set();
            let gameObjectCount = 0;

            for (let plane = 0; plane < scene.planes; plane++) {
                for (let tileX = 0; tileX < scene.sizeX; tileX++) {
                    for (let tileY = 0; tileY < scene.sizeY; tileY++) {
                        const tile = scene.tiles[plane][tileX][tileY];
                        if (!tile) {
                            continue;
                        }

                        if (tile.floorDecoration) {
                            const def = tile.floorDecoration.def;

                            if (tile.floorDecoration.model instanceof Model) {
                                const model = tile.floorDecoration.model;
                                const key = Math.random();
                                const modelSpawns: ModelSpawns = {
                                    model, hasAlpha: model.hasAlpha(this.textureProvider), def,
                                    type: tile.floorDecoration.type, objectDatas: [], objectDatasLowDetail: []
                                };

                                const priority = 1;

                                const objectData = { localX: tile.floorDecoration.sceneX, localY: tile.floorDecoration.sceneY, plane: plane, contourGround: def.contouredGround, priority };

                                if (isLowDetail(tile.floorDecoration.type, def, tileX, tileY, plane, lowDetailOcclusionMap)) {
                                    modelSpawns.objectDatasLowDetail.push(objectData);
                                } else {
                                    modelSpawns.objectDatas.push(objectData);
                                }

                                regionModelSpawns.set(key, modelSpawns);
                            }
                        }

                        if (tile.wallObject) {
                            const def = tile.wallObject.def;

                            if (tile.wallObject.model0 instanceof Model) {
                                const model = tile.wallObject.model0;
                                const key = Math.random();
                                const modelSpawns: ModelSpawns = {
                                    model, hasAlpha: model.hasAlpha(this.textureProvider), def,
                                    type: tile.wallObject.type, objectDatas: [], objectDatasLowDetail: []
                                };

                                const priority = 1;

                                const objectData = { localX: tile.wallObject.sceneX, localY: tile.wallObject.sceneY, plane: plane, contourGround: def.contouredGround, priority };
                                modelSpawns.objectDatas.push(objectData)

                                regionModelSpawns.set(key, modelSpawns);
                            }

                            if (tile.wallObject.model1 instanceof Model) {
                                const model = tile.wallObject.model1;
                                const key = Math.random();
                                const modelSpawns: ModelSpawns = {
                                    model, hasAlpha: model.hasAlpha(this.textureProvider), def,
                                    type: tile.wallObject.type, objectDatas: [], objectDatasLowDetail: []
                                };

                                const priority = 1;

                                const objectData = { localX: tile.wallObject.sceneX, localY: tile.wallObject.sceneY, plane: plane, contourGround: def.contouredGround, priority };
                                modelSpawns.objectDatas.push(objectData)

                                regionModelSpawns.set(key, modelSpawns);
                            }
                        }

                        if (tile.wallDecoration) {
                            const def = tile.wallDecoration.def;

                            if (tile.wallDecoration.model0 instanceof Model) {
                                const model = tile.wallDecoration.model0;
                                const key = Math.random();
                                const modelSpawns: ModelSpawns = {
                                    model, hasAlpha: model.hasAlpha(this.textureProvider), def,
                                    type: tile.wallDecoration.type, objectDatas: [], objectDatasLowDetail: []
                                };

                                const priority = 2;

                                const sceneX = (tile.wallDecoration.sceneX + tile.wallDecoration.offsetX);
                                const sceneY = (tile.wallDecoration.sceneY + tile.wallDecoration.offsetY);


                                const objectData = { localX: sceneX, localY: sceneY, plane: plane, contourGround: def.contouredGround, priority };
                                modelSpawns.objectDatas.push(objectData);

                                regionModelSpawns.set(key, modelSpawns);
                            }
                            if (tile.wallDecoration.model1 instanceof Model) {
                                const model = tile.wallDecoration.model1;
                                const key = Math.random();
                                const modelSpawns: ModelSpawns = {
                                    model, hasAlpha: model.hasAlpha(this.textureProvider), def,
                                    type: tile.wallDecoration.type, objectDatas: [], objectDatasLowDetail: []
                                };

                                const priority = 2;


                                const sceneX = (tile.wallDecoration.sceneX);
                                const sceneY = (tile.wallDecoration.sceneY);

                                const objectData = { localX: sceneX, localY: sceneY, plane: plane, contourGround: def.contouredGround, priority };

                                if (isLowDetail(tile.wallDecoration.type, def, tileX, tileY, plane, lowDetailOcclusionMap)) {
                                    modelSpawns.objectDatasLowDetail.push(objectData);
                                } else {
                                    modelSpawns.objectDatas.push(objectData);
                                }

                                regionModelSpawns.set(key, modelSpawns);
                            }
                        }

                        for (const gameObject of tile.gameObjects) {
                            // gameObjects.add(gameObject);
                            // gameObjectCount++;
                            const model = gameObject.model;

                            const def = gameObject.def;

                            const key = Math.random();
                            if (model instanceof Model && !gameObjects.has(gameObject)) {
                                const modelSpawns: ModelSpawns = {
                                    model, hasAlpha: model.hasAlpha(this.textureProvider), def,
                                    type: gameObject.type, objectDatas: [], objectDatasLowDetail: []
                                };

                                const priority = 1;

                                const objectData = { localX: gameObject.sceneX, localY: gameObject.sceneY, plane: plane, contourGround: def.contouredGround, priority };

                                if (isLowDetail(gameObject.type, def, tileX, tileY, plane, lowDetailOcclusionMap)) {
                                    modelSpawns.objectDatasLowDetail.push(objectData);
                                } else {
                                    modelSpawns.objectDatas.push(objectData);
                                }

                                regionModelSpawns.set(key, modelSpawns);


                                gameObjects.add(gameObject);
                            }
                        }
                    }
                }
            }

            // console.log(gameObjectCount, gameObjects);

            // console.log(lowDetailOcclusionMap);

            const spawns = region.decodeLandscape(new ByteBuffer(landscapeData));

            const objectModels: Map<number, Model> = new Map();

            for (const spawn of spawns) {
                let { id, type, rotation, localX, localY, plane } = spawn;
                const def = this.regionLoader.getObjectDef(id);

                // if (def.animationId !== -1) {
                //     continue;
                // }

                if (def.mergeNormals) {
                    // continue;
                }

                if (def.contouredGround >= 0) {
                    // continue;
                }

                if (type !== 5 && 1) {
                    // continue;
                }

                // only roofs?
                // if (/*(renderFlags[0][localX][localY] & 2) != 0 || */(renderFlags[plane][localX][localY] & 16) == 0) {
                //     continue;
                // }


                // if ((renderFlags[0][localX][localY] & 2) != 0) {
                //     continue;
                // }

                let sizeX = def.sizeX;
                let sizeY = def.sizeY;

                if (rotation == 1 || rotation == 3) {
                    sizeX = def.sizeY;
                    sizeY = def.sizeX;
                }

                const pos = [localX + sizeX / 2, localY + sizeY / 2];

                let modelKey = rotation << 24 | type << 16 | id;

                let model = objectModels.get(modelKey);

                // if (!model) {
                //     // corner walls
                //     if (type == 2) {
                //         const wall0 = getModel(this.modelLoader, def, type, rotation + 1 & 3);
                //         const wall1 = getModel(this.modelLoader, def, type, rotation + 4);
                //         if (wall0 && wall1) {
                //             model = Model.merge([wall0, wall1], 2);
                //         }
                //     } else {
                //         model = getModel(this.modelLoader, def, type, rotation);
                //     }
                //     if (!model) {
                //         continue;
                //     }
                //     objectModels.set(modelKey, model);
                // }

                // let modelSpawns = regionModelSpawns.get(modelKey);
                // if (!modelSpawns) {
                //     modelSpawns = { model: model, hasAlpha: model.hasAlpha(this.textureProvider), def, type, objectDatas: [], objectDatasLowDetail: [] };
                // }

                // let priority = 1;
                // if (type >= 0 && type <= 2 || type == 9) {
                //     // priority = 3;
                // } else if (type >= 4 && type <= 8) {
                //     // priority = 6;
                // }

                // const objectData = { localX: pos[0], localY: pos[1], plane: plane, contourGround: def.contouredGround, priority };

                // if (isLowDetail(type, def, localX, localY, plane, lowDetailOcclusionMap)) {
                //     modelSpawns.objectDatasLowDetail.push(objectData);
                // } else {
                //     modelSpawns.objectDatas.push(objectData);
                // }

                // regionModelSpawns.set(modelKey, modelSpawns);
            }

            console.log('diff models: ', regionModelSpawns.size);

            const allModelSpawns = Array.from(regionModelSpawns.values());

            // draw transparent objects last
            allModelSpawns.sort((a, b) => (a.hasAlpha ? 1 : 0) - (b.hasAlpha ? 1 : 0));

            // allModelSpawns.sort((a, b) => a.type - b.type);

            const modelHashes: Set<bigint> = new Set();
            const modelHashCounts: Map<bigint, number> = new Map();

            const modelHashes2: Set<string> = new Set();
            const modelHashCounts2: Map<string, number> = new Map();

            const modelUniqueVertexCounts: Map<bigint, number> = new Map();

            const uniqueModels: Map<bigint, Model> = new Map();

            for (let i = 0; i < allModelSpawns.length; i++) {
                const modelSpawns = allModelSpawns[i];



                const model = modelSpawns.model;

                const verticesX = model.verticesX;
                const verticesY = model.verticesY;
                const verticesZ = model.verticesZ;

                const facesA = model.indices1;
                const facesB = model.indices2;
                const facesC = model.indices3;

                const faceAlphas = model.faceAlphas;

                const priorities = model.faceRenderPriorities;

                const modelTexCoords = computeTextureCoords(model);

                const indexOffset = indices.length * 4;

                // if (model.faceTextures) {
                //     console.log(model.faceTextures)
                // }

                const faces: ModelFace[] = [];

                for (let f = 0; f < model.faceCount; f++) {
                    let faceAlpha = (faceAlphas && faceAlphas[f] & 0xFF) || 255;

                    if (faceAlpha === 0 || faceAlpha == 0xfe) {
                        continue;
                    }

                    let hslC = model.faceColors3[f];

                    if (hslC == -2) {
                        continue;
                    }

                    const priority = (priorities && priorities[f]) || 0;

                    const textureId = (model.faceTextures && model.faceTextures[f]) || -1;

                    faces.push({ index: f, alpha: faceAlpha, priority, textureId });

                }

                // sort on priority, has alpha, texture id, face index
                faces.sort((a, b) => a.priority - b.priority
                    || (a.alpha < 0xFF ? 1 : 0) - (b.alpha < 0xFF ? 1 : 0)
                    || a.textureId - b.textureId
                    || b.index - a.index);

                const modelStartIndices = indices.length;

                let uniqueVertexCount = 0;

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

                    const textureIndex = this.textureProvider.getTextureIndex(textureId) || -1;

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
                    }

                    let rgbA = HSL_RGB_MAP[hslA];
                    let rgbB = HSL_RGB_MAP[hslB];
                    let rgbC = HSL_RGB_MAP[hslC];

                    // const SCALE = 128;
                    const fa = facesA[f];
                    const fb = facesB[f];
                    const fc = facesC[f];

                    const vxa = verticesX[fa];
                    const vxb = verticesX[fb];
                    const vxc = verticesX[fc];

                    const vya = verticesY[fa];
                    const vyb = verticesY[fb];
                    const vyc = verticesY[fc];

                    const vza = verticesZ[fa];
                    const vzb = verticesZ[fb];
                    const vzc = verticesZ[fc];

                    const faceStartVertexOffset = vertexBuf.vertexOffset;

                    const index0 = vertexBuf.addVertex(vxa, vya, vza, rgbA, hslA, faceAlpha, u0, v0, textureIndex, priority + 1);
                    const index1 = vertexBuf.addVertex(vxb, vyb, vzb, rgbB, hslB, faceAlpha, u1, v1, textureIndex, priority + 1);
                    const index2 = vertexBuf.addVertex(vxc, vyc, vzc, rgbC, hslC, faceAlpha, u2, v2, textureIndex, priority + 1);

                    const faceEndVertexOffset = vertexBuf.vertexOffset;

                    uniqueVertexCount += faceEndVertexOffset - faceStartVertexOffset;

                    indices.push(
                        index0,
                        index1,
                        index2,
                    );
                }

                const modelVertexCount = (indices.length * 4 - indexOffset) / 4;

                const modelEndIndices = indices.length;

                if (modelVertexCount == 0) {
                    continue;
                }

                if (xxhashApi) {
                    // const modelStart = (vertexBuf.vertexOffset - modelVertexCount) * VertexBuffer.VERTEX_STRIDE;
                    // const modelEnd = modelStart + modelVertexCount * VertexBuffer.VERTEX_STRIDE;
                    // const modelStart = modelStartVertexOffset * VertexBuffer.VERTEX_STRIDE;
                    // const modelEnd = modelEndVertexOffset * VertexBuffer.VERTEX_STRIDE;
                    // console.log(modelStart, modelEnd);
                    const hashData = new Int32Array(indices.slice(modelStartIndices, modelEndIndices));
                    const hash = xxhashApi.h64Raw(new Uint8Array(hashData.buffer));
                    modelHashes.add(hash);

                    let count = modelHashCounts.get(hash);
                    if (count === undefined) {
                        count = 0;
                    }
                    count++;
                    modelHashCounts.set(hash, count);


                    let ucount = modelUniqueVertexCounts.get(hash);
                    if (ucount === undefined) {
                        ucount = 0;
                    }
                    ucount += uniqueVertexCount;
                    modelUniqueVertexCounts.set(hash, ucount);

                    uniqueModels.set(hash, model);
                }

                const objectDatas: ObjectData[] = modelSpawns.objectDatas;
                const objectDatasLowDetail: ObjectData[] = modelSpawns.objectDatasLowDetail;

                if (objectDatas.length) {
                    drawCommands.push({
                        vertexOffset: indexOffset,
                        vertexCount: modelVertexCount,
                        objectDatas
                    });
                }
                if (objectDatasLowDetail.length) {
                    drawCommandsLowDetail.push({
                        vertexOffset: indexOffset,
                        vertexCount: modelVertexCount,
                        objectDatas: objectDatasLowDetail
                    });
                }
            }

            console.log('hashes: ', modelHashes.size, modelHashes);

            console.log(modelUniqueVertexCounts);

            let uniqueVertexCounts2 = 0;

            let uniqueVertexCounts = 0;

            let uniqueModelCount = 0;
            for (const [hash, count] of modelHashCounts) {
                if (count === 1) {
                    uniqueModelCount++;
                    uniqueVertexCounts += modelUniqueVertexCounts.get(hash) || 0;

                    const model = uniqueModels.get(hash);
                    if (model) {
                        uniqueVertexCounts2 += model.verticesCount;
                    }
                }
            }

            console.log(uniqueModelCount, modelHashCounts);

            console.log('u', uniqueVertexCounts, uniqueVertexCounts2);

            // console.log(uniqueVertices);
        }



        const triangles = drawCommands.map(cmd => cmd.vertexCount / 3 * cmd.objectDatas.length).reduce((a, b) => a + b, 0);
        const lowDetailTriangles = drawCommandsLowDetail.map(cmd => cmd.vertexCount / 3 * cmd.objectDatas.length).reduce((a, b) => a + b, 0);
        const totalTriangles = triangles + lowDetailTriangles;

        drawCommands.push(...drawCommandsLowDetail);

        const uniqTotalTriangles = drawCommands.map(cmd => cmd.vertexCount / 3).reduce((a, b) => a + b, 0);

        const indexBufferBytes = indices.length * 4;
        const currentBytes = vertexBuf.vertexOffset * VertexBuffer.VERTEX_STRIDE + indexBufferBytes;

        const drawRanges: DrawCommand[] = [];

        const objectDatas = drawCommands.map(cmd => cmd.objectDatas).reduce((a, b) => a.concat(b), []);
        const objectDataCount = objectDatas.length;

        const paddedModelDataLength = ((drawCommands.length + objectDataCount) / 16 + 1) * 16;
        let objectDataOffset = 0;
        const perModelTextureData = new Int32Array(paddedModelDataLength);
        drawCommands.forEach((cmd, index) => {
            perModelTextureData[index] = (drawCommands.length + objectDataOffset);

            drawRanges.push(newDrawCommand(cmd.vertexOffset, cmd.vertexCount, cmd.objectDatas.length));

            objectDataOffset += cmd.objectDatas.length;
        })

        objectDatas.forEach((data, index) => {
            // multiply so we can divide in shader and get the half tile
            // maybe use * 4 if there are 0.25 offsets
            const xEncoded = (data.localX / 4) | 0;
            const yEncoded = (data.localY / 4) | 0;
            const contourGround = Math.min(data.contourGround + 1, 1);
            perModelTextureData[drawCommands.length + index] = xEncoded << 20 | yEncoded << 8 | data.plane << 6 | contourGround << 5 | data.priority;
        });

        console.log('total triangles', totalTriangles, 'low detail: ', triangles, 'uniq triangles: ', uniqTotalTriangles,
            'terrain verts: ', terrainVertexCount, 'total vertices: ', vertexBuf.vertexOffset, 'now: ', currentBytes, currentBytes - indexBufferBytes,
            'uniq vertices: ', vertexBuf.vertexIndices.size, 'data texture size: ', perModelTextureData.length, 'draw calls: ', drawRanges.length);

        const heightMapTextureData = this.loadHeightMapTextureData(regionX, regionY);

        const drawRangesLowDetail = drawRanges.slice(0, drawCommands.length - drawCommandsLowDetail.length);

        try {
            console.time('convert');
            return {
                regionX,
                regionY,
                vertices: new Uint8Array(vertexBuf.view.buffer).subarray(0, vertexBuf.vertexOffset * VertexBuffer.VERTEX_STRIDE),
                indices: new Int32Array(indices),
                perModelTextureData,
                heightMapTextureData,
                drawRanges: drawRanges,
                drawRangesLowDetail: drawRangesLowDetail
            };
        } finally {
            console.timeEnd('convert');
        }
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
