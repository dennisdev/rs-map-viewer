import {
    INVALID_HSL_COLOR,
    adjustOverlayLight,
    adjustUnderlayLight,
    mixHsl,
    packHsl,
} from "../util/ColorUtil";

const TILE_SIZE = 128;
const HALF_TILE_SIZE = TILE_SIZE / 2;
const QUARTER_TILE_SIZE = TILE_SIZE / 4;
const THREE_QTR_TILE_SIZE = (TILE_SIZE * 3) / 4;

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
    [1, 3, 5, 7, 13, 14],
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
    [1, 0, 5, 4, 1, 0, 1, 5, 0, 0, 4, 3, 0, 4, 5, 3, 0, 5, 2, 3, 0, 1, 2, 5],
];

type SceneTileFace = {
    vertices: [SceneTileVertex, SceneTileVertex, SceneTileVertex];
};

type SceneTileVertex = {
    x: number;
    y: number;
    z: number;
    hsl: number;
    u: number;
    v: number;
    textureId: number;
};

export class SceneTileModel {
    underlayHslSw: number;
    underlayHslSe: number;
    underlayHslNe: number;
    underlayHslNw: number;

    overlayHslSw: number;
    overlayHslSe: number;
    overlayHslNe: number;
    overlayHslNw: number;

    overlayMinimapHslSw: number;
    overlayMinimapHslSe: number;
    overlayMinimapHslNe: number;
    overlayMinimapHslNw: number;

    vertexX: Int32Array;
    vertexY: Int32Array;
    vertexZ: Int32Array;

    facesA: Int32Array;
    facesB: Int32Array;
    facesC: Int32Array;

    faceColorsA: Int32Array;
    faceColorsB: Int32Array;
    faceColorsC: Int32Array;

    minimapFaceColorsA: Int32Array;
    minimapFaceColorsB: Int32Array;
    minimapFaceColorsC: Int32Array;

    faceTextures?: Int32Array;

    faces: SceneTileFace[] = [];
    // This can be less than faces.length due to hidden faces
    normalFaceCount: number;

