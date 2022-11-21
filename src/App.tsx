import { useState, useEffect } from 'react';
import './App.css';
import WebGLCanvas from './Canvas';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { PicoGL, App as PicoApp, Timer, Program, UniformBuffer, VertexArray, Texture, DrawCall } from 'picogl';
import { MemoryFileSystem, fetchMemoryStore, loadFromStore } from './client/fs/FileSystem';
import { IndexType } from './client/fs/IndexType';
import { Scene } from './client/Scene';
import { TextureLoader } from './client/fs/loader/TextureLoader';
import { spawn, Pool, Worker, Transfer, TransferDescriptor, ModuleThread } from "threads";
import { RegionLoader } from './client/RegionLoader';
import { ChunkData, ChunkDataLoader } from './ChunkDataLoader';
import { MemoryStore } from './client/fs/MemoryStore';
import { Skeleton } from './client/model/Skeleton';
import { ConfigType } from './client/fs/ConfigType';
import { CachedUnderlayLoader } from './client/fs/loader/UnderlayLoader';
import { CachedOverlayLoader } from './client/fs/loader/OverlayLoader';
import { CachedObjectLoader } from './client/fs/loader/ObjectLoader';
import { CachedModelLoader } from './client/fs/loader/ModelLoader';
import Denque from 'denque';

const DEFAULT_ZOOM: number = 25.0 / 256.0;

const TAU = Math.PI * 2;
const RS_TO_RADIANS = TAU / 2048.0;

const TILE_SIZE = 128;
const HALF_TILE_SIZE = TILE_SIZE / 2;
const QUARTER_TILE_SIZE = TILE_SIZE / 4;
const THREE_QTR_TILE_SIZE = TILE_SIZE * 3 / 4;

const SCALE = TILE_SIZE;

const vertexShader = `
#version 300 es
//#extension GL_ANGLE_multi_draw : require

precision highp float;
precision highp int;

layout(std140, column_major) uniform;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec4 a_color;
layout(location = 2) in vec2 a_texCoord;
layout(location = 3) in uint a_texId;
layout(location = 4) in mat4 a_modelMatrix;
layout(location = 8) in float a_timeLoaded;

uniform SceneUniforms {
    mat4 u_viewProjMatrix;
};

uniform mat4 u_modelMatrix;
uniform float u_currentTime;

out vec4 v_color;
out vec2 v_texCoord;
flat out int v_texId;
flat out float v_loadAlpha;

void main() {
    v_color = a_color;
    v_texCoord = a_texCoord;
    v_texId = int(a_texId);
    v_loadAlpha = min(u_currentTime - a_timeLoaded, 1.0);
    gl_Position = u_viewProjMatrix * a_modelMatrix * vec4(a_position, 1.0);
}
`.trim();

const fragmentShader = `
#version 300 es
//#extension GL_ANGLE_multi_draw : require

precision highp float;

layout(std140, column_major) uniform;

in vec4 v_color;
in vec2 v_texCoord;
flat in int v_texId;
flat in float v_loadAlpha;

uniform highp sampler2DArray u_textures;

out vec4 fragColor;

void main() {
    fragColor = v_color * vec4(v_loadAlpha);
    //fragColor = texture(u_textures, vec3(v_texCoord, 1));
    if (v_texId > 0) {
        vec4 res = texture(u_textures, vec3(v_texCoord, v_texId - 1));
        fragColor = vec4(res.bgr, res.a) * v_color * vec4(v_loadAlpha);;
        //fragColor = vec4(fragColor.rgb, 1.0);
        //fragColor = v_color;
    }
}
`.trim();

const glslHslToRgbFunction = `
vec3 hslToRgb(int hsl, float brightness) {
    int var5 = hsl / 128;
    float var6 = float(var5 >> 3) / 64.0f + 0.0078125f;
    float var8 = float(var5 & 7) / 8.0f + 0.0625f;  
    int var10 = hsl % 128;  
    float var11 = float(var10) / 128.0f;
    float var13 = var11;
    float var15 = var11;
    float var17 = var11;    
    if (var8 != 0.0f) {
        float var19;
        if (var11 < 0.5f) {
            var19 = var11 * (1.0f + var8);
        } else {
            var19 = var11 + var8 - var11 * var8;
        } 
        float var21 = 2.0f * var11 - var19;
        float var23 = var6 + 0.3333333333333333f;
        if (var23 > 1.0f) {
            var23 -= 1.f;
        } 
        float var27 = var6 - 0.3333333333333333f;
        if (var27 < 0.0f) {
            var27 += 1.f;
        } 
        if (6.0f * var23 < 1.0f) {
            var13 = var21 + (var19 - var21) * 6.0f * var23;
        } else if (2.0f * var23 < 1.0f) {
            var13 = var19;
        } else if (3.0f * var23 < 2.0f) {
            var13 = var21 + (var19 - var21) * (0.6666666666666666f - var23) * 6.0f;
        } else {
            var13 = var21;
        } 
        if (6.0f * var6 < 1.0f) {
            var15 = var21 + (var19 - var21) * 6.0f * var6;
        } else if (2.0f * var6 < 1.0f) {
            var15 = var19;
        } else if (3.0f * var6 < 2.0f) {
            var15 = var21 + (var19 - var21) * (0.6666666666666666f - var6) * 6.0f;
        } else {
            var15 = var21;
        } 
        if (6.0f * var27 < 1.0f) {
            var17 = var21 + (var19 - var21) * 6.0f * var27;
        } else if (2.0f * var27 < 1.0f) {
            var17 = var19;
        } else if (3.0f * var27 < 2.0f) {
            var17 = var21 + (var19 - var21) * (0.6666666666666666f - var27) * 6.0f;
        } else {
            var17 = var21;
        }
    }   
    vec3 rgb = vec3(
        pow(var13, brightness),
        pow(var15, brightness),
        pow(var17, brightness)
    );  
    return rgb;
}
`.trim();

