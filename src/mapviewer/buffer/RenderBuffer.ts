import { vec3 } from "gl-matrix";
import { TextureLoader } from "../../client/fs/loader/TextureLoader";
import { computeTextureCoords, Model } from "../../client/model/Model";
import { Scene } from "../../client/scene/Scene";
import { SceneTile } from "../../client/scene/SceneTile";
import { clamp } from "../../client/util/MathUtil";
import { VertexBuffer } from "./VertexBuffer";
import { InteractType } from "../chunk/InteractType";
import { DrawRange } from "../chunk/DrawRange";

export enum ContourGroundType {
    CENTER_TILE = 0,
    VERTEX = 1,
    NONE = 2,
}

export type DrawData = {
    sceneX: number;
    sceneY: number;
    heightOffset: number;
    plane: number;
    contourGround: ContourGroundType;
    priority: number;
    interactType: InteractType;
    interactId: number;
};

export type DrawCommand = {
    offset: number;
    elements: number;
    datas: DrawData[];
};

export class RenderBuffer {
    vertexBuf: VertexBuffer;

    indices: number[] = [];

    drawCommands: DrawCommand[] = [];
    drawCommandsLowDetail: DrawCommand[] = [];

    drawCommandsInteract: DrawCommand[] = [];
    drawCommandsInteractLowDetail: DrawCommand[] = [];

    drawCommandsAlpha: DrawCommand[] = [];
    drawCommandsInteractAlpha: DrawCommand[] = [];

    constructor(initVertexCount: number) {
        this.vertexBuf = new VertexBuffer(initVertexCount);
    }

    vertexCount(): number {
        return this.vertexBuf.offset;
    }

    indexByteOffset(): number {
        return this.indices.length * 4;
    }

    addTerrainTile(
        textureLoader: TextureLoader,
        tile: SceneTile,
        offsetX: number,
        offsetY: number
    ): void {
        const tileModel = tile.tileModel;
        if (!tileModel) {
            return;
        }
        for (const face of tileModel.faces) {
            for (const vertex of face.vertices) {
                const textureIndex = textureLoader.getTextureIndex(
                    vertex.textureId
                );

                const index = this.vertexBuf.addVertex(
                    vertex.x + offsetX,
                    0,
                    vertex.z + offsetY,
                    vertex.hsl,
                    0xff,
                    vertex.u,
                    vertex.v,
                    textureIndex,
                    0
                );

                this.indices.push(index);
            }
        }
    }

    addTerrain(
        textureLoader: TextureLoader,
        region: Scene,
        maxPlane: number
    ): number {
        console.time("terrain");

        const startX = region.borderRadius;
        const startY = region.borderRadius;
        const endX = region.borderRadius + Scene.MAP_SIZE;
        const endY = region.borderRadius + Scene.MAP_SIZE;

        const sceneOffset = -region.borderRadius * 128;

        const terrainStartVertexCount = this.vertexCount();
        for (let plane = 0; plane < region.planes; plane++) {
            const indexByteOffset = this.indexByteOffset();
            for (let x = startX; x < endX; x++) {
                for (let y = startY; y < endY; y++) {
                    const tile = region.tiles[plane][x][y];
                    if (!tile || tile.minPlane > maxPlane) {
                        continue;
                    }
                    this.addTerrainTile(
                        textureLoader,
                        tile,
                        sceneOffset,
                        sceneOffset
                    );
                }
            }

            const planeVertexCount =
                (this.indexByteOffset() - indexByteOffset) / 4;

            if (planeVertexCount > 0) {
                const command: DrawCommand = {
                    offset: indexByteOffset,
                    elements: planeVertexCount,
                    datas: [
                        {
                            sceneX: 0,
                            sceneY: 0,
                            heightOffset: 0,
                            plane,
                            contourGround: ContourGroundType.VERTEX,
                            priority: 0,
                            interactType: InteractType.NONE,
                            interactId: 0xffff,
                        },
                    ],
                };

                this.drawCommands.push(command);
                this.drawCommandsInteract.push(command);
            }
        }

        console.timeEnd("terrain");

        return this.vertexCount() - terrainStartVertexCount;
    }

    addModel(
        model: Model,
        faces: ModelFace[],
        offset?: vec3,
        reuseVertices: boolean = true
    ): void {
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

            if (hslC === -1) {
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

            const index0 = this.vertexBuf.addVertex(
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
            const index1 = this.vertexBuf.addVertex(
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
            const index2 = this.vertexBuf.addVertex(
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

            this.indices.push(index0, index1, index2);
        }
    }
}

export type ModelFace = {
    index: number;
    alpha: number;
    priority: number;
    textureId: number;
};

export function isAlphaModelFace(
    textureLoader: TextureLoader,
    face: ModelFace
): boolean {
    const textureId = textureLoader.getTextureId(face.textureId);
    if (textureId !== -1) {
        return textureLoader.hasAlpha(textureId);
    }

    return face.alpha !== 0xff;
}

export function getModelFaces(
    textureProvider: TextureLoader,
    model: Model
): ModelFace[] {
    const faces: ModelFace[] = [];

    const faceAlphas = model.faceAlphas;

    const priorities = model.faceRenderPriorities;

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

    // sort on priority, has alpha, texture id, face index
    // faces.sort(
    //     (a, b) =>
    //         a.priority - b.priority ||
    //         (a.alpha < 0xff ? 1 : 0) - (b.alpha < 0xff ? 1 : 0) ||
    //         a.textureId - b.textureId ||
    //         b.index - a.index
    // );

    return faces;
}

export function addModelAnimFrame(
    textureLoader: TextureLoader,
    renderBuf: RenderBuffer,
    model: Model,
    alphaOnly: boolean | undefined = undefined
): DrawRange {
    let faces = getModelFaces(textureLoader, model);

    if (alphaOnly !== undefined) {
        faces = faces.filter(
            (face) =>
                (face.alpha !== 0xff ||
                    textureLoader.hasAlpha(face.textureId)) === alphaOnly
        );
    }

    const indexByteOffset = renderBuf.indexByteOffset();
    if (faces.length > 0) {
        renderBuf.addModel(model, faces);
    }
    const modelVertexCount =
        (renderBuf.indexByteOffset() - indexByteOffset) / 4;

    return [indexByteOffset, modelVertexCount, 1];
}

export function createModelTextureData(
    drawCommands: DrawCommand[]
): Uint16Array {
    const datas: DrawData[] = [];
    for (const cmd of drawCommands) {
        datas.push(...cmd.datas);
    }
    const dataCount = datas.length;

    const dataLength =
        Math.ceil((drawCommands.length * 4 + dataCount) / 16) * 16;
    const textureData = new Uint16Array(Math.max(dataLength, 16) * 4);
    let dataOffset = 0;
    drawCommands.forEach((cmd, index) => {
        textureData[index * 4] = drawCommands.length + dataOffset;

        dataOffset += cmd.datas.length;
    });

    datas.forEach((data, index) => {
        let offset = drawCommands.length * 4 + index * 4;

        const contourGround = data.contourGround;

        const height = data.heightOffset;

        textureData[offset++] = data.sceneX | (data.plane << 14);
        textureData[offset++] = data.sceneY | (contourGround << 14);
        textureData[offset++] =
            (data.priority & 0xf) |
            (data.interactType << 4) |
            (Math.round(height / 8) << 6);
        textureData[offset++] = data.interactId;
    });

    return textureData;
}
