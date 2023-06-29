import { vec2 } from "gl-matrix";
import { CollisionMap } from "../../client/pathfinder/collision/CollisionMap";
import {
    DrawCall,
    App as PicoApp,
    PicoGL,
    Program,
    Texture,
    UniformBuffer,
    VertexArray,
    VertexBuffer,
} from "picogl";
import { AnimatedObject } from "../object/AnimatedObject";
import { Npc } from "../npc/Npc";
import { NpcLoader } from "../../client/fs/loader/NpcLoader";
import { AnimationLoader } from "../../client/fs/loader/AnimationLoader";
import { Scene } from "../../client/scene/Scene";
import { ChunkData } from "./ChunkData";
import { DrawRange } from "./DrawRange";

const NPC_DATA_TEXTURE_BUFFER_SIZE = 5;

export type Chunk = {
    regionX: number;
    regionY: number;

    minimapBlob: Blob;

    sceneBorderRadius: number;
    tileRenderFlags: Uint8Array[][];
    collisionMaps: CollisionMap[];

    triangleCount: number;

    drawRanges: DrawRange[];
    drawRangesLowDetail: DrawRange[];

    drawRangesInteract: DrawRange[];
    drawRangesInteractLowDetail: DrawRange[];

    drawRangesAlpha: DrawRange[];
    drawRangesInteractAlpha: DrawRange[];

    drawRangesNpc: DrawRange[];

    drawCall: DrawCall;
    drawCallLowDetail: DrawCall;

    drawCallInteract: DrawCall;
    drawCallInteractLowDetail: DrawCall;

    drawCallAlpha: DrawCall;
    drawCallInteractAlpha: DrawCall;

    drawCallNpc: DrawCall | undefined;

    animatedObjects: AnimatedObject[];
    npcs: Npc[];

    interleavedBuffer: VertexBuffer;
    indexBuffer: VertexBuffer;
    vertexArray: VertexArray;

    modelDataTexture: Texture;
    modelDataTextureAlpha: Texture;

    modelDataTextureInteract: Texture;
    modelDataTextureInteractAlpha: Texture;

    npcDataTextureOffsets: number[];

    heightMapTexture: Texture;

    timeLoaded: number;
    frameLoaded: number;
};

function createModelDataTexture(app: PicoApp, data: Uint16Array): Texture {
    return app.createTexture2D(
        data,
        16,
        Math.max(Math.ceil(data.length / 16 / 4), 1),
        {
            internalFormat: PicoGL.RGBA16UI,
            minFilter: PicoGL.NEAREST,
            magFilter: PicoGL.NEAREST,
        }
    );
}