const glslLogicFunctions = `
float when_eq(float x, float y) {
    return 1.0 - abs(sign(x - y));
}

float when_neq(float x, float y) {
  return abs(sign(x - y));
}
`.trim();

const vertexShader2 = `
#version 300 es
#extension GL_ANGLE_multi_draw : require

#define TEXTURE_ANIM_UNIT (1.0f / 128.0f)

precision highp float;

layout(std140, column_major) uniform;

layout(location = 0) in ivec3 a_position;
layout(location = 1) in vec4 a_color;
layout(location = 2) in ivec2 a_texCoord;
layout(location = 3) in uint a_texId;
layout(location = 4) in uint a_priority;

uniform TextureUniforms {
    vec2 textureAnimations[128];
};

uniform SceneUniforms {
    mat4 u_viewProjMatrix;
};

uniform mat4 u_modelMatrix;
uniform float u_currentTime;
uniform float u_timeLoaded;
uniform float u_deltaTime;

uniform highp usampler2D u_perModelPosTexture;
uniform mediump sampler2DArray u_heightMap;

out vec4 v_color;
out vec2 v_texCoord;
flat out int v_texId;
flat out float v_loadAlpha;

${glslHslToRgbFunction}

${glslLogicFunctions}

float getHeightInterp(vec2 pos, uint plane) {
    vec2 uv = (pos + vec2(0.5)) / vec2(72.0);

    float height = texture(u_heightMap, vec3(uv, plane)).r;

    return height * 8.0;
}

float unpackFloat16(int v) {
    int exponent = v >> 10;
    float mantissa = float(v & 0x3FF) / 1024.0;
    return float(exponent) + mantissa;
}

ivec2 getDataTexCoordFromIndex(int index) {
    int x = index % 16;
    int y = index / 16;
    return ivec2(x, y);
}

void main() {
    uvec2 offsetVec = texelFetch(u_perModelPosTexture, getDataTexCoordFromIndex(gl_DrawID), 0).gr;
    int offset = int(offsetVec.x) << 8 | int(offsetVec.y);

    int hsl = int(a_color.r) << 8 | int(a_color.g);

    // v_color = a_color / vec4(255);
    v_color = vec4(hslToRgb(hsl, 0.9), a_color.a / 255.0) * when_eq(float(a_texId), 0.0) + vec4(vec3(a_color.r / 255.0), a_color.a / 255.0)  * when_neq(float(a_texId), 0.0);

    v_texCoord = vec2(unpackFloat16(a_texCoord.x), unpackFloat16(a_texCoord.y)) + (u_currentTime / 0.02) * textureAnimations[a_texId] * TEXTURE_ANIM_UNIT;
    v_texId = int(a_texId);
    v_loadAlpha = smoothstep(0.0, 1.0, min((u_currentTime - u_timeLoaded), 1.0));

    uvec4 modelData = texelFetch(u_perModelPosTexture, getDataTexCoordFromIndex(offset + gl_InstanceID), 0);

    uint plane = modelData.r >> uint(6);
    float contourGround = float(int(modelData.r) >> 4 & 0x3);
    uint priority = (modelData.r & uint(0xF));

    uint tilePosPacked = (modelData.a << uint(16)) | modelData.b << uint(8) | modelData.g;
    
    vec2 tilePos = vec2(float(tilePosPacked >> uint(12)), float(tilePosPacked & uint(0xFFF))) / vec2(32);

    vec3 localPos = vec3(a_position) / vec3(128.0) + vec3(tilePos.x, 0, tilePos.y);

    vec2 interpPos = tilePos * vec2(when_eq(contourGround, 0.0)) + localPos.xz * vec2(when_eq(contourGround, 1.0));
    localPos.y -= getHeightInterp(interpPos, plane) * when_neq(contourGround, 2.0) / 128.0;
    
    gl_Position = u_viewProjMatrix * u_modelMatrix * vec4(localPos, 1.0);
    gl_Position.z -= float(plane) * 0.0005 + float(priority) * 0.0003 + float(a_priority) * 0.0001;    
}
`.trim();

const fragmentShader2 = `
#version 300 es

#define COLOR_BANDING 112.0

precision mediump float;

layout(std140, column_major) uniform;

in vec4 v_color;
in vec2 v_texCoord;
flat in int v_texId;
flat in float v_loadAlpha;

uniform highp sampler2DArray u_textures;

out vec4 fragColor;

void main() {
    vec3 color = round(v_color.rgb * COLOR_BANDING) / COLOR_BANDING;
    fragColor = texture(u_textures, vec3(v_texCoord, v_texId)).bgra * vec4(color, v_color.a) * vec4(v_loadAlpha);
    if (fragColor.a < 0.01) {
        discard;
    }
}
`.trim();

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

