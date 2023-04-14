import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import './MapViewer.css';
import WebGLCanvas from '../components/Canvas';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { PicoGL, App as PicoApp, Timer, Program, UniformBuffer, VertexArray, Texture, DrawCall, VertexBuffer } from 'picogl';
import { MemoryFileSystem, fetchMemoryStore, loadFromStore, DownloadProgress } from '../client/fs/FileSystem';
import { IndexType } from '../client/fs/IndexType';
import { TextureLoader } from '../client/fs/loader/TextureLoader';
import { RegionLoader } from '../client/RegionLoader';
import { AnimatedModelData, ChunkData, ChunkDataLoader } from './chunk/ChunkDataLoader';
import { MemoryStore } from '../client/fs/MemoryStore';
import { Skeleton } from '../client/model/animation/Skeleton';
import { ConfigType } from '../client/fs/ConfigType';
import { CachedUnderlayLoader } from '../client/fs/loader/UnderlayLoader';
import { CachedOverlayLoader } from '../client/fs/loader/OverlayLoader';
import { CachedObjectLoader } from '../client/fs/loader/ObjectLoader';
import { IndexModelLoader } from '../client/fs/loader/ModelLoader';
import Denque from 'denque';
import { Scene } from '../client/scene/Scene';
import { OsrsLoadingBar } from '../components/OsrsLoadingBar';
import { Hasher } from '../client/util/Hasher';
import { AnimationLoader, CachedAnimationLoader } from '../client/fs/loader/AnimationLoader';
import { CachedSkeletonLoader } from '../client/fs/loader/SkeletonLoader';
import { AnimationFrameMapLoader, CachedAnimationFrameMapLoader } from '../client/fs/loader/AnimationFrameMapLoader';
import { Leva, useControls, folder } from 'leva';
import { Joystick } from 'react-joystick-component';
import { IJoystickUpdateEvent } from 'react-joystick-component/build/lib/Joystick';
import { FrustumIntersection } from './FrustumIntersection';
import mainVertShader from './shaders/main.vert.glsl';
import mainFragShader from './shaders/main.frag.glsl';
import { clamp } from '../client/util/MathUtil';
import { ChunkLoaderWorkerPool } from './chunk/ChunkLoaderWorkerPool';
import { AnimationDefinition } from '../client/fs/definition/AnimationDefinition';

// console.log(mainVertShader);

const DEFAULT_ZOOM: number = 25.0 / 256.0;

const TAU = Math.PI * 2;
const RS_TO_RADIANS = TAU / 2048.0;
const RS_TO_DEGREES = RS_TO_RADIANS * 180 / Math.PI;

function prependShader(shader: string, multiDraw: boolean): string {
    let header = '#version 300 es\n';
    if (multiDraw) {
        header += '#define MULTI_DRAW 1\n';
    }
    return header + shader;
}

const TEXTURE_SIZE = 128;
const TEXTURE_PIXEL_COUNT = TEXTURE_SIZE * TEXTURE_SIZE;

type Chunk = {
    regionX: number,
    regionY: number,
    modelMatrix: mat4,

    triangleCount: number,
    drawRanges: number[][],
    drawRangesLowDetail: number[][],
    drawCall: DrawCall,
    drawCallLowDetail: DrawCall,

    animatedModels: AnimatedModel[],

    interleavedBuffer: VertexBuffer,
    indexBuffer: VertexBuffer,
    vertexArray: VertexArray,
    modelDataTexture: Texture,
    heightMapTexture: Texture,

    timeLoaded: number,
    frameLoaded: number,
}

class AnimatedModel {
    drawRangeIndex: number;
    frames: number[][];

    animationDef?: AnimationDefinition;

    frame: number = 0;

    cycleStart: number = 0;

    constructor(drawRangeIndex: number, frames: number[][], animationDef: AnimationDefinition, cycle: number, randomStart: boolean) {
        this.drawRangeIndex = drawRangeIndex;
        this.frames = frames;
        this.animationDef = animationDef;
        this.cycleStart = cycle - 1;

        if (randomStart && animationDef.frameStep !== -1) {
            this.frame = Math.floor(Math.random() * animationDef.frameIds.length);
            this.cycleStart -= Math.floor(Math.random() * animationDef.frameLengths[this.frame]);
        }
    }

    getFrame(cycle: number): number {
        if (!this.animationDef) {
            return 0;
        }

        let elapsed = cycle - this.cycleStart;
        if (elapsed > 100 && this.animationDef.frameStep > 0) {
            elapsed = 100;
        }

        while (elapsed > this.animationDef.frameLengths[this.frame]) {
            elapsed -= this.animationDef.frameLengths[this.frame];
            this.frame++;
            if (this.frame >= this.animationDef.frameLengths.length) {
                this.frame -= this.animationDef.frameStep;
                if (this.frame < 0 || this.frame >= this.animationDef.frameLengths.length) {
                    this.animationDef = undefined;
                    return 0;
                }
                continue;
            }
        }

        this.cycleStart = cycle - elapsed;
        return this.frame;
    }
}