export function loadChunk(
    app: PicoApp,
    program: Program,
    programNpc: Program,
    npcLoader: NpcLoader,
    animationLoader: AnimationLoader,
    textureArray: Texture,
    textureUniformBuffer: UniformBuffer,
    sceneUniformBuffer: UniformBuffer,
    chunkData: ChunkData,
    frame: number,
    cycle: number
): Chunk {
    const regionX = chunkData.regionX;
    const regionY = chunkData.regionY;

    const regionPos = vec2.fromValues(regionX, regionY);

    const borderRadius = chunkData.sceneBorderRadius;

    const interleavedBuffer = app.createInterleavedBuffer(
        12,
        chunkData.vertices
    );

    const indexBuffer = app.createIndexBuffer(
        PicoGL.UNSIGNED_INT,
        chunkData.indices
    );

    const vertexArray = app
        .createVertexArray()
        // v0, v1, v2
        .vertexAttributeBuffer(0, interleavedBuffer, {
            type: PicoGL.INT,
            size: 3,
            stride: 12,
            integer: true as any,
        })
        .indexBuffer(indexBuffer);

    const modelDataTexture = createModelDataTexture(
        app,
        chunkData.modelTextureData
    );
    const modelDataTextureAlpha = createModelDataTexture(
        app,
        chunkData.modelTextureDataAlpha
    );

    const modelDataTextureInteract = createModelDataTexture(
        app,
        chunkData.modelTextureDataInteract
    );
    const modelDataTextureInteractAlpha = createModelDataTexture(
        app,
        chunkData.modelTextureDataInteractAlpha
    );

    const heightMapTexture = app.createTextureArray(
        chunkData.heightMapTextureData,
        Scene.MAP_SIZE + borderRadius * 2,
        Scene.MAP_SIZE + borderRadius * 2,
        Scene.MAX_PLANE,
        {
            internalFormat: PicoGL.R32F,
            minFilter: PicoGL.LINEAR,
            magFilter: PicoGL.LINEAR,
            type: PicoGL.FLOAT,
            wrapS: PicoGL.CLAMP_TO_EDGE,
            wrapT: PicoGL.CLAMP_TO_EDGE,
        }
    );

    const time = performance.now() * 0.001;

    const drawCall = app
        .createDrawCall(program, vertexArray)
        .uniformBlock("TextureUniforms", textureUniformBuffer)
        .uniformBlock("SceneUniforms", sceneUniformBuffer)
        .uniform("u_timeLoaded", time)
        .uniform("u_regionPos", regionPos)
        .uniform("u_drawIdOffset", 0)
        .texture("u_textures", textureArray)
        .texture("u_modelDataTexture", modelDataTexture)
        .texture("u_heightMap", heightMapTexture)
        .drawRanges(...chunkData.drawRanges);
    const drawCallLowDetail = app
        .createDrawCall(program, vertexArray)
        .uniformBlock("TextureUniforms", textureUniformBuffer)
        .uniformBlock("SceneUniforms", sceneUniformBuffer)
        .uniform("u_timeLoaded", time)
        .uniform("u_regionPos", regionPos)
        .uniform(
            "u_drawIdOffset",
            chunkData.drawRanges.length - chunkData.drawRangesLowDetail.length
        )
        .texture("u_textures", textureArray)
        .texture("u_modelDataTexture", modelDataTexture)
        .texture("u_heightMap", heightMapTexture)
        .drawRanges(...chunkData.drawRangesLowDetail);

    const drawCallInteract = app
        .createDrawCall(program, vertexArray)
        .uniformBlock("TextureUniforms", textureUniformBuffer)
        .uniformBlock("SceneUniforms", sceneUniformBuffer)
        .uniform("u_timeLoaded", time)
        .uniform("u_regionPos", regionPos)
        .uniform("u_drawIdOffset", 0)
        .texture("u_textures", textureArray)
        .texture("u_modelDataTexture", modelDataTextureInteract)
        .texture("u_heightMap", heightMapTexture)
        .drawRanges(...chunkData.drawRangesInteract);
    const drawCallInteractLowDetail = app
        .createDrawCall(program, vertexArray)
        .uniformBlock("TextureUniforms", textureUniformBuffer)
        .uniformBlock("SceneUniforms", sceneUniformBuffer)
        .uniform("u_timeLoaded", time)
        .uniform("u_regionPos", regionPos)
        .uniform(
            "u_drawIdOffset",
            chunkData.drawRangesInteract.length -
                chunkData.drawRangesInteractLowDetail.length
        )
        .texture("u_textures", textureArray)
        .texture("u_modelDataTexture", modelDataTextureInteract)
        .texture("u_heightMap", heightMapTexture)
        .drawRanges(...chunkData.drawRangesInteractLowDetail);

    const drawCallAlpha = app
        .createDrawCall(program, vertexArray)
        .uniformBlock("TextureUniforms", textureUniformBuffer)
        .uniformBlock("SceneUniforms", sceneUniformBuffer)
        .uniform("u_timeLoaded", time)
        .uniform("u_regionPos", regionPos)
        .uniform("u_drawIdOffset", 0)
        .texture("u_textures", textureArray)
        .texture("u_modelDataTexture", modelDataTextureAlpha)
        .texture("u_heightMap", heightMapTexture)
        .drawRanges(...chunkData.drawRangesAlpha);
    const drawCallInteractAlpha = app
        .createDrawCall(program, vertexArray)
        .uniformBlock("TextureUniforms", textureUniformBuffer)
        .uniformBlock("SceneUniforms", sceneUniformBuffer)
        .uniform("u_timeLoaded", time)
        .uniform("u_regionPos", regionPos)
        .uniform("u_drawIdOffset", 0)
        .texture("u_textures", textureArray)
        .texture("u_modelDataTexture", modelDataTextureInteractAlpha)
        .texture("u_heightMap", heightMapTexture)
        .drawRanges(...chunkData.drawRangesInteractAlpha);

    const animatedObjects: AnimatedObject[] = [];
    for (const object of chunkData.animatedObjects) {
        const animationDef = animationLoader.getDefinition(object.animationId);
        animatedObjects.push(
            new AnimatedObject(
                object.drawRangeIndex,
                object.drawRangeAlphaIndex,
                object.drawRangeInteractIndex,
                object.drawRangeInteractAlphaIndex,
                object.frames,
                object.framesAlpha,
                animationDef,
                cycle,
                object.randomStart
            )
        );
    }

    const npcs: Npc[] = [];
    for (const npcData of chunkData.npcs) {
        npcs.push(new Npc(npcData, npcLoader.getDefinition(npcData.id)));
    }

    let drawCallNpc: DrawCall | undefined = undefined;
    if (npcs.length > 0) {
        drawCallNpc = app
            .createDrawCall(programNpc, vertexArray)
            .uniformBlock("TextureUniforms", textureUniformBuffer)
            .uniformBlock("SceneUniforms", sceneUniformBuffer)
            .uniform("u_timeLoaded", time)
            .uniform("u_regionPos", regionPos)
            .uniform("u_npcDataOffset", 0)
            .texture("u_textures", textureArray)
            .texture("u_heightMap", heightMapTexture)
            .drawRanges(...chunkData.drawRangesNpc);
    }

    const collisionMaps = chunkData.collisionDatas.map(CollisionMap.fromData);

    for (const npc of npcs) {
        const collisionMap = collisionMaps[npc.data.plane];

        const currentX = npc.pathX[0];
        const currentY = npc.pathY[0];

        const size = npc.def.size;

        for (let flagX = currentX; flagX < currentX + size; flagX++) {
            for (let flagY = currentY; flagY < currentY + size; flagY++) {
                collisionMap.flag(
                    flagX + borderRadius,
                    flagY + borderRadius,
                    0x1000000
                );
            }
        }
    }

    return {
        regionX,
        regionY,

        minimapBlob: chunkData.minimapBlob,

        sceneBorderRadius: borderRadius,
        tileRenderFlags: chunkData.tileRenderFlags,
        collisionMaps,

        triangleCount: chunkData.indices.length / 3,

        drawRanges: chunkData.drawRanges,
        drawRangesLowDetail: chunkData.drawRangesLowDetail,

        drawRangesInteract: chunkData.drawRangesInteract,
        drawRangesInteractLowDetail: chunkData.drawRangesInteractLowDetail,

        drawRangesAlpha: chunkData.drawRangesAlpha,
        drawRangesInteractAlpha: chunkData.drawRangesInteractAlpha,

        drawRangesNpc: chunkData.drawRangesNpc,

        drawCall,
        drawCallLowDetail,

        drawCallInteract: drawCallInteract,
        drawCallInteractLowDetail: drawCallInteractLowDetail,

        drawCallAlpha,
        drawCallInteractAlpha: drawCallInteractAlpha,

        drawCallNpc,

        animatedObjects: animatedObjects,
        npcs,

        interleavedBuffer,
        indexBuffer,
        vertexArray,

        modelDataTexture,
        modelDataTextureAlpha,
        modelDataTextureInteract: modelDataTextureInteract,
        modelDataTextureInteractAlpha: modelDataTextureInteractAlpha,

        npcDataTextureOffsets: new Array(NPC_DATA_TEXTURE_BUFFER_SIZE),
        heightMapTexture,

        timeLoaded: time,
        frameLoaded: frame,
    };
}

export function getTileRenderFlag(
    chunk: Chunk,
    plane: number,
    tileX: number,
    tileY: number
) {
    return chunk.tileRenderFlags[plane][tileX + chunk.sceneBorderRadius][
        tileY + chunk.sceneBorderRadius
    ];
}

export function deleteChunk(chunk: Chunk) {
    chunk.interleavedBuffer.delete();
    chunk.indexBuffer.delete();
    chunk.vertexArray.delete();
    chunk.modelDataTexture.delete();
    chunk.modelDataTextureAlpha.delete();
    chunk.modelDataTextureInteract.delete();
    chunk.modelDataTextureInteractAlpha.delete();
    chunk.heightMapTexture.delete();
}