function getSpiralDeltas(radius: number): vec2[] {
    let x = 0;
    let y = 0;
    let delta = [0, -1];

    const deltas: vec2[] = [];

    for (let i = Math.pow(Math.max(radius, radius), 2); i > 0; i--) {
        if ((-radius / 2 < x && x <= radius / 2)
            && (-radius / 2 < y && y <= radius / 2)) {
            deltas.push([x, y]);
        }

        if (x === y
            || (x < 0 && x === -y)
            || (x > 0 && x === 1 - y)) {
            // change direction
            delta = [-delta[1], delta[0]]
        }

        x += delta[0];
        y += delta[1];
    }

    return deltas;
}

const TEXTURE_SIZE = 128;
const TEXTURE_PIXEL_COUNT = TEXTURE_SIZE * TEXTURE_SIZE;

type Terrain = {
    regionX: number,
    regionY: number,
    modelMatrix: mat4,
    vertexArray: VertexArray,
    triangleCount: number,
    drawRanges: number[][],
    drawRangesLowDetail: number[][],
    timeLoaded: number,
    frameLoaded: number,
    perModelPosTexture: Texture,
    heightMapTexture: Texture,
    drawCall: DrawCall,
    drawCallLowDetail: DrawCall,
}

function loadTerrain(app: PicoApp, program: Program, textureArray: Texture, textureUniformBuffer: UniformBuffer, sceneUniformBuffer: UniformBuffer,
    chunkData: ChunkData, frame: number): Terrain {
    const regionX = chunkData.regionX;
    const regionY = chunkData.regionY;

    const baseX = regionX * 64;
    const baseY = regionY * 64;

    const baseModelMatrix = mat4.create();
    mat4.translate(baseModelMatrix, baseModelMatrix, [baseX, 0, baseY]);

    const interleavedBuffer = app.createInterleavedBuffer(16, chunkData.vertices);

    const indexBuffer = app.createIndexBuffer(PicoGL.UNSIGNED_INT, chunkData.indices);

    const vertexArray = app.createVertexArray()
        // position
        .vertexAttributeBuffer(0, interleavedBuffer, {
            type: PicoGL.SHORT,
            size: 3,
            stride: 16,
            integer: true as any
        })
        // color
        .vertexAttributeBuffer(1, interleavedBuffer, {
            type: PicoGL.UNSIGNED_BYTE,
            size: 4,
            offset: 6,
            stride: 16,
            // normalized: true
        })
        // tex coords
        .vertexAttributeBuffer(2, interleavedBuffer, {
            type: PicoGL.SHORT,
            size: 2,
            offset: 10,
            stride: 16,
            integer: true as any
        })
        // texture ids
        .vertexAttributeBuffer(3, interleavedBuffer, {
            type: PicoGL.UNSIGNED_BYTE,
            size: 1,
            offset: 14,
            stride: 16,
            integer: true as any
        })
        // priorities
        .vertexAttributeBuffer(4, interleavedBuffer, {
            type: PicoGL.UNSIGNED_BYTE,
            size: 1,
            offset: 15,
            stride: 16,
            integer: true as any
        })
        .indexBuffer(indexBuffer);

    const perModelPosTexture = app.createTexture2D(new Uint8Array(chunkData.perModelTextureData.buffer), 16, chunkData.perModelTextureData.length / 16,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    const heightMapTexture = app.createTextureArray(chunkData.heightMapTextureData, 72, 72, Scene.MAX_PLANE,
        {
            internalFormat: PicoGL.R32F, minFilter: PicoGL.LINEAR, magFilter: PicoGL.LINEAR, type: PicoGL.FLOAT,
            wrapS: PicoGL.CLAMP_TO_EDGE, wrapT: PicoGL.CLAMP_TO_EDGE
        }
    );

    const time = performance.now() * 0.001;

    let drawCall = app.createDrawCall(program, vertexArray)
        .uniformBlock('TextureUniforms', textureUniformBuffer)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time)
        .uniform('u_modelMatrix', baseModelMatrix)
        .texture('u_textures', textureArray)
        .texture('u_perModelPosTexture', perModelPosTexture)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRanges);

    let drawCallLowDetail = app.createDrawCall(program, vertexArray)
        .uniformBlock('TextureUniforms', textureUniformBuffer)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time)
        .uniform('u_modelMatrix', baseModelMatrix)
        .texture('u_textures', textureArray)
        .texture('u_perModelPosTexture', perModelPosTexture)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRangesLowDetail);

    return {
        regionX,
        regionY,
        modelMatrix: baseModelMatrix,
        vertexArray: vertexArray,
        triangleCount: chunkData.indices.length / 3,
        drawRanges: chunkData.drawRanges,
        drawRangesLowDetail: chunkData.drawRangesLowDetail,
        timeLoaded: time,
        frameLoaded: frame,
        perModelPosTexture,
        heightMapTexture,
        drawCall,
        drawCallLowDetail
    };
}

