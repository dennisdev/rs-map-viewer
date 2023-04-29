import { vec3 } from "gl-matrix";
import { TextureLoader } from "../../client/fs/loader/TextureLoader";
import { computeTextureCoords, Model } from "../../client/model/Model";
import { Scene } from "../../client/scene/Scene";
import { SceneTile } from "../../client/scene/SceneTile";
import { clamp } from "../../client/util/MathUtil";
import { NpcSpawn } from "../NpcSpawn";
import { VertexBuffer } from "./VertexBuffer";

export enum ContourGroundType {
    CENTER_TILE = 0,
    VERTEX = 1,
    NONE = 2,
}

export type DrawData = {
    sceneX: number;
    sceneY: number;
    plane: number;
    contourGround: ContourGroundType;
    priority: number;
};

export type DrawCommand = {
    offset: number;
    elements: number;
    datas: DrawData[];
};

export type NpcDrawData = {
    sceneX: number;
    sceneY: number;
    plane: number;
    size: number;
    rotation: number;
};

export type NpcDrawCommand = {
    offset: number;
    elements: number;
    spawns: NpcSpawn[];
};

export class RenderBuffer {
    vertexBuf: VertexBuffer;

    indices: number[] = [];

    drawCommands: DrawCommand[] = [];
    drawCommandsLowDetail: DrawCommand[] = [];

    drawCommandsAlpha: DrawCommand[] = [];

    constructor(initVertexCount: number) {
        this.vertexBuf = new VertexBuffer(initVertexCount);
    }

    vertexCount(): number {
        return this.vertexBuf.offset;
    }

    indexByteOffset(): number {
        return this.indices.length * 4;
    }
}

export function addTerrainTile(renderBuf: RenderBuffer, tile: SceneTile) {
    const tileModel = tile.tileModel;
    if (!tileModel) {
        return;
    }
    for (const face of tileModel.faces) {
        for (const vertex of face.vertices) {
            const index = renderBuf.vertexBuf.addVertex(
                vertex.x,
                0,
                vertex.z,
                vertex.hsl,
                0xff,
                vertex.u,
                vertex.v,
                vertex.textureId,
                0
            );

            renderBuf.indices.push(index);
        }
    }
}

export function addTerrain(
    renderBuf: RenderBuffer,
    region: Scene,
    maxPlane: number
): number {
    console.time("terrain");

    const terrainStartVertexCount = renderBuf.vertexCount();

    for (let plane = 0; plane < region.planes; plane++) {
        const indexByteOffset = renderBuf.indexByteOffset();
        for (let x = 0; x < region.sizeX; x++) {
            for (let y = 0; y < region.sizeY; y++) {
                const tile = region.tiles[plane][x][y];
                if (!tile || tile.minPlane > maxPlane) {
                    continue;
                }
                addTerrainTile(renderBuf, tile);
            }
        }

        const planeVertexCount =
            (renderBuf.indexByteOffset() - indexByteOffset) / 4;

        if (planeVertexCount > 0) {
            renderBuf.drawCommands.push({
                offset: indexByteOffset,
                elements: planeVertexCount,
                datas: [
                    {
                        sceneX: 0,
                        sceneY: 0,
                        plane,
                        contourGround: ContourGroundType.VERTEX,
                        priority: 0,
                    },
                ],
            });
        }
    }

    console.timeEnd("terrain");

    return renderBuf.vertexCount() - terrainStartVertexCount;
}

export type ModelFace = {
    index: number;
    alpha: number;
    priority: number;
    textureId: number;
};

export function getModelFaces(
    textureProvider: TextureLoader,
    model: Model
): ModelFace[] {
    const faces: ModelFace[] = [];

    const faceAlphas = model.faceAlphas;

    const priorities = model.faceRenderPriorities;

    // console.log('alphas', faceAlphas);

    for (let f = 0; f < model.faceCount; f++) {
        let hslC = model.faceColors3[f];

        if (hslC === -2) {
            continue;
        }

        let textureId = -1;
        if (model.faceTextures) {
            textureId = model.faceTextures[f];
        }

        let textureIndex = textureProvider.getTextureIndex(textureId);
        if (textureIndex === undefined) {
            textureIndex = -1;
        }

        let faceAlpha = 0xff;
        if (faceAlphas && textureId === -1) {
            faceAlpha = 0xff - (faceAlphas[f] & 0xff);
        }

        if (faceAlpha === 0 || faceAlpha === 0x1) {
            continue;
        }

        const priority = (priorities && priorities[f]) || 0;

        faces.push({
            index: f,
            alpha: faceAlpha,
            priority,
            textureId: textureIndex,
        });
    }

    // console.log('faces', faces);

    // sort on priority, has alpha, texture id, face index
    faces.sort(
        (a, b) =>
            a.priority - b.priority ||
            (a.alpha < 0xff ? 1 : 0) - (b.alpha < 0xff ? 1 : 0) ||
            a.textureId - b.textureId ||
            b.index - a.index
    );

    return faces;
}

export function addModel(
    renderBuf: RenderBuffer,
    model: Model,
    faces: ModelFace[],
    offset?: vec3,
    reuseVertices: boolean = true
) {
    const verticesX = model.verticesX;
    let verticesY = model.verticesY;
    const verticesZ = model.verticesZ;

    let sceneX = 0;
    let sceneY = 0;
    let sceneHeight = 0;
    if (offset) {
        sceneX = offset[0];
        sceneHeight = offset[1];
        sceneY = offset[2];
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

        // let rgbA = HSL_RGB_MAP[hslA];
        // let rgbB = HSL_RGB_MAP[hslB];
        // let rgbC = HSL_RGB_MAP[hslC];

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

        const index0 = renderBuf.vertexBuf.addVertex(
            vxa,
            vya,
            vza,
            hslA,
            faceAlpha,
            u0,
            v0,
            textureId,
            priority + 1,
            reuseVertices
        );
        const index1 = renderBuf.vertexBuf.addVertex(
            vxb,
            vyb,
            vzb,
            hslB,
            faceAlpha,
            u1,
            v1,
            textureId,
            priority + 1,
            reuseVertices
        );
        const index2 = renderBuf.vertexBuf.addVertex(
            vxc,
            vyc,
            vzc,
            hslC,
            faceAlpha,
            u2,
            v2,
            textureId,
            priority + 1,
            reuseVertices
        );

        renderBuf.indices.push(index0, index1, index2);
    }
}