function loadChunk(app: PicoApp, program: Program, animationLoader: AnimationLoader, textureArray: Texture, textureUniformBuffer: UniformBuffer,
    sceneUniformBuffer: UniformBuffer, chunkData: ChunkData, frame: number, cycle: number): Chunk {
    const regionX = chunkData.regionX;
    const regionY = chunkData.regionY;

    const baseX = regionX * 64;
    const baseY = regionY * 64;

    const baseModelMatrix = mat4.create();
    mat4.translate(baseModelMatrix, baseModelMatrix, [baseX, 0, baseY]);

    const interleavedBuffer = app.createInterleavedBuffer(12, chunkData.vertices);

    const indexBuffer = app.createIndexBuffer(PicoGL.UNSIGNED_INT, chunkData.indices);

    const vertexArray = app.createVertexArray()
        // v0
        .vertexAttributeBuffer(0, interleavedBuffer, {
            type: PicoGL.INT,
            size: 1,
            stride: 12,
            integer: true as any
        })
        // v1
        .vertexAttributeBuffer(1, interleavedBuffer, {
            type: PicoGL.INT,
            size: 1,
            offset: 4,
            stride: 12,
            integer: true as any
        })
        // v2
        .vertexAttributeBuffer(2, interleavedBuffer, {
            type: PicoGL.INT,
            size: 1,
            offset: 8,
            stride: 12,
            integer: true as any
        })
        .indexBuffer(indexBuffer);

    const modelDataTexture = app.createTexture2D(new Uint8Array(chunkData.modelTextureData.buffer), 16, chunkData.modelTextureData.length / 16,
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
        .uniform('u_drawIdOffset', 0)
        .texture('u_textures', textureArray)
        .texture('u_modelDataTexture', modelDataTexture)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRanges);

    let drawCallLowDetail = app.createDrawCall(program, vertexArray)
        .uniformBlock('TextureUniforms', textureUniformBuffer)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time)
        .uniform('u_modelMatrix', baseModelMatrix)
        .uniform('u_drawIdOffset', chunkData.drawRanges.length - chunkData.drawRangesLowDetail.length)
        .texture('u_textures', textureArray)
        .texture('u_modelDataTexture', modelDataTexture)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRangesLowDetail);

    const animatedModels: AnimatedModel[] = [];
    for (const animatedModel of chunkData.animatedModels) {
        const animationDef = animationLoader.getDefinition(animatedModel.animationId);
        animatedModels.push(new AnimatedModel(animatedModel.drawRangeIndex, animatedModel.frames, animationDef, cycle, animatedModel.randomStart))
    }

    return {
        regionX,
        regionY,
        modelMatrix: baseModelMatrix,

        triangleCount: chunkData.indices.length / 3,
        drawRanges: chunkData.drawRanges,
        drawRangesLowDetail: chunkData.drawRangesLowDetail,
        drawCall,
        drawCallLowDetail,

        animatedModels,

        interleavedBuffer,
        indexBuffer,
        vertexArray,
        modelDataTexture,
        heightMapTexture,

        timeLoaded: time,
        frameLoaded: frame,
    };
}