function getMousePos(container: HTMLElement, event: MouseEvent | Touch): vec2 {
    var rect = container.getBoundingClientRect();
    return [
        event.clientX - rect.left,
        event.clientY - rect.top
    ];
}

function getRegionDistance(x: number, y: number, region: vec2): number {
    const dx = Math.max(Math.abs(x - (region[0] * 64 + 32)) - 32, 0);
    const dy = Math.max(Math.abs(y - (region[1] * 64 + 32)) - 32, 0);
    return Math.sqrt(dx * dx + dy * dy);
}

class Test {
    fileSystem: MemoryFileSystem;

    chunkLoaderWorker: Pool<ModuleThread<ChunkLoaderWorker>>;

    // modelIndex: IndexSync<StoreSync>;

    // regionLoader: RegionLoader;

    textureProvider: TextureLoader;

    // chunkDataLoader: ChunkDataLoader;

    app!: PicoApp;

    keys: Map<string, boolean> = new Map();

    timer!: Timer;

    program?: Program;

    textureUniformBuffer!: UniformBuffer;
    sceneUniformBuffer!: UniformBuffer;

    textureArray!: Texture;

    terrains: Map<number, Terrain> = new Map();

    pitch: number = 244;
    yaw: number = 749;

    cameraPos: vec3 = vec3.fromValues(-60.5 - 3200, 10, -60.5 - 3200);
    // cameraPos: vec3 = vec3.fromValues(-3200, 10, -3200);
    // cameraPos: vec3 = vec3.fromValues(-2270, 10, -5342);

    projectionMatrix: mat4 = mat4.create();
    viewMatrix: mat4 = mat4.create();
    viewProjMatrix: mat4 = mat4.create();

    loadingRegionIds: Set<number> = new Set();
    invalidRegionIds: Set<number> = new Set();

    chunksToLoad: Denque<ChunkData> = new Denque();

    frameCount: number = 0;

    fps: number = 0;

    lastFrameTime: number = 0;

    fpsListener?: (fps: number) => void;

    viewDistanceRegionIds: Set<number>[] = [new Set(), new Set()];

    currentMouseX: number = 0;
    currentMouseY: number = 0;

    startMouseX: number = -1;
    startMouseY: number = -1;

    startPitch: number = -1;
    startYaw: number = -1;

    chunkDataLoader: ChunkDataLoader;

    lastCameraX: number = -1;
    lastCameraY: number = -1;

    lastCameraRegionX: number = -1;
    lastCameraRegionY: number = -1;

    regionPositions: vec2[] = [];

    isVisiblePos: vec3 = [0, 0, 0];
    moveCameraRotOrigin: vec3 = [0, 0, 0];

    constructor(fileSystem: MemoryFileSystem, xteasMap: Map<number, number[]>, chunkLoaderWorker: Pool<ModuleThread<ChunkLoaderWorker>>) {
        this.fileSystem = fileSystem;
        this.chunkLoaderWorker = chunkLoaderWorker;

        const configIndex = this.fileSystem.getIndex(IndexType.CONFIGS);
        const mapIndex = this.fileSystem.getIndex(IndexType.MAPS);
        const spriteIndex = this.fileSystem.getIndex(IndexType.SPRITES);
        const textureIndex = this.fileSystem.getIndex(IndexType.TEXTURES);
        const modelIndex = this.fileSystem.getIndex(IndexType.MODELS);

        const underlayArchive = configIndex.getArchive(ConfigType.UNDERLAY);
        const overlayArchive = configIndex.getArchive(ConfigType.OVERLAY);
        const objectArchive = configIndex.getArchive(ConfigType.OBJECT);

        // console.time('region loader');
        const underlayLoader = new CachedUnderlayLoader(underlayArchive);
        const overlayLoader = new CachedOverlayLoader(overlayArchive);
        const objectLoader = new CachedObjectLoader(objectArchive);
        const modelLoader = new CachedModelLoader(modelIndex);

        const regionLoader = new RegionLoader(mapIndex, underlayLoader, overlayLoader, objectLoader, xteasMap);
        // console.timeEnd('region loader');

        // console.log(regionLoader.getTerrainArchiveId(50, 50));

        console.time('check invalid regions');
        for (let x = 0; x < 100; x++) {
            for (let y = 0; y < 200; y++) {
                if (regionLoader.getTerrainArchiveId(x, y) === -1) {
                    this.invalidRegionIds.add(RegionLoader.getRegionId(x, y));
                }
            }
        }
        console.timeEnd('check invalid regions');

        console.time('load textures');
        this.textureProvider = TextureLoader.load(textureIndex, spriteIndex);
        console.timeEnd('load textures');

        // console.log('texture count: ', this.textureProvider.definitions.size);

        this.chunkDataLoader = new ChunkDataLoader(regionLoader, modelLoader, this.textureProvider);

        this.init = this.init.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onFocusOut = this.onFocusOut.bind(this);
        this.render = this.render.bind(this);
    }