    constructor(
        readonly shape: number,
        readonly rotation: number,
        readonly textureId: number,
        x: number,
        y: number,
        heightSw: number,
        heightSe: number,
        heightNe: number,
        heightNw: number,
        readonly lightSw: number,
        readonly lightSe: number,
        readonly lightNe: number,
        readonly lightNw: number,
        readonly blendUnderlayHslSw: number,
        readonly blendUnderlayHslSe: number,
        readonly blendUnderlayHslNe: number,
        readonly blendUnderlayHslNw: number,
        readonly overlayHsl: number,
        readonly overlayMinimapHsl: number,
        readonly underlayRgb: number,
        readonly overlayRgb: number,
    ) {
        this.shape = shape;
        this.rotation = rotation;

        const underlayHslSw = (this.underlayHslSw = adjustUnderlayLight(
            blendUnderlayHslSw,
            lightSw,
        ));
        const underlayHslSe = (this.underlayHslSe = adjustUnderlayLight(
            blendUnderlayHslSe,
            lightSe,
        ));
        const underlayHslNe = (this.underlayHslNe = adjustUnderlayLight(
            blendUnderlayHslNe,
            lightNe,
        ));
        const underlayHslNw = (this.underlayHslNw = adjustUnderlayLight(
            blendUnderlayHslNw,
            lightNw,
        ));

        const underlayMinimapHslSw = adjustUnderlayLight(blendUnderlayHslSw, lightSw);
        const underlayMinimapHslSe = adjustUnderlayLight(blendUnderlayHslSw, lightSe);
        const underlayMinimapHslNe = adjustUnderlayLight(blendUnderlayHslSw, lightNe);
        const underlayMinimapHslNw = adjustUnderlayLight(blendUnderlayHslSw, lightNw);

        const overlayHslSw = (this.overlayHslSw = adjustOverlayLight(overlayHsl, lightSw));
        const overlayHslSe = (this.overlayHslSe = adjustOverlayLight(overlayHsl, lightSe));
        const overlayHslNe = (this.overlayHslNe = adjustOverlayLight(overlayHsl, lightNe));
        const overlayHslNw = (this.overlayHslNw = adjustOverlayLight(overlayHsl, lightNw));

        const overlayMinimapHslSw = (this.overlayMinimapHslSw = adjustOverlayLight(
            overlayMinimapHsl,
            lightSw,
        ));
        const overlayMinimapHslSe = (this.overlayMinimapHslSe = adjustOverlayLight(
            overlayMinimapHsl,
            lightSe,
        ));
        const overlayMinimapHslNe = (this.overlayMinimapHslNe = adjustOverlayLight(
            overlayMinimapHsl,
            lightNe,
        ));
        const overlayMinimapHslNw = (this.overlayMinimapHslNw = adjustOverlayLight(
            overlayMinimapHsl,
            lightNw,
        ));

        this.underlayRgb = underlayRgb;
        this.overlayRgb = overlayRgb;

        const vertexIndices = tileShapeVertexIndices[shape];
        const vertexCount = vertexIndices.length;
        this.vertexX = new Int32Array(vertexCount);
        this.vertexY = new Int32Array(vertexCount);
        this.vertexZ = new Int32Array(vertexCount);
        const underlayHsls = new Array<number>(vertexCount);
        const underlayMinimapHsls = new Array<number>(vertexCount);
        const overlayHsls = new Array<number>(vertexCount);
        const overlayMinimapHsls = new Array<number>(vertexCount);
        const tileX = x * TILE_SIZE;
        const tileY = y * TILE_SIZE;

        for (let i = 0; i < vertexCount; i++) {
            let vertexIndex = vertexIndices[i];
            if ((vertexIndex & 1) === 0 && vertexIndex <= 8) {
                vertexIndex = ((vertexIndex - rotation - rotation - 1) & 7) + 1;
            }

            if (vertexIndex > 8 && vertexIndex <= 12) {
                vertexIndex = ((vertexIndex - 9 - rotation) & 3) + 9;
            }

            if (vertexIndex > 12 && vertexIndex <= 16) {
                vertexIndex = ((vertexIndex - 13 - rotation) & 3) + 13;
            }

            let vertX = 0;
            let vertZ = 0;
            let vertY = 0;
            let vertUnderlayHsl = 0;
            let vertUnderlayMinimapHsl = 0;
            let vertOverlayHsl = 0;
            let vertOverlayMinimapHsl = 0;

            if (vertexIndex === 1) {
                vertX = tileX;
                vertZ = tileY;
                vertY = heightSw;
                vertUnderlayHsl = underlayHslSw;
                vertUnderlayMinimapHsl = underlayMinimapHslSw;
                vertOverlayHsl = overlayHslSw;
                vertOverlayMinimapHsl = overlayMinimapHslSw;
            } else if (vertexIndex === 2) {
                vertX = tileX + HALF_TILE_SIZE;
                vertZ = tileY;
                vertY = (heightSe + heightSw) >> 1;
                vertUnderlayHsl = mixHsl(underlayHslSe, underlayHslSw);
                vertUnderlayMinimapHsl = (underlayMinimapHslSe + underlayMinimapHslSw) >> 1;
                vertOverlayHsl = (overlayHslSe + overlayHslSw) >> 1;
                vertOverlayMinimapHsl = (overlayMinimapHslSe + overlayMinimapHslSw) >> 1;
            } else if (vertexIndex === 3) {
                vertX = tileX + TILE_SIZE;
                vertZ = tileY;
                vertY = heightSe;
                vertUnderlayHsl = underlayHslSe;
                vertUnderlayMinimapHsl = underlayMinimapHslSe;
                vertOverlayHsl = overlayHslSe;
                vertOverlayMinimapHsl = overlayMinimapHslSe;
            } else if (vertexIndex === 4) {
                vertX = tileX + TILE_SIZE;
                vertZ = tileY + HALF_TILE_SIZE;
                vertY = (heightNe + heightSe) >> 1;
                vertUnderlayHsl = mixHsl(underlayHslSe, underlayHslNe);
                vertUnderlayMinimapHsl = (underlayMinimapHslSe + underlayMinimapHslNe) >> 1;
                vertOverlayHsl = (overlayHslSe + overlayHslNe) >> 1;
                vertOverlayMinimapHsl = (overlayMinimapHslSe + overlayMinimapHslNe) >> 1;
            } else if (vertexIndex === 5) {
                vertX = tileX + TILE_SIZE;
                vertZ = tileY + TILE_SIZE;
                vertY = heightNe;
                vertUnderlayHsl = underlayHslNe;
                vertUnderlayMinimapHsl = underlayMinimapHslNe;
                vertOverlayHsl = overlayHslNe;
                vertOverlayMinimapHsl = overlayMinimapHslNe;
            } else if (vertexIndex === 6) {
                vertX = tileX + HALF_TILE_SIZE;
                vertZ = tileY + TILE_SIZE;
                vertY = (heightNe + heightNw) >> 1;
                vertUnderlayHsl = mixHsl(underlayHslNw, underlayHslNe);
                vertUnderlayMinimapHsl = (underlayMinimapHslNw + underlayMinimapHslNe) >> 1;
                vertOverlayHsl = (overlayHslNw + overlayHslNe) >> 1;
                vertOverlayMinimapHsl = (overlayMinimapHslNw + overlayMinimapHslNe) >> 1;
            } else if (vertexIndex === 7) {
                vertX = tileX;
                vertZ = tileY + TILE_SIZE;
                vertY = heightNw;
                vertUnderlayHsl = underlayHslNw;
                vertUnderlayMinimapHsl = underlayMinimapHslNw;
                vertOverlayHsl = overlayHslNw;
                vertOverlayMinimapHsl = overlayMinimapHslNw;
            } else if (vertexIndex === 8) {
                vertX = tileX;
                vertZ = tileY + HALF_TILE_SIZE;
                vertY = (heightNw + heightSw) >> 1;
                vertUnderlayHsl = mixHsl(underlayHslNw, underlayHslSw);
                vertUnderlayMinimapHsl = (underlayMinimapHslNw + underlayMinimapHslSw) >> 1;
                vertOverlayHsl = (overlayHslNw + overlayHslSw) >> 1;
                vertOverlayMinimapHsl = (overlayMinimapHslNw + overlayMinimapHslSw) >> 1;
            } else if (vertexIndex === 9) {
                vertX = tileX + HALF_TILE_SIZE;
                vertZ = tileY + QUARTER_TILE_SIZE;
                vertY = (heightSe + heightSw) >> 1;
                vertUnderlayHsl = mixHsl(underlayHslSe, underlayHslSw);
                vertUnderlayMinimapHsl = (underlayMinimapHslSe + underlayMinimapHslSw) >> 1;
                vertOverlayHsl = (overlayHslSe + overlayHslSw) >> 1;
                vertOverlayMinimapHsl = (overlayMinimapHslSe + overlayMinimapHslSw) >> 1;
            } else if (vertexIndex === 10) {
                vertX = tileX + THREE_QTR_TILE_SIZE;
                vertZ = tileY + HALF_TILE_SIZE;
                vertY = (heightNe + heightSe) >> 1;
                vertUnderlayHsl = mixHsl(underlayHslSe, underlayHslNe);
                vertUnderlayMinimapHsl = (underlayMinimapHslSe + underlayMinimapHslNe) >> 1;
                vertOverlayHsl = (overlayHslSe + overlayHslNe) >> 1;
                vertOverlayMinimapHsl = (overlayMinimapHslSe + overlayMinimapHslNe) >> 1;
            } else if (vertexIndex === 11) {
                vertX = tileX + HALF_TILE_SIZE;
                vertZ = tileY + THREE_QTR_TILE_SIZE;
                vertY = (heightNe + heightNw) >> 1;
                vertUnderlayHsl = mixHsl(underlayHslNw, underlayHslNe);
                vertUnderlayMinimapHsl = (underlayMinimapHslNw + underlayMinimapHslNe) >> 1;
                vertOverlayHsl = (overlayHslNw + overlayHslNe) >> 1;
                vertOverlayMinimapHsl = (overlayMinimapHslNw + overlayMinimapHslNe) >> 1;
            } else if (vertexIndex === 12) {
                vertX = tileX + QUARTER_TILE_SIZE;
                vertZ = tileY + HALF_TILE_SIZE;
                vertY = (heightNw + heightSw) >> 1;
                vertUnderlayHsl = mixHsl(underlayHslNw, underlayHslSw);
                vertUnderlayMinimapHsl = (underlayMinimapHslNw + underlayMinimapHslSw) >> 1;
                vertOverlayHsl = (overlayHslNw + overlayHslSw) >> 1;
                vertOverlayMinimapHsl = (overlayMinimapHslNw + overlayMinimapHslSw) >> 1;
            } else if (vertexIndex === 13) {
                vertX = tileX + QUARTER_TILE_SIZE;
                vertZ = tileY + QUARTER_TILE_SIZE;
                vertY = heightSw;
                vertUnderlayHsl = underlayHslSw;
                vertUnderlayMinimapHsl = underlayMinimapHslSw;
                vertOverlayHsl = overlayHslSw;
                vertOverlayMinimapHsl = overlayMinimapHslSw;
            } else if (vertexIndex === 14) {
                vertX = tileX + THREE_QTR_TILE_SIZE;
                vertZ = tileY + QUARTER_TILE_SIZE;
                vertY = heightSe;
                vertUnderlayHsl = underlayHslSe;
                vertUnderlayMinimapHsl = underlayMinimapHslSe;
                vertOverlayHsl = overlayHslSe;
                vertOverlayMinimapHsl = overlayMinimapHslSe;
            } else if (vertexIndex === 15) {
                vertX = tileX + THREE_QTR_TILE_SIZE;
                vertZ = tileY + THREE_QTR_TILE_SIZE;
                vertY = heightNe;
                vertUnderlayHsl = underlayHslNe;
                vertUnderlayMinimapHsl = underlayMinimapHslNe;
                vertOverlayHsl = overlayHslNe;
                vertOverlayMinimapHsl = overlayMinimapHslNe;
            } else {
                vertX = tileX + QUARTER_TILE_SIZE;
                vertZ = tileY + THREE_QTR_TILE_SIZE;
                vertY = heightNw;
                vertUnderlayHsl = underlayHslNw;
                vertUnderlayMinimapHsl = underlayMinimapHslNw;
                vertOverlayHsl = overlayHslNw;
                vertOverlayMinimapHsl = overlayMinimapHslNw;
            }

            this.vertexX[i] = vertX;
            this.vertexY[i] = vertY;
            this.vertexZ[i] = vertZ;
            underlayHsls[i] = vertUnderlayHsl;
            underlayMinimapHsls[i] = vertUnderlayMinimapHsl;
            overlayHsls[i] = vertOverlayHsl;
            overlayMinimapHsls[i] = vertOverlayMinimapHsl;
        }

        const tileFaces = tileShapeFaces[shape];
        const faceCount = tileFaces.length / 4;
        this.normalFaceCount = faceCount;

        this.facesA = new Int32Array(faceCount);
        this.facesB = new Int32Array(faceCount);
        this.facesC = new Int32Array(faceCount);

        this.faceColorsA = new Int32Array(faceCount);
        this.faceColorsB = new Int32Array(faceCount);
        this.faceColorsC = new Int32Array(faceCount);

        this.minimapFaceColorsA = new Int32Array(faceCount);
        this.minimapFaceColorsB = new Int32Array(faceCount);
        this.minimapFaceColorsC = new Int32Array(faceCount);

        if (textureId !== -1) {
            this.faceTextures = new Int32Array(faceCount);
        }

        let tileFaceIndex = 0;

        for (let i = 0; i < faceCount; i++) {
            const isOverlay = tileFaces[tileFaceIndex++] === 1;
            let a = tileFaces[tileFaceIndex++];
            let b = tileFaces[tileFaceIndex++];
            let c = tileFaces[tileFaceIndex++];

            if (a < 4) {
                a = (a - rotation) & 3;
            }

            if (b < 4) {
                b = (b - rotation) & 3;
            }

            if (c < 4) {
                c = (c - rotation) & 3;
            }

            this.facesA[i] = a;
            this.facesB[i] = b;
            this.facesC[i] = c;
            let faceTextureId = -1;
            let hslA = 0;
            let hslB = 0;
            let hslC = 0;
            let minimapHslA = 0;
            let minimapHslB = 0;
            let minimapHslC = 0;
            if (isOverlay) {
                hslA = overlayHsls[a];
                hslB = overlayHsls[b];
                hslC = overlayHsls[c];
                minimapHslA = overlayMinimapHsls[a];
                minimapHslB = overlayMinimapHsls[b];
                minimapHslC = overlayMinimapHsls[c];
                faceTextureId = textureId;
                if (this.faceTextures) {
                    this.faceTextures[i] = textureId;
                }
            } else {
                hslA = underlayHsls[a];
                hslB = underlayHsls[b];
                hslC = underlayHsls[c];
                minimapHslA = underlayMinimapHsls[a];
                minimapHslB = underlayMinimapHsls[b];
                minimapHslC = underlayMinimapHsls[c];
                if (this.faceTextures) {
                    this.faceTextures[i] = -1;
                }
            }

            this.faceColorsA[i] = hslA;
            this.faceColorsB[i] = hslB;
            this.faceColorsC[i] = hslC;

            this.minimapFaceColorsA[i] = minimapHslA;
            this.minimapFaceColorsB[i] = minimapHslB;
            this.minimapFaceColorsC[i] = minimapHslC;

            if (hslA === INVALID_HSL_COLOR && faceTextureId === -1) {
                continue;
            }

            const u0 = (this.vertexX[a] - tileX) / TILE_SIZE;
            const v0 = (this.vertexZ[a] - tileY) / TILE_SIZE;

            const u1 = (this.vertexX[b] - tileX) / TILE_SIZE;
            const v1 = (this.vertexZ[b] - tileY) / TILE_SIZE;

            const u2 = (this.vertexX[c] - tileX) / TILE_SIZE;
            const v2 = (this.vertexZ[c] - tileY) / TILE_SIZE;

            this.faces.push({
                vertices: [
                    {
                        x: this.vertexX[a],
                        y: this.vertexY[a],
                        z: this.vertexZ[a],
                        hsl: hslA,
                        u: u0,
                        v: v0,
                        textureId: faceTextureId,
                    },
                    {
                        x: this.vertexX[b],
                        y: this.vertexY[b],
                        z: this.vertexZ[b],
                        hsl: hslB,
                        u: u1,
                        v: v1,
                        textureId: faceTextureId,
                    },
                    {
                        x: this.vertexX[c],
                        y: this.vertexY[c],
                        z: this.vertexZ[c],
                        hsl: hslC,
                        u: u2,
                        v: v2,
                        textureId: faceTextureId,
                    },
                ],
            });
        }
    }
}
