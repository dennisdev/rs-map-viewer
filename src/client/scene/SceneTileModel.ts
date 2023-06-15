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
    shape: number;
    rotation: number;

    faces: SceneTileFace[] = [];

    underlayRgb: number;
    overlayRgb: number;

    constructor(
        shape: number,
        rotation: number,
        textureId: number,
        x: number,
        y: number,
        heightSw: number,
        heightSe: number,
        heightNe: number,
        heightNw: number,
        underlayHslSw: number,
        underlayHslSe: number,
        underlayHslNe: number,
        underlayHslNw: number,
        overlayHslSw: number,
        overlayHslSe: number,
        overlayHslNe: number,
        overlayHslNw: number,
        underlayRgb: number,
        overlayRgb: number
    ) {
        this.shape = shape;
        this.rotation = rotation;

        this.underlayRgb = underlayRgb;
        this.overlayRgb = overlayRgb;

        const vertexIndices = tileShapeVertexIndices[shape];
        const vertexCount = vertexIndices.length;
        const vertexX: number[] = new Array(vertexCount);
        const vertexY: number[] = new Array(vertexCount);
        const vertexZ: number[] = new Array(vertexCount);
        const underlayHsls: number[] = new Array(vertexCount);
        const overlayHsls: number[] = new Array(vertexCount);
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
            let underlayHsl = 0;
            let overlayHsl = 0;

            if (vertexIndex === 1) {
                vertX = tileX;
                vertZ = tileY;
                vertY = heightSw;
                underlayHsl = underlayHslSw;
                overlayHsl = overlayHslSw;
            } else if (vertexIndex === 2) {
                vertX = tileX + HALF_TILE_SIZE;
                vertZ = tileY;
                vertY = (heightSe + heightSw) >> 1;
                underlayHsl = (underlayHslSe + underlayHslSw) >> 1;
                overlayHsl = (overlayHslSe + overlayHslSw) >> 1;
            } else if (vertexIndex === 3) {
                vertX = tileX + TILE_SIZE;
                vertZ = tileY;
                vertY = heightSe;
                underlayHsl = underlayHslSe;
                overlayHsl = overlayHslSe;
            } else if (vertexIndex === 4) {
                vertX = tileX + TILE_SIZE;
                vertZ = tileY + HALF_TILE_SIZE;
                vertY = (heightNe + heightSe) >> 1;
                underlayHsl = (underlayHslSe + underlayHslNe) >> 1;
                overlayHsl = (overlayHslSe + overlayHslNe) >> 1;
            } else if (vertexIndex === 5) {
                vertX = tileX + TILE_SIZE;
                vertZ = tileY + TILE_SIZE;
                vertY = heightNe;
                underlayHsl = underlayHslNe;
                overlayHsl = overlayHslNe;
            } else if (vertexIndex === 6) {
                vertX = tileX + HALF_TILE_SIZE;
                vertZ = tileY + TILE_SIZE;
                vertY = (heightNe + heightNw) >> 1;
                underlayHsl = (underlayHslNw + underlayHslNe) >> 1;
                overlayHsl = (overlayHslNw + overlayHslNe) >> 1;
            } else if (vertexIndex === 7) {
                vertX = tileX;
                vertZ = tileY + TILE_SIZE;
                vertY = heightNw;
                underlayHsl = underlayHslNw;
                overlayHsl = overlayHslNw;
            } else if (vertexIndex === 8) {
                vertX = tileX;
                vertZ = tileY + HALF_TILE_SIZE;
                vertY = (heightNw + heightSw) >> 1;
                underlayHsl = (underlayHslNw + underlayHslSw) >> 1;
                overlayHsl = (overlayHslNw + overlayHslSw) >> 1;
            } else if (vertexIndex === 9) {
                vertX = tileX + HALF_TILE_SIZE;
                vertZ = tileY + QUARTER_TILE_SIZE;
                vertY = (heightSe + heightSw) >> 1;
                underlayHsl = (underlayHslSe + underlayHslSw) >> 1;
                overlayHsl = (overlayHslSe + overlayHslSw) >> 1;
            } else if (vertexIndex === 10) {
                vertX = tileX + THREE_QTR_TILE_SIZE;
                vertZ = tileY + HALF_TILE_SIZE;
                vertY = (heightNe + heightSe) >> 1;
                underlayHsl = (underlayHslSe + underlayHslNe) >> 1;
                overlayHsl = (overlayHslSe + overlayHslNe) >> 1;
            } else if (vertexIndex === 11) {
                vertX = tileX + HALF_TILE_SIZE;
                vertZ = tileY + THREE_QTR_TILE_SIZE;
                vertY = (heightNe + heightNw) >> 1;
                underlayHsl = (underlayHslNw + underlayHslNe) >> 1;
                overlayHsl = (overlayHslNw + overlayHslNe) >> 1;
            } else if (vertexIndex === 12) {
                vertX = tileX + QUARTER_TILE_SIZE;
                vertZ = tileY + HALF_TILE_SIZE;
                vertY = (heightNw + heightSw) >> 1;
                underlayHsl = (underlayHslNw + underlayHslSw) >> 1;
                overlayHsl = (overlayHslNw + overlayHslSw) >> 1;
            } else if (vertexIndex === 13) {
                vertX = tileX + QUARTER_TILE_SIZE;
                vertZ = tileY + QUARTER_TILE_SIZE;
                vertY = heightSw;
                underlayHsl = underlayHslSw;
                overlayHsl = overlayHslSw;
            } else if (vertexIndex === 14) {
                vertX = tileX + THREE_QTR_TILE_SIZE;
                vertZ = tileY + QUARTER_TILE_SIZE;
                vertY = heightSe;
                underlayHsl = underlayHslSe;
                overlayHsl = overlayHslSe;
            } else if (vertexIndex === 15) {
                vertX = tileX + THREE_QTR_TILE_SIZE;
                vertZ = tileY + THREE_QTR_TILE_SIZE;
                vertY = heightNe;
                underlayHsl = underlayHslNe;
                overlayHsl = overlayHslNe;
            } else {
                vertX = tileX + QUARTER_TILE_SIZE;
                vertZ = tileY + THREE_QTR_TILE_SIZE;
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

            if (hslA === 12345678 && faceTextureId === -1) {
                continue;
            }

            const u0 = (vertexX[a] - tileX) / TILE_SIZE;
            const v0 = (vertexZ[a] - tileY) / TILE_SIZE;

            const u1 = (vertexX[b] - tileX) / TILE_SIZE;
            const v1 = (vertexZ[b] - tileY) / TILE_SIZE;

            const u2 = (vertexX[c] - tileX) / TILE_SIZE;
            const v2 = (vertexZ[c] - tileY) / TILE_SIZE;

            this.faces.push({
                vertices: [
                    {
                        x: vertexX[a],
                        y: vertexY[a],
                        z: vertexZ[a],
                        hsl: hslA,
                        u: u0,
                        v: v0,
                        textureId: faceTextureId,
                    },
                    {
                        x: vertexX[b],
                        y: vertexY[b],
                        z: vertexZ[b],
                        hsl: hslB,
                        u: u1,
                        v: v1,
                        textureId: faceTextureId,
                    },
                    {
                        x: vertexX[c],
                        y: vertexY[c],
                        z: vertexZ[c],
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