    init(gl: WebGL2RenderingContext) {
        gl.canvas.addEventListener('keydown', this.onKeyDown);
        gl.canvas.addEventListener('keyup', this.onKeyUp);
        gl.canvas.addEventListener('mousemove', this.onMouseMove);
        gl.canvas.addEventListener('mousedown', this.onMouseDown);
        gl.canvas.addEventListener('mouseup', this.onMouseUp);
        gl.canvas.addEventListener('mouseleave', this.onMouseLeave);
        gl.canvas.addEventListener('touchstart', this.onTouchStart);
        gl.canvas.addEventListener('touchmove', this.onTouchMove);
        gl.canvas.addEventListener('touchend', this.onTouchEnd);
        gl.canvas.addEventListener('focusout', this.onFocusOut);
        gl.canvas.focus();

        const app = this.app = PicoGL.createApp(gl as any);

        // hack to get the right multi draw extension for picogl
        if (!PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED) {
            const state: any = app.state;
            const ext = gl.getExtension('WEBGL_multi_draw');
            PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED = ext;
            state.extensions.multiDrawInstanced = ext;
        }

        console.log(PicoGL.WEBGL_INFO);

        console.log(gl.getParameter(gl.MAX_SAMPLES));

        app.enable(gl.CULL_FACE);
        app.enable(gl.DEPTH_TEST);
        app.depthFunc(gl.LEQUAL);
        app.enable(gl.BLEND);
        app.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        app.clearColor(0, 0, 0, 1);

        // console.log(gl.getParameter(gl.DEPTH_FUNC), gl.NEVER, gl.GREATER, gl.LESS);

        this.timer = app.createTimer();

        app.createPrograms([vertexShader2, fragmentShader2]).then(([program]) => {
            this.program = program;
        });

        this.textureUniformBuffer = app.createUniformBuffer(new Array(128 * 2).fill(PicoGL.FLOAT_VEC2));
        this.sceneUniformBuffer = app.createUniformBuffer([PicoGL.FLOAT_MAT4]);

        console.time('load texture array');
        const textureArrayImage = this.textureProvider.createTextureArrayImage(0.9, TEXTURE_SIZE, true);
        console.timeEnd('load texture array');

        this.textureArray = app.createTextureArray(new Uint8Array(textureArrayImage.buffer), TEXTURE_SIZE, TEXTURE_SIZE, this.textureProvider.getTextureCount(),
            {
                minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST,
                wrapS: PicoGL.CLAMP_TO_EDGE, maxAnisotropy: PicoGL.WEBGL_INFO.MAX_TEXTURE_ANISOTROPY
            });

        const textureAnimDirectionUvs = [
            vec2.fromValues(0.0, 0.0),
            vec2.fromValues(0.0, -1.0),
            vec2.fromValues(-1.0, 0.0),
            vec2.fromValues(0.0, 1.0),
            vec2.fromValues(1.0, 0.0)
        ];
        const textures = this.textureProvider.getDefinitions();
        for (let i = 0; i < textures.length; i++) {
            const texture = textures[i];

            const uv = vec2.mul(vec2.create(), textureAnimDirectionUvs[texture.animationDirection], [texture.animationSpeed, texture.animationSpeed]);

            this.textureUniformBuffer.set((i + 1) * 2, uv as Float32Array);
        }

        this.textureUniformBuffer.update();

        console.timeEnd('first load');

        console.log(gl.getSupportedExtensions());
    }

    onKeyDown(event: KeyboardEvent) {
        console.log('down', event.key, event.shiftKey);
        this.keys.set(event.key, true);
        if (event.shiftKey) {
            this.keys.set('Shift', true);
        }
        event.preventDefault();
    }

    onKeyUp(event: KeyboardEvent) {
        console.log('up', event.key, event.shiftKey);
        this.keys.set(event.key, false);
        this.keys.set(event.key.toUpperCase(), false);
        this.keys.set(event.key.toLowerCase(), false);
        // if (event.shiftKey) {
        //     this.keys.set('Shift', false);
        // }
        event.preventDefault();
    }

    onMouseMove(event: MouseEvent) {
        const [x, y] = getMousePos(this.app.canvas, event);
        this.currentMouseX = x;
        this.currentMouseY = y;
    }

    onMouseDown(event: MouseEvent) {
        if (event.button !== 0) {
            return;
        }
        const [x, y] = getMousePos(this.app.canvas, event);
        this.startMouseX = x;
        this.startMouseY = y;
        this.currentMouseX = x;
        this.currentMouseY = y;
        this.startPitch = this.pitch;
        this.startYaw = this.yaw;
    }

    onTouchStart(event: TouchEvent) {
        const [x, y] = getMousePos(this.app.canvas, event.touches[0]);
        this.startMouseX = x;
        this.startMouseY = y;
        this.currentMouseX = x;
        this.currentMouseY = y;
        this.startPitch = this.pitch;
        this.startYaw = this.yaw;
    }

    onTouchMove(event: TouchEvent) {
        const [x, y] = getMousePos(this.app.canvas, event.touches[0]);
        this.currentMouseX = x;
        this.currentMouseY = y;
        // console.log(this.currentMouseX, this.currentMouseY);
    }

    onTouchEnd(event: TouchEvent) {
        this.resetMouseEvents();
    }

    onMouseUp(event: MouseEvent) {
        this.resetMouseEvents();
    }

    onMouseLeave(event: MouseEvent) {
        this.resetMouseEvents();
    }

