import { useState, useEffect, ReactHTMLElement } from 'react';
import './App.css';
import WebGLCanvas from './Canvas';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { PicoGL, App as PicoApp, Timer, Program, UniformBuffer, VertexArray, Texture, DrawCall } from 'picogl';
import { MemoryFileSystem, openFromUrl } from './client/fs/FileSystem';
import { IndexType } from './client/fs/IndexType';
import { ConfigType } from './client/fs/ConfigType';
import { UnderlayDefinition } from './client/fs/definition/UnderlayDefinition';
import { ObjectSpawn, Scene } from './client/Scene';
import { OverlayDefinition } from './client/fs/definition/OverlayDefinition';
import { IndexSync } from './client/fs/Index';
import { StoreSync } from './client/fs/Store';
import { TextureDefinition } from './client/fs/definition/TextureDefinition';
import { } from './client/Client';
import { Archive } from './client/fs/Archive';
import { SpriteLoader } from './client/sprite/SpriteLoader';
import { TextureLoader } from './client/fs/loader/TextureLoader';
import { ByteBuffer } from './client/util/ByteBuffer';
import { ObjectDefinition } from './client/fs/definition/ObjectDefinition';
import { ModelData } from './client/model/ModelData';
import { Model } from './client/model/Model';
import { spawn, Pool, Worker, Transfer, TransferDescriptor, ModuleThread } from "threads";
import { RegionLoader } from './client/RegionLoader';
import { HSL_RGB_MAP, brightenRgb, packHsl } from './client/util/ColorUtil';
import { CachedUnderlayLoader } from './client/fs/loader/UnderlayLoader';
import { CachedOverlayLoader, OverlayLoader } from './client/fs/loader/OverlayLoader';
import { CachedObjectLoader } from './client/fs/loader/ObjectLoader';
import { ChunkData, ChunkDataLoader } from './ChunkDataLoader';
import { MemoryStore } from './client/fs/MemoryStore';

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

const vertexShader2 = `
#version 300 es
#extension GL_ANGLE_multi_draw : require

precision highp float;

layout(std140, column_major) uniform;

layout(location = 0) in ivec3 a_position;
layout(location = 1) in vec4 a_color;
layout(location = 2) in ivec2 a_texCoord;
layout(location = 3) in uint a_texId;
layout(location = 4) in uint a_priority;

uniform SceneUniforms {
    mat4 u_viewProjMatrix;
};

uniform mat4 u_modelMatrix;
uniform float u_currentTime;
uniform float u_timeLoaded;

uniform highp usampler2D u_perModelPosTexture;
uniform highp usampler2DArray u_heightMap;

out vec4 v_color;
out vec2 v_texCoord;
flat out int v_texId;
flat out float v_loadAlpha;

float getHeight(int x, int y, uint plane) {
    uvec2 heightPacked = texelFetch(u_heightMap, ivec3(x, y, plane), 0).gr;

    int height = int(heightPacked.x) << 8 | int(heightPacked.y);

    return float(height * 8);
}

float getHeightInterp(float x, float y, uint plane) {
    int ix = int(x);
    int iy = int(y);

    float h00 = getHeight(ix, iy, plane);
    float h10 = getHeight(ix + 1, iy, plane);
    float h01 = getHeight(ix, iy + 1, plane);
    float h11 = getHeight(ix + 1, iy + 1, plane);
    
    // bilinear interpolation
    return h00 * (1.0 - mod(x, 1.0)) * (1.0 - mod(y, 1.0)) +
        h10 * mod(x, 1.0) * (1.0 - mod(y, 1.0)) +
        h01 * (1.0 - mod(x, 1.0)) * mod(y, 1.0) +
        h11 * mod(x, 1.0) * mod(y, 1.0);
}

float unpackFloat16(int v) {
    int exponent = v >> 10;
    float mantissa = float(v & 0x3FF) / 1024.0;
    return float(exponent) + mantissa;
}

float when_eq(float x, float y) {
    return 1.0 - abs(sign(x - y));
}

float when_neq(float x, float y) {
  return abs(sign(x - y));
}

ivec2 getDataTexCoordFromIndex(int index) {
    int x = index % 16;
    int y = index / 16;
    return ivec2(x, y);
}

void main() {
    uvec2 offsetVec = texelFetch(u_perModelPosTexture, getDataTexCoordFromIndex(gl_DrawID), 0).gr;
    int offset = int(offsetVec.x) << 8 | int(offsetVec.y);

    v_color = a_color;
    v_texCoord = vec2(unpackFloat16(a_texCoord.x), unpackFloat16(a_texCoord.y));
    v_texId = int(a_texId);
    v_loadAlpha = smoothstep(0.0, 1.0, min((u_currentTime - u_timeLoaded) * 0.7, 1.0));

    uvec4 modelData = texelFetch(u_perModelPosTexture, getDataTexCoordFromIndex(offset + gl_InstanceID), 0);

    uint plane = modelData.g >> uint(6);
    float contourGround = float(int(modelData.g) >> 5 & 1);
    uint priority = modelData.r;
    vec2 tilePos = vec2(modelData.ab) / vec2(2);

    vec3 localPos = vec3(a_position) / vec3(128.0) + vec3(tilePos.x, 0, tilePos.y);

    vec2 interpPos = tilePos * vec2(when_eq(contourGround, 0.0)) + localPos.xz * vec2(when_neq(contourGround, 0.0));
    localPos.y -= getHeightInterp(interpPos.x, interpPos.y, plane) / 128.0;
    
    gl_Position = u_viewProjMatrix * u_modelMatrix * vec4(localPos, 1.0);
    gl_Position.z -= float(plane) * 0.003 + float(priority) * 0.001 + float(a_priority) * 0.0001;
}
`.trim();

