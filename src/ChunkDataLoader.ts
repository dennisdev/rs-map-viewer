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
    vertices: number[], colors: number[], texCoords: number[], textureIds: number[]) {
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
        vertexY[i] = vertY;
        vertexZ[i] = vertZ;
        underlayHsls[i] = underlayHsl;
        overlayHsls[i] = overlayHsl;
    }

    const tileFaces = tileShapeFaces[shape];
    const faceCount = tileFaces.length / 4;


    let tileFaceIndex = 0;

    // const vertices = [];
    // const colors = [];
    // const texCoords = [];
    // const textureIds = [];

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

        vertices.push(
            vertexX[a] / TILE_SIZE, vertexY[a] / TILE_SIZE, vertexZ[a] / TILE_SIZE,
            vertexX[b] / TILE_SIZE, vertexY[b] / TILE_SIZE, vertexZ[b] / TILE_SIZE,
            vertexX[c] / TILE_SIZE, vertexY[c] / TILE_SIZE, vertexZ[c] / TILE_SIZE,
        );

        let rgbA = HSL_RGB_MAP[hslA];
        let rgbB = HSL_RGB_MAP[hslB];
        let rgbC = HSL_RGB_MAP[hslC];

        if (faceTextureId !== -1) {
            const lightA = (hslA & 127) / 127 * 255;
            const lightB = (hslB & 127) / 127 * 255;
            const lightC = (hslC & 127) / 127 * 255;
            // console.log(lightA, lightB, lightC, overlayHslNe, overlayHslNw, overlayHslSe, overlayHslSw);
            colors.push(
                lightA, lightA, lightA, 255,
                lightB, lightB, lightB, 255,
                lightC, lightC, lightC, 255,
            );
        } else {
            colors.push(
                (rgbA >> 16) & 0xFF, (rgbA >> 8) & 0xFF, rgbA & 0xFF, 255,
                (rgbB >> 16) & 0xFF, (rgbB >> 8) & 0xFF, rgbB & 0xFF, 255,
                (rgbC >> 16) & 0xFF, (rgbC >> 8) & 0xFF, rgbC & 0xFF, 255,
            );
        }

        // if (faceTextureId !== -1) {
        //     console.log(rgbA, rgbB, rgbC);
        // }

        // colors.push(
        //     (rgbA >> 16) & 0xFF, (rgbA >> 8) & 0xFF, rgbA & 0xFF, 1.0,
        //     (rgbB >> 16) & 0xFF, (rgbB >> 8) & 0xFF, rgbB & 0xFF, 1.0,
        //     (rgbC >> 16) & 0xFF, (rgbC >> 8) & 0xFF, rgbC & 0xFF, 1.0,
        // );

        texCoords.push(
            (vertexX[a] - tileX) / TILE_SIZE, (vertexZ[a] - tileY) / TILE_SIZE,
            (vertexX[b] - tileX) / TILE_SIZE, (vertexZ[b] - tileY) / TILE_SIZE,
            (vertexX[c] - tileX) / TILE_SIZE, (vertexZ[c] - tileY) / TILE_SIZE,
        );

        faceTextureId++;

        textureIds.push(
            faceTextureId,
            faceTextureId,
            faceTextureId
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
    const faceTextureUCoordinates: number[] = new Array(faceCount * 6);

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
    vertices: Float32Array,
    colors: Uint8Array,
    texCoords: Float32Array,
    textureIds: Uint8Array,
    perModelTextureData: Int32Array,
    heightMapTextureData: Int32Array,
    drawRanges: DrawCommand[];
    drawRangesLowDetail: DrawCommand[];
};

type ObjectData = {
    localX: number,
    localY: number,
    plane: number,
    contourGround: number,
};

type DrawCommand = [number, number, number];

function newDrawCommand(offset: number, elements: number, instances: number): DrawCommand {
    return [offset, elements, instances];
}

type ModelSpawns = {
    model: Model,
    positions: vec3[],
    mirrored: boolean,
    def: ObjectDefinition,
    type: number,
}


export class ChunkDataLoader {
    regionLoader: RegionLoader;