    onFocusOut(event: FocusEvent) {
        this.resetKeyEvents();
        this.resetMouseEvents();
    }

    resetKeyEvents() {
        this.keys.clear();
    }

    resetMouseEvents() {
        this.startMouseX = -1;
        this.startMouseY = -1;
    }

    private setProjection(offsetX: number, offsetY: number, width: number, height: number, centerX: number, centerY: number, zoom: number): mat4 {
        const left = (offsetX - centerX << 9) / zoom;
        const right = (offsetX + width - centerX << 9) / zoom;
        const top = (offsetY - centerY << 9) / zoom;
        const bottom = (offsetY + height - centerY << 9) / zoom;

        mat4.identity(this.projectionMatrix);
        mat4.frustum(this.projectionMatrix, left * DEFAULT_ZOOM, right * DEFAULT_ZOOM,
            -bottom * DEFAULT_ZOOM, -top * DEFAULT_ZOOM, 0, 500);
        mat4.rotateX(this.projectionMatrix, this.projectionMatrix, Math.PI);
        return this.projectionMatrix;
    }

    isPositionVisible(pos: vec3): boolean {
        vec3.transformMat4(pos, pos, this.viewProjMatrix);
        return pos[0] >= -1.0 && pos[0] <= 1.0
            && pos[1] >= -1.0 && pos[1] <= 1.0
            && pos[2] >= -1.0 && pos[2] <= 1.0;
    }

    isVisible(regionPos: vec2): boolean {
        const baseX = regionPos[0] * Scene.MAP_SIZE;
        const baseY = regionPos[1] * Scene.MAP_SIZE;
        for (let x = 0; x <= 8; x++) {
            for (let y = 0; y <= 8; y++) {
                this.isVisiblePos[0] = baseX + x * 8;
                this.isVisiblePos[1] = 0;
                this.isVisiblePos[2] = baseY + y * 8;
                if (this.isPositionVisible(this.isVisiblePos)) {
                    return true;
                }
            }
        }
        return false;
    }

    updatePitch(pitch: number, deltaPitch: number): void {
        this.pitch = clamp(pitch + deltaPitch, 0, 512);
    }

    updateYaw(yaw: number, deltaYaw: number): void {
        this.yaw = yaw + deltaYaw;
    }

    moveCamera(deltaX: number, deltaY: number, deltaZ: number): void {
        const delta = vec3.fromValues(deltaX, deltaY, deltaZ);

        vec3.rotateY(delta, delta, this.moveCameraRotOrigin, (512 * 3 - this.yaw) * RS_TO_RADIANS);

        vec3.add(this.cameraPos, this.cameraPos, delta);
    }