const fragmentShader2 = `
#version 300 es
#extension GL_ANGLE_multi_draw : require

precision mediump float;

layout(std140, column_major) uniform;

in vec4 v_color;
in vec2 v_texCoord;
flat in int v_texId;
flat in float v_loadAlpha;

uniform highp sampler2DArray u_textures;

out vec4 fragColor;

void main() {
    fragColor = texture(u_textures, vec3(v_texCoord, v_texId)).bgra * v_color * vec4(v_loadAlpha);
}
`.trim();

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

function getSpiralDeltas(radius: number): number[][] {
    let x = 0;
    let y = 0;
    let delta = [0, -1];

    const deltas: number[][] = [];

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
    perModelPosTexture: Texture,
    heightMapTexture: Texture,
    drawCall: DrawCall,
    drawCallLowDetail: DrawCall,
}

function loadTerrain(app: PicoApp, program: Program, textureArray: Texture, sceneUniformBuffer: UniformBuffer, chunkData: ChunkData): Terrain {
    const regionX = chunkData.regionX;
    const regionY = chunkData.regionY;

    const baseX = regionX * 64;
    const baseY = regionY * 64;

    const baseModelMatrix = mat4.create();
    mat4.translate(baseModelMatrix, baseModelMatrix, [baseX, 0, baseY]);

    const interleavedBuffer = app.createInterleavedBuffer(16, chunkData.vertices);

    const indexBuffer = app.createIndexBuffer(PicoGL.UNSIGNED_INT, chunkData.indices);

    const vertexArray = app.createVertexArray()
        .vertexAttributeBuffer(0, interleavedBuffer, {
            type: PicoGL.SHORT,
            size: 3,
            stride: 16,
            integer: true as any
        })
        .vertexAttributeBuffer(1, interleavedBuffer, {
            type: PicoGL.UNSIGNED_BYTE,
            size: 4,
            offset: 6,
            stride: 16,
            normalized: true 
        })
        .vertexAttributeBuffer(2, interleavedBuffer, {
            type: PicoGL.SHORT,
            size: 2,
            offset: 10,
            stride: 16,
            integer: true as any
        })
        .vertexAttributeBuffer(3, interleavedBuffer, {
            type: PicoGL.UNSIGNED_BYTE,
            size: 1,
            offset: 14,
            stride: 16,
            integer: true as any
        })
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

    const heightMapTexture = app.createTextureArray(new Uint8Array(chunkData.heightMapTextureData.buffer), 72, 72, Scene.MAX_PLANE,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    const time = performance.now();

    let drawCall = app.createDrawCall(program, vertexArray)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time * 0.001)
        .uniform('u_modelMatrix', baseModelMatrix)
        .texture('u_textures', textureArray)
        .texture('u_perModelPosTexture', perModelPosTexture)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRanges);

    let drawCallLowDetail = app.createDrawCall(program, vertexArray)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time * 0.001)
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
        perModelPosTexture,
        heightMapTexture,
        drawCall,
        drawCallLowDetail
    };
}