function deleteChunk(chunk: Chunk) {
    chunk.interleavedBuffer.delete();
    chunk.indexBuffer.delete();
    chunk.vertexArray.delete();
    chunk.modelDataTexture.delete();
    chunk.heightMapTexture.delete();
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

class MapViewer {
    fileSystem: MemoryFileSystem;

    chunkLoaderWorker: ChunkLoaderWorkerPool;

    // modelIndex: IndexSync<StoreSync>;

    // regionLoader: RegionLoader;

    textureProvider: TextureLoader;

    animationLoader: AnimationLoader;

    // chunkDataLoader: ChunkDataLoader;

    app!: PicoApp;

    hasMultiDraw: boolean = false;

    keys: Map<string, boolean> = new Map();

    isTouchDevice: boolean = false;

    timer!: Timer;

    program?: Program;

    textureUniformBuffer!: UniformBuffer;
    sceneUniformBuffer!: UniformBuffer;

    textureArray!: Texture;

    chunks: Map<number, Chunk> = new Map();

    pitch: number = 244;
    yaw: number = 749;

    cameraPos: vec3 = vec3.fromValues(-60.5 - 3200, 30, -60.5 - 3200);

    cameraUpdated: boolean = false;
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
    cameraMoveListener?: (pos: vec3, pitch: number, yaw: number) => void;
    cameraMoveEndListener?: (pos: vec3, pitch: number, yaw: number) => void;

    regionViewDistance: number = 1;
    regionUnloadDistance: number = 1;

    lastRegionViewDistance: number = -1;

    viewDistanceRegionIds: Set<number>[] = [new Set(), new Set()];

    brightness: number = 1.0;
    colorBanding: number = 255;

    cullBackFace: boolean = true;
    lastCullBackFace: boolean = true;

    currentMouseX: number = 0;
    currentMouseY: number = 0;

    startMouseX: number = -1;
    startMouseY: number = -1;

    startPitch: number = -1;
    startYaw: number = -1;

    chunkDataLoader?: ChunkDataLoader;

    lastCameraX: number = -1;
    lastCameraY: number = -1;

    lastCameraRegionX: number = -1;
    lastCameraRegionY: number = -1;

    regionPositions: vec2[] = [];

    frustumIntersection: FrustumIntersection = new FrustumIntersection();
    chunkIntersectBox: number[][] = [[0, -240 * 10 / 128, 0], [0, 240 * 3 / 128, 0]];

    isVisiblePos: vec3 = [0, 0, 0];
    moveCameraRotOrigin: vec3 = [0, 0, 0];

    constructor(fileSystem: MemoryFileSystem, xteasMap: Map<number, number[]>, chunkLoaderWorker: ChunkLoaderWorkerPool) {
        this.fileSystem = fileSystem;
        this.chunkLoaderWorker = chunkLoaderWorker;

        this.isTouchDevice = !!(navigator.maxTouchPoints || 'ontouchstart' in document.documentElement);

        const frameMapIndex = this.fileSystem.getIndex(IndexType.ANIMATIONS);
        const skeletonIndex = this.fileSystem.getIndex(IndexType.SKELETONS);
        const configIndex = this.fileSystem.getIndex(IndexType.CONFIGS);
        const mapIndex = this.fileSystem.getIndex(IndexType.MAPS);
        const spriteIndex = this.fileSystem.getIndex(IndexType.SPRITES);
        const textureIndex = this.fileSystem.getIndex(IndexType.TEXTURES);
        // const modelIndex = this.fileSystem.getIndex(IndexType.MODELS);

        // const underlayArchive = configIndex.getArchive(ConfigType.UNDERLAY);
        // const overlayArchive = configIndex.getArchive(ConfigType.OVERLAY);
        // const objectArchive = configIndex.getArchive(ConfigType.OBJECT);
        const animationArchive = configIndex.getArchive(ConfigType.SEQUENCE);

        // console.time('region loader');
        // const underlayLoader = new CachedUnderlayLoader(underlayArchive);
        // const overlayLoader = new CachedOverlayLoader(overlayArchive);
        // const objectLoader = new CachedObjectLoader(objectArchive);
        this.animationLoader = new CachedAnimationLoader(animationArchive);

        // const objectModelLoader = new ObjectModelLoader(new IndexModelLoader(modelIndex));


        // const animIds = new Set<number>();
        // let count = 0;
        // for (const id of objectArchive.fileIds) {
        //     const objectDef = objectLoader.getDefinition(id);
        //     if (objectDef.animationId !== -1 && !animIds.has(objectDef.animationId)) {
        //         animIds.add(objectDef.animationId);

        //         const def = animationLoader.getDefinition(objectDef.animationId);
        //         // if (def.frameIds && def.frameStep !== def.frameIds.length) {
        //         //     console.log('wtf', id, objectDef.name, def);
        //         //     count++;
        //         // }
        //         // if (def.frameLengths && def.frameStep > 0) {
        //         //     const index = def.frameLengths.findIndex(length => length > 100);
        //         //     if (index !== -1 && index !== def.frameLengths.length - 1) {
        //         //         console.log('wtf', id, objectDef.name, def);
        //         //         count++;
        //         //     }
        //         // }
        //         // if (def.frameLengths && def.frameLengths.find(length => length > 1000)) {
        //         //     console.log('wtf', id, objectDef.name, def);
        //         //     count++;
        //         // }
        //         // if (def.frameLengths && def.frameLengths.reduce((a, b) => a + b, 0) > 0x7FFF) {
        //         //     console.log('wtf', id, objectDef.name, def);
        //         //     count++;
        //         // }

        //         // if (def.frameLengths && def.frameLengths.length > 50) {
        //         //     console.log('wtf', id, objectDef.name, def);
        //         //     count++;
        //         // }
        //         if (!objectDef.randomAnimStartFrame) {
        //             console.log('wtf', id, objectDef.name, def);
        //             count++;
        //         }
        //     }
        // }
        // console.log(count);

        // for (const id of animationArchive.fileIds) {
        //     const def = animationLoader.getDefinition(id);
        //     if (def.frameIds && def.frameStep !== def.frameIds.length && def.frameStep !== -1) {
        //         console.log('wtf', def);
        //     }
        // }

        // const regionLoader = new RegionLoader(mapIndex, underlayLoader, overlayLoader, objectLoader, xteasMap);

        // const skeletonLoader = new CachedSkeletonLoader(skeletonIndex);
        // const frameMapLoader = new CachedAnimationFrameMapLoader(frameMapIndex, skeletonLoader);

        // const fireplaceId = 24969;
        // const fireplaceDef = objectLoader.getDefinition(fireplaceId);
        // const fireplaceAnim = animationLoader.getDefinition(fireplaceDef.animationId);
        // if (fireplaceAnim.frameIds) {
        //     for (const frame of fireplaceAnim.frameIds) {
        //         const frameMapId = frame >> 16;
        //         const frameId = frame & 0xFFFF;
        //         console.log(frameMapId, frameId);
        //     }
        // }
        // console.log('fireplace', fireplaceDef, fireplaceAnim);

        // console.time('load anim frames');
        // for (const animId of animationArchive.fileIds) {
        //     const anim = animationLoader.getDefinition(animId);
        //     if (anim.frameIds) {
        //         const mapIds: Set<number> = new Set();
        //         for (const frame of anim.frameIds) {
        //             const frameMapId = frame >> 16;
        //             const frameId = frame & 0xFFFF;
        //             const frameMap = frameMapLoader.getFrameMap(frameMapId);
        //             mapIds.add(frameMapId);
        //         }
        //         if (mapIds.size > 1) {
        //             console.log(anim.id, mapIds, anim);
        //         }
        //     }
        // }
        // console.timeEnd('load anim frames');
        // console.timeEnd('region loader');

        // console.log(regionLoader.getTerrainArchiveId(50, 50));

        console.time('check invalid regions');
        for (let x = 0; x < 100; x++) {
            for (let y = 0; y < 200; y++) {
                if (RegionLoader.getTerrainArchiveId(mapIndex, x, y) === -1) {
                    this.invalidRegionIds.add(RegionLoader.getRegionId(x, y));
                }
            }
        }
        console.timeEnd('check invalid regions');

        // console.time('load textures');
        this.textureProvider = TextureLoader.load(textureIndex, spriteIndex);
        // console.timeEnd('load textures');

        // console.log('create map viewer', performance.now());

        // console.log('texture count: ', this.textureProvider.definitions.size);

        // this.chunkDataLoader = new ChunkDataLoader(regionLoader, objectModelLoader, this.textureProvider);

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
        this.onPositionJoystickMove = this.onPositionJoystickMove.bind(this);
        this.onPositionJoystickStop = this.onPositionJoystickStop.bind(this);
        this.onCameraJoystickMove = this.onCameraJoystickMove.bind(this);
        this.onCameraJoystickStop = this.onCameraJoystickStop.bind(this);
        this.render = this.render.bind(this);
    }

    init(gl: WebGL2RenderingContext) {
        // console.log('init start', performance.now());

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

        const cameraX = -this.cameraPos[0];
        const cameraY = -this.cameraPos[2];

        const cameraRegionX = cameraX / 64 | 0;
        const cameraRegionY = cameraY / 64 | 0;

        // queue a chunk as soon as possible so we don't have idling workers
        this.queueChunkLoad(cameraRegionX, cameraRegionY, true);


        // console.log(this.cameraPos);

        const app = this.app = PicoGL.createApp(gl as any);

        // hack to get the right multi draw extension for picogl
        if (!PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED) {
            const state: any = app.state;
            const ext = gl.getExtension('WEBGL_multi_draw');
            PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED = ext;
            state.extensions.multiDrawInstanced = ext;
        }

        this.hasMultiDraw = !!PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED;

        console.log(PicoGL.WEBGL_INFO);

        console.log(gl.getParameter(gl.MAX_SAMPLES));

        this.updateCullFace();
        app.enable(gl.DEPTH_TEST);
        app.depthFunc(gl.LEQUAL);
        app.enable(gl.BLEND);
        app.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        app.clearColor(0, 0, 0, 1);

        // console.log(gl.getParameter(gl.DEPTH_FUNC), gl.NEVER, gl.GREATER, gl.LESS);

        this.timer = app.createTimer();

        app.createPrograms([prependShader(mainVertShader, this.hasMultiDraw), prependShader(mainFragShader, this.hasMultiDraw)]).then(([program]) => {
            this.program = program;
        });

        this.textureUniformBuffer = app.createUniformBuffer(new Array(128 * 2).fill(PicoGL.FLOAT_VEC2));
        this.sceneUniformBuffer = app.createUniformBuffer([PicoGL.FLOAT_MAT4]);

        console.time('load texture array');
        const textureArrayImage = this.textureProvider.createTextureArrayImage(1.0, TEXTURE_SIZE, true);
        console.timeEnd('load texture array');

        this.textureArray = app.createTextureArray(new Uint8Array(textureArrayImage.buffer), TEXTURE_SIZE, TEXTURE_SIZE, this.textureProvider.getTextureCount(),
            {
                // wrapS: PicoGL.CLAMP_TO_EDGE,
                maxAnisotropy: PicoGL.WEBGL_INFO.MAX_TEXTURE_ANISOTROPY,
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

        console.log('textures: ', textures.length);

        console.log(gl.getSupportedExtensions());
    }

    onKeyDown(event: KeyboardEvent) {
        // console.log('down', event.key, event.shiftKey);
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

    positionJoystickEvent?: IJoystickUpdateEvent;

    cameraJoystickEvent?: IJoystickUpdateEvent;

    onPositionJoystickMove(event: IJoystickUpdateEvent) {
        this.positionJoystickEvent = event;
    }

    onPositionJoystickStop(event: IJoystickUpdateEvent) {
        this.positionJoystickEvent = undefined;
    }

    onCameraJoystickMove(event: IJoystickUpdateEvent) {
        this.cameraJoystickEvent = event;
    }

    onCameraJoystickStop(event: IJoystickUpdateEvent) {
        this.cameraJoystickEvent = undefined;
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

    isChunkVisible(regionX: number, regionY: number): boolean {
        const baseX = regionX * 64;
        const baseY = regionY * 64;
        const endX = baseX + 64;
        const endY = baseY + 64;

        this.chunkIntersectBox[0][0] = baseX;
        this.chunkIntersectBox[0][2] = baseY;

        this.chunkIntersectBox[1][0] = endX;
        this.chunkIntersectBox[1][2] = endY;

        return this.frustumIntersection.intersectsBox(this.chunkIntersectBox);
    }

    updatePitch(pitch: number, deltaPitch: number): void {
        this.pitch = clamp(pitch + deltaPitch, 0, 512);
        this.cameraUpdated = true;
    }

    setYaw(yaw: number): void {
        this.yaw = yaw;
        this.cameraUpdated = true;
    }

    updateYaw(yaw: number, deltaYaw: number): void {
        this.setYaw(yaw + deltaYaw);
    }

    moveCamera(deltaX: number, deltaY: number, deltaZ: number): void {
        const delta = vec3.fromValues(deltaX, deltaY, deltaZ);

        vec3.rotateY(delta, delta, this.moveCameraRotOrigin, (2047 - this.yaw) * RS_TO_RADIANS);

        vec3.add(this.cameraPos, this.cameraPos, delta);
        this.cameraUpdated = true;
    }

    runCameraListeners() {
        this.runCameraMoveListener();
        this.runCameraMoveEndListener();
    }

    runCameraMoveListener() {
        if (this.cameraMoveListener) {
            let yaw = this.yaw % 2048;
            if (yaw < 0) {
                yaw += 2048;
            }
            this.cameraMoveListener(this.cameraPos, this.pitch, yaw);
        }
    }

    runCameraMoveEndListener() {
        if (this.cameraMoveEndListener) {
            let yaw = this.yaw % 2048;
            if (yaw < 0) {
                yaw += 2048;
            }
            this.cameraMoveEndListener(this.cameraPos, this.pitch, yaw);
        }
    }

    queueChunkLoad(regionX: number, regionY: number, force: boolean = false) {
        const regionId = RegionLoader.getRegionId(regionX, regionY);
        if (this.loadingRegionIds.size < this.chunkLoaderWorker.size * 2 && !this.loadingRegionIds.has(regionId)
            && !this.chunks.has(regionId) && (force || this.isChunkVisible(regionX, regionY))) {
            // console.log('queue load', regionX, regionY, performance.now());
            this.loadingRegionIds.add(regionId);

            this.chunkLoaderWorker.pool.queue(worker => worker.load(regionX, regionY, !this.hasMultiDraw)).then(chunkData => {
                if (chunkData) {
                    this.chunksToLoad.push(chunkData);
                } else {
                    this.invalidRegionIds.add(regionId);
                }
            });
        }
    }

    updateCullFace() {
        if (this.cullBackFace) {
            this.app.enable(PicoGL.CULL_FACE);
        } else {
            this.app.disable(PicoGL.CULL_FACE);
        }
    }

    render(gl: WebGL2RenderingContext, time: DOMHighResTimeStamp, resized: boolean) {
        time *= 0.001;
        const deltaTime = time - this.lastFrameTime;
        this.lastFrameTime = time;
        this.fps = 1 / deltaTime;

        const cycle = time / 0.02;

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

        if (this.lastCullBackFace != this.cullBackFace) {
            this.updateCullFace();
        }

        const movedCameraLastFrame = this.cameraUpdated;

        this.cameraUpdated = false;

        let cameraSpeedMult = 1.0;
        if (this.keys.get('Shift')) {
            cameraSpeedMult = 10.0;
        }

        const deltaPitch = 64 * 3 * deltaTime;
        const deltaYaw = 64 * 5 * deltaTime;

        // camera direction controls
        if (this.keys.get('ArrowUp')) {
            this.updatePitch(this.pitch, -deltaPitch);
        }
        if (this.keys.get('ArrowDown')) {
            this.updatePitch(this.pitch, deltaPitch);
        }
        if (this.keys.get('ArrowRight')) {
            this.updateYaw(this.yaw, -deltaYaw);
        }
        if (this.keys.get('ArrowLeft')) {
            this.updateYaw(this.yaw, deltaYaw);
        }

        // joystick controls
        if (this.positionJoystickEvent) {
            const moveX = this.positionJoystickEvent.x || 0;
            const moveY = this.positionJoystickEvent.y || 0;

            this.moveCamera(moveX * 32 * -deltaTime, 0, moveY * 32 * -deltaTime);
        }

        if (this.cameraJoystickEvent) {
            const moveX = this.cameraJoystickEvent.x || 0;
            const moveY = this.cameraJoystickEvent.y || 0;
            this.updatePitch(this.pitch, deltaPitch * -1.5 * moveY);
            this.updateYaw(this.yaw, deltaYaw * -1.5 * moveX);
        }

        // mouse/touch controls
        if (this.startMouseX !== -1 && this.startMouseY !== -1) {
            const deltaMouseX = this.startMouseX - this.currentMouseX;
            const deltaMouseY = this.startMouseY - this.currentMouseY;

            if (this.isTouchDevice) {
                this.moveCamera(0, clamp(deltaMouseY, -100, 100) * 0.004, 0);
            } else {
                this.updatePitch(this.startPitch, deltaMouseY * 0.6);
                this.updateYaw(this.startYaw, deltaMouseX * -0.9);
            }
        }

        // camera position controls
        if (this.keys.get('w') || this.keys.get('W')) {
            this.moveCamera(0, 0, -16 * cameraSpeedMult * deltaTime);
        }
        if (this.keys.get('a') || this.keys.get('A')) {
            this.moveCamera(16 * cameraSpeedMult * deltaTime, 0, 0);
        }
        if (this.keys.get('s') || this.keys.get('S')) {
            this.moveCamera(0, 0, 16 * cameraSpeedMult * deltaTime);
        }
        if (this.keys.get('d') || this.keys.get('D')) {
            this.moveCamera(-16 * cameraSpeedMult * deltaTime, 0, 0);
        }
        if (this.keys.get('e') || this.keys.get('E')) {
            this.moveCamera(0, 8 * cameraSpeedMult * deltaTime, 0);
        }
        if (this.keys.get('q') || this.keys.get('Q') || this.keys.get('c') || this.keys.get('C')) {
            this.moveCamera(0, -8 * cameraSpeedMult * deltaTime, 0);
        }

        if (this.cameraUpdated) {
            this.runCameraMoveListener();
        }

        if (movedCameraLastFrame && !this.cameraUpdated) {
            this.runCameraMoveEndListener();
        }

        if (this.keys.get('t') && this.timer.ready()) {
            const totalTriangles = Array.from(this.chunks.values()).map(t => t.triangleCount).reduce((a, b) => a + b, 0);

            console.log(this.timer.cpuTime, this.timer.gpuTime, this.chunks.size, 'triangles', totalTriangles);
            console.log(time);
        }


        if (this.keys.get('r') && this.timer.ready()) {
            this.app.enable(PicoGL.RASTERIZER_DISCARD);
        }
        if (this.keys.get('f') && this.timer.ready()) {
            this.app.disable(PicoGL.RASTERIZER_DISCARD);
        }

        if (this.keys.get('p') && this.chunkDataLoader) {
            for (let i = 0; i < 20; i++) {
                this.chunkDataLoader.load(50, 50);

                this.chunkDataLoader.regionLoader.regions.clear();
                this.chunkDataLoader.regionLoader.blendedUnderlayColors.clear();
                this.chunkDataLoader.regionLoader.lightLevels.clear();

                this.chunkDataLoader.objectModelLoader.modelDataCache.clear();
                this.chunkDataLoader.objectModelLoader.modelCache.clear();
            }
        }



        // this.setProjection(0, 0, canvasWidth, canvasHeight, canvasWidth / 2, canvasHeight / 2, 1);
        mat4.identity(this.projectionMatrix);
        mat4.perspective(this.projectionMatrix, Math.PI / 2, canvasWidth / canvasHeight, 0.1, 1024.0 * 4);
        mat4.rotateX(this.projectionMatrix, this.projectionMatrix, Math.PI);

        mat4.identity(this.viewMatrix);
        // const scale = 2;
        // mat4.scale(this.viewMatrix, this.viewMatrix, [scale, scale, 1]);
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


        this.frustumIntersection.setPlanes(this.viewProjMatrix);

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

        const viewDistanceRegionIds = this.viewDistanceRegionIds[this.frameCount % 2];
        const lastViewDistanceRegionIds = this.viewDistanceRegionIds[(this.frameCount + 1) % 2];

        viewDistanceRegionIds.clear();

        if (this.lastCameraRegionX != cameraRegionX || this.lastCameraRegionY != cameraRegionY || this.lastRegionViewDistance != this.regionViewDistance) {
            const regionViewDistance = this.regionViewDistance;

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
                    viewDistanceRegionIds.add(regionId);
                    this.regionPositions.push([regionX, regionY]);
                }
            }

            for (const [regionId, chunk] of this.chunks) {
                if (viewDistanceRegionIds.has(regionId)) {
                    continue;
                }
                const regionX = regionId >> 8;
                const regionY = regionId & 0xFF;
                const xDist = Math.abs(regionX - cameraRegionX);
                const yDist = Math.abs(regionY - cameraRegionY);
                const dist = Math.max(xDist, yDist);
                if (dist >= this.regionViewDistance + this.regionUnloadDistance - 1) {
                    deleteChunk(chunk);
                    this.chunks.delete(regionId);
                    console.log('deleting chunk ', dist, this.regionViewDistance, this.regionUnloadDistance, chunk);
                }
            }
        }


        this.timer.start();

        if (this.lastCameraX != cameraX || this.lastCameraY != cameraY || this.lastRegionViewDistance != this.regionViewDistance) {
            // sort front to back
            this.regionPositions.sort((a, b) => {
                const regionDistA = getRegionDistance(cameraX, cameraY, a);
                const regionDistB = getRegionDistance(cameraX, cameraY, b);
                return regionDistA - regionDistB;
            });
        }

        let renderedChunks = 0;

        // draw back to front
        for (let i = this.regionPositions.length - 1; i >= 0; i--) {
            const pos = this.regionPositions[i];
            const regionId = RegionLoader.getRegionId(pos[0], pos[1]);
            const chunk = this.chunks.get(regionId);
            viewDistanceRegionIds.add(regionId);
            if (!chunk || !this.isChunkVisible(pos[0], pos[1]) || (this.frameCount - chunk.frameLoaded) < 4) {
                continue;
            }

            renderedChunks++;

            const regionDist = Math.max(Math.abs(cameraRegionX - chunk.regionX), Math.abs(cameraRegionY - chunk.regionY));

            const isLowDetail = regionDist >= 3;
            let drawRangeOffset = 0;
            if (isLowDetail) {
                drawRangeOffset = chunk.drawRangesLowDetail.length - chunk.drawRanges.length;
            }

            const drawCall = isLowDetail ? chunk.drawCallLowDetail : chunk.drawCall;

            // fade in chunks even if it loaded a while ago
            if (!lastViewDistanceRegionIds.has(regionId)) {
                chunk.timeLoaded = time;
            }

            drawCall.uniform('u_currentTime', time);
            drawCall.uniform('u_timeLoaded', chunk.timeLoaded);
            drawCall.uniform('u_deltaTime', deltaTime);
            drawCall.uniform('u_brightness', this.brightness);
            drawCall.uniform('u_colorBanding', this.colorBanding);

            const drawRanges = isLowDetail ? chunk.drawRangesLowDetail : chunk.drawRanges;

            for (const animatedModel of chunk.animatedModels) {
                const frameId = animatedModel.getFrame(cycle);

                const frame = animatedModel.frames[frameId];

                (drawCall as any).offsets[animatedModel.drawRangeIndex + drawRangeOffset] = frame[0];
                (drawCall as any).numElements[animatedModel.drawRangeIndex + drawRangeOffset] = frame[1];

                drawRanges[animatedModel.drawRangeIndex + drawRangeOffset] = frame;
            }

            if (this.hasMultiDraw) {
                drawCall.draw();
            } else {
                for (let i = 0; i < drawRanges.length; i++) {
                    drawCall.uniform('u_drawId', i);
                    drawCall.drawRanges(drawRanges[i]);
                    drawCall.draw();
                }
            }
        }

        if (this.keys.get('h')) {
            console.log('rendered chunks', renderedChunks, this.frustumIntersection.planes);
        }

        for (const regionPos of this.regionPositions) {
            this.queueChunkLoad(regionPos[0], regionPos[1]);
        }

        // TODO: upload x bytes per frame
        if (this.frameCount % 30 || this.chunks.size === 0) {
            const chunkData = this.chunksToLoad.shift();
            if (chunkData) {
                // console.log('loaded', chunkData.regionX, chunkData.regionY, performance.now())
                const regionId = RegionLoader.getRegionId(chunkData.regionX, chunkData.regionY);
                this.chunks.set(regionId,
                    loadChunk(this.app, this.program, this.animationLoader, this.textureArray, this.textureUniformBuffer, this.sceneUniformBuffer, chunkData,
                        this.frameCount, cycle));
                this.loadingRegionIds.delete(regionId);
            }
        }

        this.timer.end();

        this.frameCount++;

        this.lastRegionViewDistance = this.regionViewDistance;

        this.lastCullBackFace = this.cullBackFace;

        this.lastCameraX = cameraX;
        this.lastCameraY = cameraY;
        this.lastCameraRegionX = cameraRegionX;
        this.lastCameraRegionY = cameraRegionY;
    }
}

function formatBytes(bytes: number, decimals: number = 2): string {
    if (!+bytes) {
        return '0 Bytes';
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

interface MapViewerContainerProps {
    mapViewer: MapViewer;
}

function MapViewerContainer({ mapViewer }: MapViewerContainerProps) {
    const [fps, setFps] = useState<number>(0);
    const [compassDegrees, setCompassDegrees] = useState<number>(0);

    const isTouchDevice = !!(navigator.maxTouchPoints || 'ontouchstart' in document.documentElement);

    const positionControls = isTouchDevice ? 'Left joystick, Drag up and down.' : 'WASD, E (up), C (down)\nUse SHIFT to go faster.';
    const directionControls = isTouchDevice ? 'Right joystick.' : 'Arrow Keys or Click and Drag.';

    const data = useControls({
        'Camera Controls': folder({
            'Position': { value: positionControls, editable: false },
            'Direction': { value: directionControls, editable: false }
        }, { collapsed: false }),
        'View Distance': { value: 1, min: 1, max: 30, step: 1, onChange: (v) => { mapViewer.regionViewDistance = v; } },
        'Unload Distance': { value: 2, min: 1, max: 30, step: 1, onChange: (v) => { mapViewer.regionUnloadDistance = v; } },
        'Brightness': { value: 1, min: 0, max: 4, step: 1, onChange: (v) => { mapViewer.brightness = 1.0 - v * 0.1; } },
        'Color Banding': { value: 50, min: 0, max: 100, step: 1, onChange: (v) => { mapViewer.colorBanding = 255 - v * 2; } },
        'Cull Back-faces': { value: true, onChange: (v) => { mapViewer.cullBackFace = v; } },
    });

    useEffect(() => {
        mapViewer.fpsListener = setFps;
        mapViewer.cameraMoveListener = (pos, pitch, yaw) => {
            setCompassDegrees((2047 - yaw) * RS_TO_DEGREES);
        };
        mapViewer.runCameraMoveListener();
    }, [mapViewer]);

    return (
        <div>
            <Leva titleBar={{ filter: false }} collapsed={true} hideCopyButton={true} />
            <div className='hud left-top'>
                <div className='fps-counter'>{fps.toFixed(1)}</div>
                <img className='compass' style={{ transform: `rotate(${compassDegrees}deg)` }} src='/compass.png' onClick={() => {
                    mapViewer.yaw = 0;
                    mapViewer.runCameraListeners();
                }} />
            </div>
            {isTouchDevice && <div className='joystick-container left'>
                <Joystick size={75} baseColor='#181C20' stickColor='#007BFF' stickSize={40} move={mapViewer.onPositionJoystickMove} stop={mapViewer.onPositionJoystickStop}></Joystick>
            </div>}
            {isTouchDevice && <div className='joystick-container right'>
                <Joystick size={75} baseColor='#181C20' stickColor='#007BFF' stickSize={40} move={mapViewer.onCameraJoystickMove} stop={mapViewer.onCameraJoystickStop}></Joystick>
            </div>}
            <WebGLCanvas init={mapViewer.init} draw={mapViewer.render}></WebGLCanvas>
        </div>
    );
}

const poolSize = Math.min(navigator.hardwareConcurrency, 4);
const pool = ChunkLoaderWorkerPool.init(poolSize);
// console.log('start App', performance.now());

function MapViewerApp() {
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | undefined>(undefined);
    const [mapViewer, setMapViewer] = useState<MapViewer | undefined>(undefined);
    const [searchParams, setSearchParams] = useSearchParams();


    // const test = new Test();

    useEffect(() => {
        // console.log('start fetch', performance.now());
        console.time('first load');
        const load = async () => {
            const cachePath = '/cache212/';
            const xteaPromise = fetch(cachePath + 'keys.json').then(resp => resp.json());
            const store = await fetchMemoryStore(cachePath, [
                IndexType.ANIMATIONS,
                IndexType.SKELETONS,
                IndexType.CONFIGS,
                IndexType.MAPS,
                IndexType.MODELS,
                IndexType.SPRITES,
                IndexType.TEXTURES
            ], true, setDownloadProgress);
            setDownloadProgress(undefined);

            console.time('load xteas');
            const xteas: { [group: string]: number[] } = await xteaPromise;
            const xteasMap: Map<number, number[]> = new Map(Object.keys(xteas).map(key => [parseInt(key), xteas[key]]));
            console.timeEnd('load xteas');
            console.log('xtea count: ', xteasMap.size);

            // const poolSize = 1;
            // const poolSize = navigator.hardwareConcurrency;

            // const pool = ChunkLoaderWorkerPool.init(store, xteasMap, poolSize);
            pool.init(store, xteasMap);

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

            const mapViewer = new MapViewer(fileSystem, xteasMap, pool);
            const cx = searchParams.get('cx');
            const cy = searchParams.get('cy');
            const cz = searchParams.get('cz');

            const pitch = searchParams.get('p');
            const yaw = searchParams.get('y');

            if (cx && cy && cz) {
                const pos: vec3 = [
                    -parseFloat(cx),
                    parseFloat(cy),
                    -parseFloat(cz)
                ];
                mapViewer.cameraPos = pos;
            }
            if (pitch) {
                mapViewer.pitch = parseInt(pitch);
            }
            if (yaw) {
                mapViewer.yaw = parseInt(yaw);
            }

            mapViewer.cameraMoveEndListener = (pos, pitch, yaw) => {
                const cx = (-pos[0].toFixed(2)).toString();
                const cy = (pos[1].toFixed(2)).toString();
                const cz = (-pos[2].toFixed(2)).toString();

                const p = (pitch | 0).toString();
                const y = (yaw | 0).toString();

                setSearchParams({ cx, cy, cz, p, y }, { replace: true });
            };

            setMapViewer(mapViewer);
        };

        load().catch(console.error);
    }, []);

    let content: JSX.Element | undefined = undefined;
    if (mapViewer) {
        content = <MapViewerContainer mapViewer={mapViewer}></MapViewerContainer>
    } else if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress = downloadProgress.current / downloadProgress.total * 100 | 0;
        content = (
            <div className='loading-bar-container'>
                <OsrsLoadingBar text={`Downloading cache (${formattedCacheSize})`} progress={progress} />
            </div>
        );
    }
    return (
        <div className="App">
            {content}
        </div>
    );
}

export default MapViewerApp;