    render(gl: WebGL2RenderingContext, time: DOMHighResTimeStamp, resized: boolean) {
        time *= 0.001;
        const deltaTime = time - this.lastFrameTime;
        this.lastFrameTime = time;
        this.fps = 1 / deltaTime;

        if (this.fpsListener) {
            this.fpsListener(this.fps);
        }

        const canvasWidth = gl.canvas.width;
        const canvasHeight = gl.canvas.height;

        if (resized) {
            this.app.resize(canvasWidth, canvasHeight);
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (!this.program) {
            console.warn('program not compiled yet');
            return;
        }

        let cameraSpeedMult = 1.0;
        if (this.keys.get('Shift')) {
            cameraSpeedMult = 10.0;
        }

        const deltaPitch = 64 * 3 * deltaTime;
        const deltaYaw = 64 * 5 * deltaTime;

        // camera direction controls
        if (this.keys.get('ArrowUp')) {
            this.updatePitch(this.pitch, deltaPitch);
        }
        if (this.keys.get('ArrowDown')) {
            this.updatePitch(this.pitch, -deltaPitch);
        }
        if (this.keys.get('ArrowRight')) {
            this.updateYaw(this.yaw, deltaYaw);
        }
        if (this.keys.get('ArrowLeft')) {
            this.updateYaw(this.yaw, -deltaYaw);
        }

        // mouse/touch controls
        if (this.startMouseX !== -1 && this.startMouseY !== -1) {
            const deltaMouseX = this.startMouseX - this.currentMouseX;
            const deltaMouseY = this.startMouseY - this.currentMouseY;
            this.updatePitch(this.startPitch, deltaMouseY * 0.6);
            this.updateYaw(this.startYaw, deltaMouseX * -0.9);
        }

        // camera position controls
        if (this.keys.get('w') || this.keys.get('W')) {
            this.moveCamera(-16 * cameraSpeedMult * deltaTime, 0, 0);
        }
        if (this.keys.get('a') || this.keys.get('A')) {
            this.moveCamera(0, 0, -16 * cameraSpeedMult * deltaTime);
        }
        if (this.keys.get('s') || this.keys.get('S')) {
            this.moveCamera(16 * cameraSpeedMult * deltaTime, 0, 0);
        }
        if (this.keys.get('d') || this.keys.get('D')) {
            this.moveCamera(0, 0, 16 * cameraSpeedMult * deltaTime);
        }
        if (this.keys.get('e') || this.keys.get('E')) {
            this.moveCamera(0, 8 * cameraSpeedMult * deltaTime, 0);
        }
        if (this.keys.get('c') || this.keys.get('C')) {
            this.moveCamera(0, -8 * cameraSpeedMult * deltaTime, 0);
        }

        if (this.keys.get('t') && this.timer.ready()) {
            const totalTriangles = Array.from(this.terrains.values()).map(t => t.triangleCount).reduce((a, b) => a + b, 0);

            console.log(this.timer.cpuTime, this.timer.gpuTime, this.terrains.size, 'triangles', totalTriangles);
            console.log(time);
        }


        if (this.keys.get('r') && this.timer.ready()) {
            this.app.enable(PicoGL.RASTERIZER_DISCARD);
        }
        if (this.keys.get('f') && this.timer.ready()) {
            this.app.disable(PicoGL.RASTERIZER_DISCARD);
        }

        if (this.keys.get('p')) {
            for (let i = 0; i < 20; i++) {
                this.chunkDataLoader.load2(50, 50);

                this.chunkDataLoader.regionLoader.regions.clear();
                this.chunkDataLoader.regionLoader.blendedUnderlayColors.clear();
                this.chunkDataLoader.regionLoader.lightLevels.clear();

                this.chunkDataLoader.modelLoader.cache.clear();
                this.chunkDataLoader.objectModelLoader.modelDataCache.clear();
                this.chunkDataLoader.objectModelLoader.modelCache.clear();
            }
        }



        // this.setProjection(0, 0, canvasWidth, canvasHeight, canvasWidth / 2, canvasHeight / 2, 1);
        mat4.identity(this.projectionMatrix);
        mat4.perspective(this.projectionMatrix, Math.PI / 2, canvasWidth / canvasHeight, 0.1, 1024.0 * 4);
        mat4.rotateX(this.projectionMatrix, this.projectionMatrix, Math.PI);

        mat4.identity(this.viewMatrix);
        // mat4.lookAt(this.viewMatrix, vec3.fromValues(1, 1, 0), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        if (this.pitch !== 0) {
            mat4.rotateX(this.viewMatrix, this.viewMatrix, this.pitch * RS_TO_RADIANS);
        }
        if (this.yaw !== 0) {
            mat4.rotateY(this.viewMatrix, this.viewMatrix, this.yaw * RS_TO_RADIANS);
        }
        mat4.translate(this.viewMatrix, this.viewMatrix, this.cameraPos);
        // mat4.translate(this.viewMatrix, this.viewMatrix, vec3.fromValues(-50.5, 10, -20.5));
        // mat4.translate(this.viewMatrix, this.viewMatrix, vec3.fromValues(Math.random() * 256 - 128, Math.random() * 256 - 128, Math.random() * 256 - 128));

        mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);

        this.sceneUniformBuffer
            .set(0, this.viewProjMatrix as Float32Array)
            .update();

        const cameraX = -this.cameraPos[0];
        const cameraY = -this.cameraPos[2];

        const cameraRegionX = cameraX / 64 | 0;
        const cameraRegionY = cameraY / 64 | 0;

        if (this.keys.get('c')) {
            // this.isVisible(this.terrains[0]);
        }

        if (this.lastCameraRegionX != cameraRegionX || this.lastCameraRegionY != cameraRegionY) {
            const regionViewDistance = 1;

            this.regionPositions.length = 0;
            for (let x = -(regionViewDistance - 1); x < regionViewDistance; x++) {
                for (let y = -(regionViewDistance - 1); y < regionViewDistance; y++) {
                    const regionX = cameraRegionX + x;
                    const regionY = cameraRegionY + y;
                    if (regionX < 0 || regionX >= 100 || regionY < 0 || regionY >= 200) {
                        continue;
                    }
                    const regionId = RegionLoader.getRegionId(regionX, regionY);
                    if (this.invalidRegionIds.has(regionId)) {
                        continue;
                    }
                    this.regionPositions.push([regionX, regionY]);
                }
            }
        }


        this.timer.start();

        if (this.lastCameraX != cameraX || this.lastCameraY != cameraY) {
            // sort front to back
            this.regionPositions.sort((a, b) => {
                const regionDistA = getRegionDistance(cameraX, cameraY, a);
                const regionDistB = getRegionDistance(cameraX, cameraY, b);
                return regionDistA - regionDistB;
            });
        }

        const viewDistanceRegionIds = this.viewDistanceRegionIds[this.frameCount % 2];
        const lastViewDistanceRegionIds = this.viewDistanceRegionIds[(this.frameCount + 1) % 2];

        viewDistanceRegionIds.clear();

        // draw back to front
        for (let i = this.regionPositions.length - 1; i >= 0; i--) {
            const pos = this.regionPositions[i];
            const regionId = RegionLoader.getRegionId(pos[0], pos[1]);
            const terrain = this.terrains.get(regionId);
            viewDistanceRegionIds.add(regionId);
            if (!terrain || !this.isVisible(pos) || (this.frameCount - terrain.frameLoaded) < 4) {
                continue;
            }

            const regionDist = Math.max(Math.abs(cameraRegionX - terrain.regionX), Math.abs(cameraRegionY - terrain.regionY));

            const drawCall = regionDist >= 3 ? terrain.drawCallLowDetail : terrain.drawCall;

            // fade in chunks even if it loaded a while ago
            if (!lastViewDistanceRegionIds.has(regionId)) {
                terrain.timeLoaded = time;
            }

            drawCall.uniform('u_currentTime', time);
            drawCall.uniform('u_timeLoaded', terrain.timeLoaded);
            drawCall.uniform('u_deltaTime', deltaTime);

            drawCall.draw();
        }