class Test {
    fileSystem: MemoryFileSystem;

    chunkLoaderWorker: Pool<ModuleThread<ChunkLoaderWorker>>;

    modelIndex: IndexSync<StoreSync>;

    regionLoader: RegionLoader;

    textureProvider: TextureLoader;

    chunkDataLoader: ChunkDataLoader;

    app!: PicoApp;

    keys: Map<string, boolean> = new Map();

    timer!: Timer;

    program!: Program;
    program2!: Program;

    sceneUniformBuffer!: UniformBuffer;

    textureArray!: Texture;

    terrains: Map<number, Terrain> = new Map();

    pitch: number = 244;
    yaw: number = 749;

    cameraPos: vec3 = vec3.fromValues(-60.5 - 3200, 60, -60.5 - 3200);
    // cameraPos: vec3 = vec3.fromValues(-3200, 10, -3200);
    // cameraPos: vec3 = vec3.fromValues(-2270, 10, -5342);

    projectionMatrix: mat4 = mat4.create();
    viewMatrix: mat4 = mat4.create();
    viewProjMatrix: mat4 = mat4.create();

    loadingRegionIds: Set<number> = new Set();

    chunksToLoad: ChunkData[] = [];

    frameCount: number = 0;

    fps: number = 0;

    lastFrameTime: number = 0;

    fpsListener?: (fps: number) => void;

    constructor(fileSystem: MemoryFileSystem, xteasMap: Map<number, number[]>, chunkLoaderWorker: Pool<ModuleThread<ChunkLoaderWorker>>) {
        this.fileSystem = fileSystem;
        this.chunkLoaderWorker = chunkLoaderWorker;

        const configIndex = this.fileSystem.getIndex(IndexType.CONFIGS);
        const mapIndex = this.fileSystem.getIndex(IndexType.MAPS);
        const spriteIndex = this.fileSystem.getIndex(IndexType.SPRITES);
        const textureIndex = this.fileSystem.getIndex(IndexType.TEXTURES);
        this.modelIndex = this.fileSystem.getIndex(IndexType.MODELS);

        const underlayArchive = configIndex.getArchive(ConfigType.UNDERLAY);
        const overlayArchive = configIndex.getArchive(ConfigType.OVERLAY);
        const objectArchive = configIndex.getArchive(ConfigType.OBJECT);

        const underlayLoader = new CachedUnderlayLoader(underlayArchive);
        const overlayLoader = new CachedOverlayLoader(overlayArchive);
        const objectLoader = new CachedObjectLoader(objectArchive);

        this.regionLoader = new RegionLoader(mapIndex, underlayLoader, overlayLoader, objectLoader, xteasMap);

        this.textureProvider = TextureLoader.load(textureIndex, spriteIndex);

        console.log('texture count: ', this.textureProvider.definitions.size);

        this.chunkDataLoader = new ChunkDataLoader(this.regionLoader, this.modelIndex, this.textureProvider);

        // for (let i = 0; i < 50; i++) {
        //     this.chunkDataLoader.load(50, 50);
            
        //     this.chunkDataLoader.regionLoader.regions.clear();
        //     this.chunkDataLoader.regionLoader.blendedUnderlayColors.clear();
        //     this.chunkDataLoader.regionLoader.lightLevels.clear();
        // }

        this.init = this.init.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.render = this.render.bind(this);
    }