    modelIndex: IndexSync<StoreSync>;

    textureProvider: TextureLoader;

    constructor(regionLoader: RegionLoader, modelIndex: IndexSync<StoreSync>, textureProvider: TextureLoader) {
        this.regionLoader = regionLoader;
        this.modelIndex = modelIndex;
        this.textureProvider = textureProvider;
    }

    load(regionX: number, regionY: number): ChunkData {
        const baseX = regionX * 64;
        const baseY = regionY * 64;

        const vertices: number[] = [];

        const colors: number[] = [];

        const texCoords: number[] = [];

        const textureIds: number[] = [];

        const region = this.regionLoader.getRegion(regionX, regionY);

        const modelDataOffsets: number[] = [];

        const modelDatas: ObjectData[] = [];

        const drawCommands: DrawCommand[] = [];

        let floorDecorationDrawOffset: number | undefined = undefined;

        if (region) {
            const heights = region.tileHeights;
            const underlayIds = region.tileUnderlays;
            const overlayIds = region.tileOverlays;
            const tileShapes = region.tileShapes;
            const tileRotations = region.tileRotations;
            const renderFlags = region.tileRenderFlags;

            console.time(`blend region ${regionX}_${regionY}`);
            const blendedColors = this.regionLoader.getBlendedUnderlayColors(regionX, regionY);
            console.timeEnd(`blend region ${regionX}_${regionY}`);

            console.time(`light region ${regionX}_${regionY}`);
            const lightLevels = this.regionLoader.getLightLevels(regionX, regionY);
            console.timeEnd(`light region ${regionX}_${regionY}`);

            for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
                for (let x = 0; x < Scene.MAP_SIZE; x++) {
                    for (let y = 0; y < Scene.MAP_SIZE; y++) {
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

                        let underlayHsl = -1;
                        if (underlayId !== -1) {
                            underlayHsl = blendedColors[plane][x][y];
                        }

                        if (overlayId == -1) {
                            addTileModel(0, 0, -1, x, y, heightSw, heightSe, heightNe, heightNw,
                                method5679(underlayHsl, lightSw), method5679(underlayHsl, lightSe), method5679(underlayHsl, lightNe), method5679(underlayHsl, lightNw),
                                0, 0, 0, 0,
                                vertices, colors, texCoords, textureIds);
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
                                vertices, colors, texCoords, textureIds);
                        }
                    }
                }
            }

            modelDataOffsets.push(modelDatas.length);
            modelDatas.push({ localX: 0, localY: 0, plane: 0, contourGround: -1 });
            drawCommands.push(newDrawCommand(0, vertices.length / 3, 1));