        for (const regionPos of this.regionPositions) {
            const regionId = RegionLoader.getRegionId(regionPos[0], regionPos[1]);
            if (!this.loadingRegionIds.has(regionId) && !this.terrains.has(regionId) && this.isVisible(regionPos)) {
                this.loadingRegionIds.add(regionId);

                this.chunkLoaderWorker.queue(worker => worker.load(regionPos[0], regionPos[1])).then(chunkData => {
                    if (chunkData) {
                        this.chunksToLoad.push(chunkData);
                    }
                });
            }
        }

        // TODO: upload x bytes per frame
        if (this.frameCount % 30) {
            const chunkData = this.chunksToLoad.shift();
            if (chunkData) {
                this.terrains.set(RegionLoader.getRegionId(chunkData.regionX, chunkData.regionY),
                    loadTerrain(this.app, this.program, this.textureArray, this.textureUniformBuffer, this.sceneUniformBuffer, chunkData, this.frameCount));
            }
        }

        this.timer.end();

        this.frameCount++;

        this.lastCameraX = cameraX;
        this.lastCameraY = cameraY;
        this.lastCameraRegionX = cameraRegionX;
        this.lastCameraRegionY = cameraRegionY;
    }
}

type ChunkLoaderWorker = {
    init(memoryStore: TransferDescriptor<MemoryStore>, xteasMap: Map<number, number[]>): void,

    load(regionX: number, regionY: number): ChunkData | undefined,
};

function App() {
    const [test, setTest] = useState<Test | undefined>(undefined);
    const [fps, setFps] = useState<number>(0);


    // const test = new Test();

    useEffect(() => {
        console.time('first load');
        const load = async () => {
            const store = await fetchMemoryStore('/cache209/', [
                IndexType.ANIMATIONS,
                IndexType.SKELETONS,
                IndexType.CONFIGS,
                IndexType.MAPS,
                IndexType.MODELS,
                IndexType.SPRITES,
                IndexType.TEXTURES
            ], true);

            console.time('load xteas');
            const xteas: any[] = await fetch('/cache209/keys.json').then(resp => resp.json());
            const xteasMap: Map<number, number[]> = new Map();
            xteas.forEach(xtea => xteasMap.set(xtea.group, xtea.key));
            console.timeEnd('load xteas');

            // const poolSize = 1;
            // const poolSize = navigator.hardwareConcurrency;
            const poolSize = Math.min(navigator.hardwareConcurrency, 4);

            const pool = Pool(() => {
                return spawn<ChunkLoaderWorker>(new Worker(new URL("./worker", import.meta.url) as any)).then(worker => {
                    worker.init(Transfer(store, []), xteasMap);
                    return worker;
                });
            }, poolSize);

            const fileSystem = loadFromStore(store);

            // const animIndex = fileSystem.getIndex(IndexType.ANIMATIONS);
            // const skeletonIndex = fileSystem.getIndex(IndexType.SKELETONS);
            // console.log('anim archive count: ', animIndex.getArchiveCount());
            // console.log('skeleton archive count: ', skeletonIndex.getArchiveCount());

            // const skeletons: Map<number, Skeleton> = new Map();

            // const getSkeleton = (id: number) => {
            //     const file = skeletonIndex.getFile(id, 0);
            //     if (!file) {
            //         throw new Error('Invalid skeleton file: ' + id);
            //     }
            //     return new Skeleton(id, file.data);
            // };

            // const getSkeletonCached = (id: number) => {
            //     let skeleton = skeletons.get(id);
            //     if (!skeleton) {
            //         skeleton = getSkeleton(id);
            //         skeletons.set(id, skeleton);
            //     }
            //     return skeleton;
            // }

            // console.time('load anim archives');
            // let fileCount = 0;
            // const skeletonIds: Set<number> = new Set();
            // for (const id of animIndex.getArchiveIds()) {
            //     const archive = animIndex.getArchive(id);
            //     for (const file of archive.files) {
            //         fileCount++;
            //         const animData = file.data;
            //         const skeletonId = (animData[0] & 0xFF) << 8 | (animData[1] & 0xFF);
            //         getSkeletonCached(skeletonId);
            //         skeletonIds.add(skeletonId);
            //     }
            // }
            // console.timeEnd('load anim archives');
            // console.log(fileCount, skeletonIds);

            const mapViewer = new Test(fileSystem, xteasMap, pool);
            mapViewer.fpsListener = (fps: number) => {
                setFps(fps);
            };

            setTest(mapViewer);
        };

        load().catch(console.error);
    }, []);

    let view: JSX.Element | undefined = undefined;
    if (test) {
        view = (<div className='fps-counter'>{fps.toFixed(1)}</div>);
    }
    return (
        <div className="App">
            {view}
            {test && <WebGLCanvas init={test.init} draw={test.render}></WebGLCanvas>}
        </div>
    );
}

export default App;