    init(gl: WebGL2RenderingContext) {
        gl.canvas.addEventListener('keydown', this.onKeyDown);
        gl.canvas.addEventListener('keyup', this.onKeyUp);
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

        this.program = app.createProgram(vertexShader, fragmentShader);
        console.time('compile shader');
        this.program2 = app.createProgram(vertexShader2, fragmentShader2);
        console.timeEnd('compile shader');

        this.sceneUniformBuffer = app.createUniformBuffer([PicoGL.FLOAT_MAT4]);

        // const textures = textureProvider.getDefinitions();

        const textureArrayImage = this.textureProvider.createTextureArrayImage(0.9, TEXTURE_SIZE, true);

        this.textureArray = app.createTextureArray(new Uint8Array(textureArrayImage.buffer), TEXTURE_SIZE, TEXTURE_SIZE, this.textureProvider.getTextureCount(),
            { maxAnisotropy: PicoGL.WEBGL_INFO.MAX_TEXTURE_ANISOTROPY });

        const radius = 1;

        console.time('build');
        for (let x = 0; x < radius; x++) {
            for (let y = 0; y < radius; y++) {
                // const terrain = loadTerrain2(app, this.regionLoader, this.textureProvider, 50 + x, 50 + y, this.modelIndex);
                // const terrain = loadTerrain3(app, this.chunkDataLoader, 50 + x, 50 + y);
                // this.terrains.push(terrain);
            }
        }
        console.timeEnd('build');

        // const totalTriangles = this.terrains.map(t => t.triangleCount).reduce((a, b) => a + b, 0);
        // console.log('triangles', totalTriangles);


        console.timeEnd('first load');

        console.log(this.program);

        console.log(gl.getSupportedExtensions());

        // const program = createProgramFromSources(gl, [vertexShader, fragmentShader]);
        // console.log(program);
        // const settingsBlock = UniformBlock.create(gl, program, "Settings", 0, ["u_projViewMatrix"]);

        // gl.enable(gl.DEPTH_TEST);

        // gl.clearColor(0, 0, 0, 1);
    }

    onKeyDown(event: KeyboardEvent) {
        console.log(event.key);
        this.keys.set(event.key, true);
        event.preventDefault();
    }