            const landscapeData = this.regionLoader.getLandscapeData(regionX, regionY);
            if (landscapeData && 1) {
                const spawns = region.decodeLandscape(new ByteBuffer(landscapeData));
                // const hmm = spawns.map((spawn) => regionLoader.getObjectDef(spawn.id))
                // .filter(def => def.contouredGround >= 0);
                // console.log(hmm);

                const models: Map<number, ModelData> = new Map();

                const getModelData = (id: number) => {
                    let model = models.get(id);
                    if (!model) {
                        const file = this.modelIndex.getFile(id, 0);
                        if (file) {
                            model = ModelData.decode(file.data);
                            models.set(id, model);
                        }
                    }
                    return model;
                }

                const regionModelSpawns: Map<number, ModelSpawns> = new Map();

                const getModel = (def: ObjectDefinition, type: number, rotation: number): Model | undefined => {
                    const modelIds = [];

                    if (type === 22) {
                        // return;
                    }

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
                        let model = getModelData(modelIds[i]);
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
                        for (let var7 = 0; var7 < def.recolorFrom.length; ++var7) {
                            copy.recolor(def.recolorFrom[var7], def.recolorTo[var7]);
                        }
                    }

                    if (def.retextureFrom) {
                        for (let var7 = 0; var7 < def.retextureFrom.length; ++var7) {
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

                const objectModels: Map<number, Model> = new Map();

                for (const spawn of spawns) {
                    let { id, type, rotation, localX, localY, plane } = spawn;
                    const def = this.regionLoader.getObjectDef(id);

                    // if (def.name && def.name.toLowerCase().includes('scoreboard')) {
                    //     console.log('stall', id, type, rotation);
                    // }

                    let sizeX = def.sizeX;
                    let sizeY = def.sizeY;

                    if (rotation == 1 || rotation == 3) {
                        sizeX = def.sizeY;
                        sizeY = def.sizeX;
                    }

                    const pos = [localX + sizeX / 2, localY + sizeY / 2];

                    const modelKey = rotation << 24 | type << 16 | id;

                    let model = objectModels.get(modelKey);

                    if (!model) {
                        model = getModel(def, type, rotation);
                        if (!model) {
                            continue;
                        }
                        objectModels.set(modelKey, model);
                    }

                    // const model2 = getModel(def, type, rotation);

                    // if (!model) {
                    //     continue;
                    // }

                    // uniqModels.set(modelJson, model2);

                    const modelSpawns = regionModelSpawns.get(modelKey) || { model: model, positions: [], mirrored: false, def, type };
                    modelSpawns.positions.push([pos[0], pos[1], plane]);
                    regionModelSpawns.set(modelKey, modelSpawns);
                }

                // let offset = terrainVertexOffset;

                console.log('diff models: ', regionModelSpawns.size);

                const allModelSpawns = Array.from(regionModelSpawns.values());

                allModelSpawns.sort((a, b) => a.type - b.type);

                for (let i = 0; i < allModelSpawns.length; i++) {
                    const modelSpawns = allModelSpawns[i];

                    if (floorDecorationDrawOffset === undefined && modelSpawns.type === 22) {
                        floorDecorationDrawOffset = i;
                    }

                    const model = modelSpawns.model;
                    const mirrored = modelSpawns.mirrored;

                    const verticesX = model.verticesX;
                    const verticesY = model.verticesY;
                    const verticesZ = model.verticesZ;

                    const facesA = model.indices1;
                    const facesB = model.indices2;
                    const facesC = model.indices3;

                    const faceAlphas = model.faceAlphas;

                    const modelTexCoords = computeTextureCoords(model);

                    const offset = vertices.length;


                    for (let f = 0; f < model.faceCount; f++) {
                        const fa = facesA[f];
                        const fb = facesB[f];
                        const fc = facesC[f];

                        let faceAlpha = (faceAlphas && faceAlphas[f] & 0xFF) || 255;

                        if (faceAlpha === 0 || faceAlpha == 0xfe) {
                            continue;
                        }

                        let hslA = model.faceColors1[f];
                        let hslB = model.faceColors2[f];
                        let hslC = model.faceColors3[f];

                        if (hslC == -1) {
                            hslC = hslB = hslA;
                        } else if (hslC == -2) {
                            continue;
                        }

                        const textureId = (model.faceTextures && model.faceTextures[f]) || -1;

                        const textureIndex = this.textureProvider.getTextureIndex(textureId) || -1;

                        let rgbA = HSL_RGB_MAP[hslA];
                        let rgbB = HSL_RGB_MAP[hslB];
                        let rgbC = HSL_RGB_MAP[hslC];

                        // const SCALE = 128;

                        const vxa = verticesX[fa] / SCALE;
                        const vxb = verticesX[fb] / SCALE;
                        const vxc = verticesX[fc] / SCALE;

                        const vza = verticesZ[fa] / SCALE;
                        const vzb = verticesZ[fb] / SCALE;
                        const vzc = verticesZ[fc] / SCALE;

                        if (mirrored) {
                            // reverse order for backface culling to work
                            vertices.push(
                                vxa, verticesY[fa] / SCALE, vza,
                                vxb, verticesY[fb] / SCALE, vzb,
                                vxc, verticesY[fc] / SCALE, vzc,
                            );
                        } else {
                            vertices.push(
                                vxa, verticesY[fa] / SCALE, vza,
                                vxb, verticesY[fb] / SCALE, vzb,
                                vxc, verticesY[fc] / SCALE, vzc,
                            );
                        }

                        // colors.push(
                        //     r, g, b, 1,
                        //     r, g, b, 1,
                        //     r, g, b, 1,
                        // );

                        if (textureIndex !== -1) {
                            const lightA = (hslA & 127) / 127 * 255;
                            const lightB = (hslB & 127) / 127 * 255;
                            const lightC = (hslC & 127) / 127 * 255;
                            // console.log(lightA, lightB, lightC, overlayHslNe, overlayHslNw, overlayHslSe, overlayHslSw);
                            colors.push(
                                lightA, lightA, lightA, 255,
                                lightB, lightB, lightB, 255,
                                lightC, lightC, lightC, 255,
                            );
                        } else {
                            colors.push(
                                (rgbA >> 16) & 0xFF, (rgbA >> 8) & 0xFF, rgbA & 0xFF, faceAlpha,
                                (rgbB >> 16) & 0xFF, (rgbB >> 8) & 0xFF, rgbB & 0xFF, faceAlpha,
                                (rgbC >> 16) & 0xFF, (rgbC >> 8) & 0xFF, rgbC & 0xFF, faceAlpha,
                            );
                        }

                        if (modelTexCoords) {
                            const texCoordIdx = f * 6;
                            texCoords.push(
                                modelTexCoords[texCoordIdx], modelTexCoords[texCoordIdx + 1],
                                modelTexCoords[texCoordIdx + 2], modelTexCoords[texCoordIdx + 3],
                                modelTexCoords[texCoordIdx + 4], modelTexCoords[texCoordIdx + 5],
                            );
                        } else {
                            texCoords.push(
                                0, 0,
                                0, 0,
                                0, 0,
                            );
                        }

                        textureIds.push(
                            textureIndex + 1,
                            textureIndex + 1,
                            textureIndex + 1,
                        );
                    }

                    const modelVertexCount = vertices.length - offset;

                    modelDataOffsets.push(modelDatas.length);

                    modelSpawns.positions.forEach(pos => {
                        modelDatas.push({localX: pos[0], localY: pos[1], plane: pos[2], contourGround: modelSpawns.def.contouredGround});
                    });

                    drawCommands.push(newDrawCommand(offset / 3, modelVertexCount / 3, modelSpawns.positions.length));
                }
            }
        }

        const perModelTextureData = new Int32Array(modelDataOffsets.length + modelDatas.length);
        modelDataOffsets.forEach((offset, index) => {
            perModelTextureData[index] = (modelDataOffsets.length + offset);
        })

        modelDatas.forEach((data, index) => {
            // multiply so we can divide in shader and get the half tile
            // maybe use * 4 if there are 0.25 offsets
            const xEncoded = data.localX * 2;
            const yEncoded = data.localY * 2;
            const contourGround = Math.min(data.contourGround + 1, 1);
            perModelTextureData[modelDataOffsets.length + index] = xEncoded << 24 | yEncoded << 16 | data.plane << 8 | contourGround;
        });

        const heightMapTextureData = this.loadHeightMapTextureData(regionX, regionY);

        const drawCommandsLowDetail = drawCommands.slice(0, floorDecorationDrawOffset || drawCommands.length);

        try {
            console.time('convert');
            return {
                regionX,
                regionY,
                vertices: new Float32Array(vertices),
                colors: new Uint8Array(colors),
                texCoords: new Float32Array(texCoords),
                textureIds: new Uint8Array(textureIds),
                perModelTextureData,
                heightMapTextureData,
                drawRanges: drawCommands,
                drawRangesLowDetail: drawCommandsLowDetail
            };
        } finally {
            console.timeEnd('convert');
        }
    }

    loadHeightMapTextureData(regionX: number, regionY: number): Int32Array {
        const heightMapTextureData = new Int32Array(Scene.MAX_PLANE * 72 * 72);

        const baseX = regionX * 64;
        const baseY = regionY * 64;

        let dataIndex = 0;
        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            for (let y = 0; y < 72; y++) {
                for (let x = 0; x < 72; x++) {
                    heightMapTextureData[dataIndex++] = -this.regionLoader.getHeight(baseX + x, baseY + y, plane) / 8;
                }
            }
        }

        return heightMapTextureData;
    }
}