    onKeyUp(event: KeyboardEvent) {
        this.keys.set(event.key, false);
        event.preventDefault();
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
                if (this.isPositionVisible([baseX + x * 8, 0, baseY + y * 8])) {
                    return true;
                }
            }
        }
        return false;
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

        if (this.keys.get('ArrowUp')) {
            this.pitch = clamp(this.pitch + 1, 0, 512);
        }
        if (this.keys.get('ArrowDown')) {
            this.pitch = clamp(this.pitch - 1, 0, 512);
        }
        if (this.keys.get('ArrowRight')) {
            this.yaw = this.yaw + 2 % 2048;
        }
        if (this.keys.get('ArrowLeft')) {
            this.yaw = this.yaw - 2;
            if (this.yaw < 0) {
                this.yaw = 2048 - this.yaw;
            }
            // console.log(this.pitch, this.yaw);
        }

        if (this.keys.get('w')) {
            const delta = vec3.fromValues(-0.5 * 3, 0, 0);
            // vec3.transformMat4(delta, delta, deltaMatrix);
            vec3.rotateY(delta, delta, [0, 0, 0], (512 * 3 - this.yaw) * RS_TO_RADIANS);

            // console.log(delta);

            // vec3.transformMat4(this.cameraPos, this.cameraPos, deltaMatrix);
            vec3.add(this.cameraPos, this.cameraPos, delta);
        }

        if (this.keys.get('t') && this.timer.ready()) {
            const totalTriangles = Array.from(this.terrains.values()).map(t => t.triangleCount).reduce((a, b) => a + b, 0);


            console.log(this.timer.cpuTime, this.timer.gpuTime, this.terrains.size, 'triangles', totalTriangles);
            console.log(time);
        }

        if (resized) {
            this.app.resize(canvasWidth, canvasHeight);

        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


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

        const cameraRegionX = -this.cameraPos[0] / 64 | 0;
        const cameraRegionY = -this.cameraPos[2] / 64 | 0;

        if (this.keys.get('c')) {
            // this.isVisible(this.terrains[0]);
        }


        this.timer.start();

        this.terrains.forEach(terrain => {
            if (!this.isVisible([terrain.regionX, terrain.regionY])) {
                return;
            }
            const regionDist = Math.max(Math.abs(cameraRegionX - terrain.regionX), Math.abs(cameraRegionY - terrain.regionY));

            const drawCall = regionDist >= 3 ? terrain.drawCallLowDetail : terrain.drawCall;

            drawCall.uniform('u_currentTime', time);
            // debugger;

            // console.log(terrain.drawRanges);

            // console.log(drawCall);

            // console.log((drawCall.numElements as any)[0], (drawCall.numInstances as any)[0], (drawCall as any).offsets[0], (drawCall as any).numDraws)

            drawCall.draw();
        });

        getSpiralDeltas(10)
            .map(delta => [cameraRegionX + delta[0], cameraRegionY + delta[1]] as vec2)
            .filter(regionPos => !this.loadingRegionIds.has(this.regionLoader.getRegionId(regionPos[0], regionPos[1])))
            .filter(regionPos => !this.terrains.has(this.regionLoader.getRegionId(regionPos[0], regionPos[1])))
            .filter(regionPos => this.isVisible(regionPos))
            .forEach((regionPos, index) => {
                if (index == 0 || 1) {
                    // console.time('load terrain');
                    // this.terrains.push(loadTerrain2(this.app, this.regionLoader, this.textureProvider, regionPos[0], regionPos[1], this.modelIndex));
                    // this.terrains.push(loadTerrain3(this.app, this.chunkDataLoader, regionPos[0], regionPos[1]));
                    this.loadingRegionIds.add(this.regionLoader.getRegionId(regionPos[0], regionPos[1]));

                    this.chunkLoaderWorker.queue(worker => worker.load(regionPos[0], regionPos[1])).then(chunkData => {
                        if (chunkData) {
                            this.chunksToLoad.push(chunkData);
                        }
                    })
                    // loadTerrain4(this.app, this.chunkLoaderWorker, regionPos[0], regionPos[1]).then(terrain => {
                    //     this.terrains.push(terrain);
                    //     this.loadingRegionIds.delete(this.regionLoader.getRegionId(terrain.regionX, terrain.regionY));
                    // });
                    // console.timeEnd('load terrain');
                }
            });

        if (this.chunksToLoad.length) {
            const chunkData = this.chunksToLoad[0];
            this.terrains.set(this.regionLoader.getRegionId(chunkData.regionX, chunkData.regionY),
                loadTerrain(this.app, this.program2, this.textureArray, this.sceneUniformBuffer, chunkData));
            this.chunksToLoad = this.chunksToLoad.slice(1);
        }

        this.timer.end();

        this.frameCount++;
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
            const fileSystem = await openFromUrl('/cache209/', [IndexType.CONFIGS, IndexType.MAPS, IndexType.MODELS, IndexType.SPRITES, IndexType.TEXTURES], true);

            const xteas: any[] = await fetch('/cache209/keys.json').then(resp => resp.json());
            const xteasMap: Map<number, number[]> = new Map();
            xteas.forEach(xtea => xteasMap.set(xtea.group, xtea.key));

            // const chunkLoaderWorker = await spawn<ChunkLoaderWorker>(new Worker(new URL("./worker", import.meta.url) as any));
            // chunkLoaderWorker.init(Transfer(fileSystem.store, []), xteasMap);

            // console.log(chunkLoaderWorker);

            // const poolSize = 1;
            // const poolSize = navigator.hardwareConcurrency;
            const poolSize = Math.min(navigator.hardwareConcurrency, 8);

            const pool = Pool(() => {
                return spawn<ChunkLoaderWorker>(new Worker(new URL("./worker", import.meta.url) as any)).then(worker => {
                    worker.init(Transfer(fileSystem.store, []), xteasMap);
                    return worker;
                });
            }, poolSize);

            // await pool.completed();

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
