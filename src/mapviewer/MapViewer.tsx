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
import { AnimatedModelData, ChunkData, ChunkDataLoader, NpcData } from './chunk/ChunkDataLoader';
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
import npcVertShader from './shaders/npc.vert.glsl';
import mainFragShader from './shaders/main.frag.glsl';
import { clamp } from '../client/util/MathUtil';
import { ChunkLoaderWorkerPool } from './chunk/ChunkLoaderWorkerPool';
import { AnimationDefinition } from '../client/fs/definition/AnimationDefinition';
import { CachedNpcLoader, NpcLoader } from '../client/fs/loader/NpcLoader';
import { NpcDefinition } from '../client/fs/definition/NpcDefinition';
import { CollisionMap } from '../client/pathfinder/collision/CollisionMap';
import { Pathfinder } from '../client/pathfinder/Pathfinder';
import { ExactRouteStrategy } from '../client/pathfinder/RouteStrategy';

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

const NPC_DATA_TEXTURE_BUFFER_SIZE = 5;
const CHUNK_RENDER_FRAME_DELAY = 4;

type Chunk = {
    regionX: number,
    regionY: number,

    tileRenderFlags: Uint8Array[][],
    collisionMaps: CollisionMap[],

    modelMatrix: mat4,

    triangleCount: number,

    drawRanges: number[][],
    drawRangesLowDetail: number[][],
    drawRangesAlpha: number[][],

    drawRangesNpc: number[][],

    drawCall: DrawCall,
    drawCallLowDetail: DrawCall,
    drawCallAlpha: DrawCall,

    drawCallNpc: DrawCall | undefined,

    animatedModels: AnimatedModel[],
    npcs: Npc[],

    interleavedBuffer: VertexBuffer,
    indexBuffer: VertexBuffer,
    vertexArray: VertexArray,
    modelDataTexture: Texture,
    modelDataTextureAlpha: Texture,

    npcDataTextureOffsets: number[],

    heightMapTexture: Texture,

    timeLoaded: number,
    frameLoaded: number,
}

class AnimatedModel {
    drawRangeIndex: number;
    drawRangeAlphaIndex: number;

    frames: number[][];
    framesAlpha: number[][] | undefined;

    animationDef?: AnimationDefinition;

    frame: number = 0;

    cycleStart: number = 0;

    constructor(drawRangeIndex: number, drawRangeAlphaIndex: number, frames: number[][], framesAlpha: number[][] | undefined,
        animationDef: AnimationDefinition, cycle: number, randomStart: boolean) {
        this.drawRangeIndex = drawRangeIndex;
        this.drawRangeAlphaIndex = drawRangeAlphaIndex;
        this.frames = frames;
        this.framesAlpha = framesAlpha;
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
                    this.frame = 0;
                    this.cycleStart = cycle - 1;
                    // this.animationDef = undefined;
                    // return 0;
                }
                continue;
            }
        }

        this.cycleStart = cycle - elapsed;
        return this.frame;
    }
}

enum MovementType {
    CRAWL = 0,
    WALK = 1,
    RUN = 2,
}

class Npc {
    data: NpcData;

    def: NpcDefinition;

    rotation: number = 0;
    orientation: number = 0;

    pathX: number[] = new Array(10);
    pathY: number[] = new Array(10);
    pathMovementType: MovementType[] = new Array(10);
    pathLength: number = 0;

    serverPathX: number[] = new Array(25);
    serverPathY: number[] = new Array(25);
    serverPathMovementType: MovementType[] = new Array(25);
    serverPathLength: number = 0;

    x: number;
    y: number;

    movementAnimation: number = -1;
    movementFrame: number = 0;
    movementFrameTick: number = 0;
    movementLoop: number = 0;

    constructor(data: NpcData, def: NpcDefinition) {
        this.data = data;
        this.def = def;

        this.rotation = 0;

        this.pathX[0] = clamp(data.tileX, 0, 64 - this.def.size);
        this.pathY[0] = clamp(data.tileY, 0, 64 - this.def.size);

        this.x = this.pathX[0] * 128 + this.def.size * 64;
        this.y = this.pathY[0] * 128 + this.def.size * 64;
    }

    queuePathDir(dir: number, movementType: MovementType) {
        let x = this.pathX[0];
        let y = this.pathY[0];
        switch (dir) {
            case 0:
                --x;
                ++y;
                break;
            case 1:
                ++y;
                break;
            case 2:
                ++x;
                ++y;
                break;
            case 3:
                --x;
                break;
            case 4:
                ++x;
                break;
            case 5:
                --x;
                --y;
                break;
            case 6:
                --y;
                break;
            case 7:
                ++x;
                --y;
                break;
        }

        if (this.pathLength < 9) {
            this.pathLength++;
        }

        for (let i = this.pathLength; i > 0; i--) {
            this.pathX[i] = this.pathX[i - 1];
            this.pathY[i] = this.pathY[i - 1];
            this.pathMovementType[i] = this.pathMovementType[i - 1];
        }

        this.pathX[0] = clamp(x, 0, 64 - this.def.size - 1);
        this.pathY[0] = clamp(y, 0, 64 - this.def.size - 1);
        this.pathMovementType[0] = movementType;
    }

    queuePath(x: number, y: number, movementType: MovementType) {
        if (this.pathLength < 9) {
            this.pathLength++;
        }

        for (let i = this.pathLength; i > 0; i--) {
            this.pathX[i] = this.pathX[i - 1];
            this.pathY[i] = this.pathY[i - 1];
            this.pathMovementType[i] = this.pathMovementType[i - 1];
        }

        this.pathX[0] = clamp(x, 0, 64 - this.def.size - 1);
        this.pathY[0] = clamp(y, 0, 64 - this.def.size - 1);
        this.pathMovementType[0] = movementType;
    }

    updateMovement(animationLoader: AnimationLoader) {
        this.movementAnimation = this.def.idleSequence;
        if (this.pathLength > 0) {
            const currX = this.x;
            const currY = this.y;
            const nextX = this.pathX[this.pathLength - 1] * 128 + this.def.size * 64;
            const nextY = this.pathY[this.pathLength - 1] * 128 + this.def.size * 64;

            if (currX < nextX) {
                if (currY < nextY) {
                    this.orientation = 1280;
                } else if (currY > nextY) {
                    this.orientation = 1792;
                } else {
                    this.orientation = 1536;
                }
            } else if (currX > nextX) {
                if (currY < nextY) {
                    this.orientation = 768;
                } else if (currY > nextY) {
                    this.orientation = 256;
                } else {
                    this.orientation = 512;
                }
            } else if (currY < nextY) {
                this.orientation = 1024;
            } else if (currY > nextY) {
                this.orientation = 0;
            }

            this.movementAnimation = this.def.walkSequence;

            const movementType = this.pathMovementType[this.pathLength - 1];
            if (nextX - currX <= 256 && nextX - currX >= -256 && nextY - currY <= 256 && nextY - currY >= -256) {
                let movementSpeed = 4;

                if (this.def.isClickable) {
                    if (this.rotation !== this.orientation && this.def.rotationSpeed !== 0) {
                        movementSpeed = 2;
                    }
                    if (this.pathLength > 2) {
                        movementSpeed = 6;
                    }
                    if (this.pathLength > 3) {
                        movementSpeed = 8;
                    }
                } else {
                    if (this.pathLength > 1) {
                        movementSpeed = 6;
                    }
                    if (this.pathLength > 2) {
                        movementSpeed = 8;
                    }
                }

                if (movementType === MovementType.RUN) {
                    movementSpeed <<= 1;
                } else if (movementType === MovementType.CRAWL) {
                    movementSpeed >>= 1;
                }

                if (currX !== nextX || currY !== nextY) {
                    if (currX < nextX) {
                        this.x += movementSpeed;
                        if (this.x > nextX) {
                            this.x = nextX;
                        }
                    } else if (currX > nextX) {
                        this.x -= movementSpeed;
                        if (this.x < nextX) {
                            this.x = nextX;
                        }
                    }

                    if (currY < nextY) {
                        this.y += movementSpeed;
                        if (this.y > nextY) {
                            this.y = nextY;
                        }
                    } else if (currY > nextY) {
                        this.y -= movementSpeed;
                        if (this.y < nextY) {
                            this.y = nextY;
                        }
                    }
                }

                if (this.x === nextX && this.y === nextY) {
                    this.pathLength--;
                }
            } else {
                this.x = nextX;
                this.y = nextY;
                this.pathLength--;
            }
        }

        const deltaRotation = this.orientation - this.rotation & 2047;
        if (deltaRotation !== 0) {
            const rotateDir = deltaRotation > 1024 ? -1 : 1;
            this.rotation += rotateDir * this.def.rotationSpeed;
            if (deltaRotation < this.def.rotationSpeed || deltaRotation > 2048 - this.def.rotationSpeed) {
                this.rotation = this.orientation;
            }

            this.rotation &= 2047;
        }

        this.updateMovementAnim(animationLoader);
    }

    updateMovementAnim(animationLoader: AnimationLoader) {
        if (this.movementAnimation !== -1) {
            const anim = animationLoader.getDefinition(this.movementAnimation);
            if (!anim.isAnimMaya() && anim.frameIds) {
                this.movementFrameTick++;
                if (this.movementFrame < anim.frameIds.length && this.movementFrameTick > anim.frameLengths[this.movementFrame]) {
                    this.movementFrameTick = 1;
                    this.movementFrame++;
                }

                if (this.movementFrame >= anim.frameIds.length) {
                    if (anim.frameStep > 0) {
                        this.movementFrame -= anim.frameStep;
                        if (anim.looping) {
                            this.movementLoop++;
                        }

                        if (this.movementFrame < 0 || this.movementFrame >= anim.frameIds.length || anim.looping && this.movementLoop >= anim.maxLoops) {
                            this.movementFrameTick = 0;
                            this.movementFrame = 0;
                            this.movementLoop = 0;
                        } else {
                            this.movementFrameTick = 0;
                            this.movementFrame = 0;
                        }
                    } else {
                        this.movementFrameTick = 0;
                        this.movementFrame = 0;
                    }
                }
            }
        }
    }
}

function loadChunk(app: PicoApp, program: Program, programNpc: Program, npcLoader: NpcLoader, animationLoader: AnimationLoader,
    textureArray: Texture, textureUniformBuffer: UniformBuffer, sceneUniformBuffer: UniformBuffer, chunkData: ChunkData,
    frame: number, cycle: number): Chunk {
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

    const modelDataTexture = app.createTexture2D(new Uint8Array(chunkData.modelTextureData.buffer), 16, Math.max(Math.ceil(chunkData.modelTextureData.length / 16), 1),
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    const modelDataTextureAlpha = app.createTexture2D(new Uint8Array(chunkData.modelTextureDataAlpha.buffer), 16, Math.max(Math.ceil(chunkData.modelTextureDataAlpha.length / 16), 1),
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    const heightMapTexture = app.createTextureArray(chunkData.heightMapTextureData, 72, 72, Scene.MAX_PLANE,
        {
            internalFormat: PicoGL.R32F, minFilter: PicoGL.LINEAR, magFilter: PicoGL.LINEAR, type: PicoGL.FLOAT,
            wrapS: PicoGL.CLAMP_TO_EDGE, wrapT: PicoGL.CLAMP_TO_EDGE
        }
    );

    const time = performance.now() * 0.001;

    const drawCall = app.createDrawCall(program, vertexArray)
        .uniformBlock('TextureUniforms', textureUniformBuffer)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time)
        .uniform('u_modelMatrix', baseModelMatrix)
        .uniform('u_drawIdOffset', 0)
        .texture('u_textures', textureArray)
        .texture('u_modelDataTexture', modelDataTexture)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRanges);

    const drawCallLowDetail = app.createDrawCall(program, vertexArray)
        .uniformBlock('TextureUniforms', textureUniformBuffer)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time)
        .uniform('u_modelMatrix', baseModelMatrix)
        .uniform('u_drawIdOffset', chunkData.drawRanges.length - chunkData.drawRangesLowDetail.length)
        .texture('u_textures', textureArray)
        .texture('u_modelDataTexture', modelDataTexture)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRangesLowDetail);

    const drawCallAlpha = app.createDrawCall(program, vertexArray)
        .uniformBlock('TextureUniforms', textureUniformBuffer)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time)
        .uniform('u_modelMatrix', baseModelMatrix)
        .uniform('u_drawIdOffset', 0)
        .texture('u_textures', textureArray)
        .texture('u_modelDataTexture', modelDataTextureAlpha)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRangesAlpha);

    const animatedModels: AnimatedModel[] = [];
    for (const animatedModel of chunkData.animatedModels) {
        const animationDef = animationLoader.getDefinition(animatedModel.animationId);
        animatedModels.push(new AnimatedModel(animatedModel.drawRangeIndex, animatedModel.drawRangeAlphaIndex, animatedModel.frames, animatedModel.framesAlpha,
            animationDef, cycle, animatedModel.randomStart))
    }

    const npcs: Npc[] = [];
    for (const npcData of chunkData.npcs) {
        npcs.push(new Npc(npcData, npcLoader.getDefinition(npcData.id)));
    }

    let drawCallNpc: DrawCall | undefined = undefined;
    if (npcs.length > 0) {
        drawCallNpc = app.createDrawCall(programNpc, vertexArray)
            .uniformBlock('TextureUniforms', textureUniformBuffer)
            .uniformBlock('SceneUniforms', sceneUniformBuffer)
            .uniform('u_timeLoaded', time)
            .uniform('u_modelMatrix', baseModelMatrix)
            .uniform('u_npcDataOffset', 0)
            .texture('u_textures', textureArray)
            .texture('u_heightMap', heightMapTexture)
            .drawRanges(...chunkData.drawRangesNpc);
    }

    // console.log(chunkData.collisionFlags.find(flags => flags.find(x => (x & 0x1000000) !== 0)));
    const collisionMaps = chunkData.collisionFlags.map(flags => {
        // TODO: create constructor with flags
        const map = new CollisionMap(Scene.MAP_SIZE, Scene.MAP_SIZE);
        map.flags = flags;
        return map;
    });

    for (const npc of npcs) {
        const collisionMap = collisionMaps[npc.data.plane];

        const currentX = npc.pathX[0];
        const currentY = npc.pathY[0];

        const size = npc.def.size;

        for (let flagX = currentX; flagX < currentX + size; flagX++) {
            for (let flagY = currentY; flagY < currentY + size; flagY++) {
                collisionMap.flag(flagX, flagY, 0x1000000);
            }
        }
    }

    return {
        regionX,
        regionY,

        tileRenderFlags: chunkData.tileRenderFlags,
        collisionMaps,

        modelMatrix: baseModelMatrix,

        triangleCount: chunkData.indices.length / 3,
        drawRanges: chunkData.drawRanges,
        drawRangesLowDetail: chunkData.drawRangesLowDetail,
        drawRangesAlpha: chunkData.drawRangesAlpha,

        drawRangesNpc: chunkData.drawRangesNpc,

        drawCall,
        drawCallLowDetail,
        drawCallAlpha,

        drawCallNpc,

        animatedModels,
        npcs,

        interleavedBuffer,
        indexBuffer,
        vertexArray,
        modelDataTexture,
        modelDataTextureAlpha,
        npcDataTextureOffsets: new Array(NPC_DATA_TEXTURE_BUFFER_SIZE),
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
    chunk.modelDataTextureAlpha.delete();
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

    npcLoader: NpcLoader;
    animationLoader: AnimationLoader;

    pathfinder: Pathfinder = new Pathfinder();

    // chunkDataLoader: ChunkDataLoader;

    app!: PicoApp;

    hasMultiDraw: boolean = false;

    keys: Map<string, boolean> = new Map();

    isTouchDevice: boolean = false;

    timer!: Timer;

    program?: Program;
    programNpc?: Program;

    textureUniformBuffer!: UniformBuffer;
    sceneUniformBuffer!: UniformBuffer;

    textureArray!: Texture;

    chunks: Map<number, Chunk> = new Map();

    pitch: number = 245;
    yaw: number = 186;

    cameraPos: vec3 = vec3.fromValues(-3242, 26, -3202);

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
    lastClientTick: number = 0;
    lastTick: number = 0;

    fpsListener?: (fps: number) => void;
    cameraMoveListener?: (pos: vec3, pitch: number, yaw: number) => void;
    cameraMoveEndListener?: (pos: vec3, pitch: number, yaw: number) => void;

    regionViewDistance: number = 1;
    regionLodDistance: number = 1;
    regionUnloadDistance: number = 1;

    lastRegionViewDistance: number = -1;

    viewDistanceRegionIds: Set<number>[] = [new Set(), new Set()];

    visibleChunkCount: number = 0;
    visibleChunks: Chunk[] = [];

    brightness: number = 1.0;
    colorBanding: number = 255;

    loadNpcs: boolean = false;

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

    npcRenderCount: number = 0;
    npcRenderData: Uint16Array = new Uint16Array(16 * 4);

    npcRenderDataTexture: Texture | undefined;
    npcDataTextureBuffer: (Texture | undefined)[] = new Array(5);

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
        const npcArchive = configIndex.getArchive(ConfigType.NPC);
        const animationArchive = configIndex.getArchive(ConfigType.SEQUENCE);

        // console.time('region loader');
        // const underlayLoader = new CachedUnderlayLoader(underlayArchive);
        // const overlayLoader = new CachedOverlayLoader(overlayArchive);
        // const objectLoader = new CachedObjectLoader(objectArchive);
        this.npcLoader = new CachedNpcLoader(npcArchive);
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
        if (!(gl.canvas instanceof HTMLCanvasElement)) {
            return;
        }

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

        app.createPrograms([
            prependShader(mainVertShader, this.hasMultiDraw),
            prependShader(mainFragShader, this.hasMultiDraw)
        ], [
            prependShader(npcVertShader, this.hasMultiDraw),
            prependShader(mainFragShader, this.hasMultiDraw)
        ]).then(([program, programNpc]) => {
            this.program = program;
            this.programNpc = programNpc;
        });

        this.textureUniformBuffer = app.createUniformBuffer(new Array(128 * 2).fill(PicoGL.FLOAT_VEC2));
        this.sceneUniformBuffer = app.createUniformBuffer([PicoGL.FLOAT_MAT4, PicoGL.FLOAT_MAT4, PicoGL.FLOAT_MAT4]);

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

            this.chunkLoaderWorker.pool.queue(worker => worker.load(regionX, regionY, !this.hasMultiDraw, this.loadNpcs)).then(chunkData => {
                if (chunkData) {
                    this.chunksToLoad.push(chunkData);
                } else {
                    this.invalidRegionIds.add(regionId);
                }
            });
        }
    }

    setLoadNpcs(load: boolean) {
        this.loadNpcs = load;
        for (const chunk of this.chunks.values()) {
            deleteChunk(chunk);
        }
        this.chunks.clear();
    }

    updateCullFace() {
        if (this.cullBackFace) {
            this.app.enable(PicoGL.CULL_FACE);
        } else {
            this.app.disable(PicoGL.CULL_FACE);
        }
    }

    setFps(fps: number) {
        this.fps = fps;
        if (this.fpsListener) {
            this.fpsListener(this.fps);
        }
    }

    addNpcRenderData(chunk: Chunk, npcs: Npc[]) {
        if (npcs.length === 0) {
            return;
        }

        chunk.npcDataTextureOffsets[this.frameCount % chunk.npcDataTextureOffsets.length] = this.npcRenderCount;

        const newCount = this.npcRenderCount + npcs.length;

        if (this.npcRenderData.length / 4 < newCount) {
            const newData = new Uint16Array(Math.ceil(newCount * 2 / 16) * 16 * 4);
            newData.set(this.npcRenderData);
            this.npcRenderData = newData;
            console.log('expand npc render data', this.npcRenderData.length, newCount, this.npcRenderCount);
        }

        npcs.forEach((npc, i) => {
            let offset = this.npcRenderCount * 4;

            const tileX = npc.x >> 7;
            const tileY = npc.y >> 7;

            let renderPlane = npc.data.plane;
            if (renderPlane < 3 && (chunk.tileRenderFlags[1][tileX][tileY] & 0x2) === 2) {
                renderPlane = npc.data.plane + 1;
            }

            this.npcRenderData[offset++] = npc.x;
            this.npcRenderData[offset++] = npc.y;
            this.npcRenderData[offset++] = renderPlane;
            this.npcRenderData[offset++] = npc.rotation;

            this.npcRenderCount++;
        });
    }

    render(gl: WebGL2RenderingContext, time: DOMHighResTimeStamp, resized: boolean) {
        time *= 0.001;
        const deltaTime = time - this.lastFrameTime;
        this.lastFrameTime = time;

        this.setFps(1.0 / deltaTime);

        const cycle = time / 0.02;

        const clientTick = Math.floor(time / 0.02);
        const clientTicksElapsed = clientTick - this.lastClientTick;
        if (clientTicksElapsed > 0) {
            this.lastClientTick = clientTick;
        }

        const tick = Math.floor(time / 0.6);
        const ticksElapsed = Math.min(tick - this.lastTick, 10);
        if (ticksElapsed > 0) {
            this.lastTick = tick;
        }

        const canvasWidth = gl.canvas.width;
        const canvasHeight = gl.canvas.height;

        if (resized) {
            this.app.resize(canvasWidth, canvasHeight);
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (!this.program || !this.programNpc) {
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
                this.chunkDataLoader.load(50, 50, false, false);

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
        // const factor = 15;
        // mat4.ortho(this.projectionMatrix, 
        //     -canvasWidth / factor,
        //     canvasWidth / factor, 
        //     -canvasHeight / factor, 
        //     canvasHeight / factor,
        //     -1024.0 * 8, 1024.0 * 8);
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
            .set(1, this.viewMatrix as Float32Array)
            .set(2, this.projectionMatrix as Float32Array)
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

        this.visibleChunkCount = 0;

        this.npcRenderCount = 0;
        const strategy = new ExactRouteStrategy();

        // draw back to front
        for (let i = this.regionPositions.length - 1; i >= 0; i--) {
            const pos = this.regionPositions[i];
            const regionId = RegionLoader.getRegionId(pos[0], pos[1]);
            const chunk = this.chunks.get(regionId);
            viewDistanceRegionIds.add(regionId);
            if (!chunk || !this.isChunkVisible(pos[0], pos[1]) || this.frameCount - chunk.frameLoaded < CHUNK_RENDER_FRAME_DELAY) {
                continue;
            }

            // fade in chunks even if it loaded a while ago
            if (!lastViewDistanceRegionIds.has(regionId)) {
                chunk.timeLoaded = time;
            }

            for (const animatedModel of chunk.animatedModels) {
                // advance frame
                animatedModel.getFrame(cycle);
            }

            for (let t = 0; t < ticksElapsed; t++) {
                for (const npc of chunk.npcs) {
                    const canWalk = npc.def.walkSequence !== -1 && npc.def.walkSequence !== npc.def.idleSequence;
                    const collisionMap = chunk.collisionMaps[npc.data.plane];
                    const size = npc.def.size;

                    if (canWalk && Math.random() < 0.1) {
                        const deltaX = Math.round(Math.random() * 10.0 - 5.0);
                        const deltaY = Math.round(Math.random() * 10.0 - 5.0);

                        const srcX = npc.pathX[0];
                        const srcY = npc.pathY[0];

                        const spawnX = npc.data.tileX;
                        const spawnY = npc.data.tileY;
                        // deltaX = 0;
                        // deltaY = -1;

                        // deltaX = clamp(deltaX, -1, 1);
                        // deltaY = clamp(deltaY, -1, 1);

                        const targetX = clamp(spawnX + deltaX, 0, 64 - size - 1);
                        const targetY = clamp(spawnY + deltaY, 0, 64 - size - 1);

                        // srcX += baseX;
                        // srcY += baseY;
                        // targetX += baseX;
                        // targetY += baseY;

                        strategy.approxDestX = targetX;
                        strategy.approxDestY = targetY;
                        strategy.destSizeX = 1;
                        strategy.destSizeY = 1;

                        this.pathfinder.setCollisionFlags(srcX, srcY, npc.data.tileX, npc.data.tileY, 5, collisionMap);

                        // console.log(this.pathfinder.flags);

                        // console.log(this.pathfinder.flags);

                        let steps = this.pathfinder.findPath(srcX, srcY, size, npc.data.plane, strategy, true);
                        if (steps > 0) {
                            if (steps > 24) {
                                steps = 24;
                            }
                            for (let s = 0; s < steps; s++) {
                                npc.serverPathX[s] = this.pathfinder.bufferX[s];
                                npc.serverPathY[s] = this.pathfinder.bufferY[s];
                                npc.serverPathMovementType[s] = MovementType.WALK;
                            }
                            npc.serverPathLength = steps;
                            // console.log(steps, targetX, targetY, chunk.collisionMaps[npc.data.plane].getFlag(targetX, targetY), npc);
                        } else {

                            // console.log('failed', steps, targetX, targetY, chunk.collisionMaps[npc.data.plane].getFlag(targetX, targetY), npc);
                        }
                    }


                    if (npc.serverPathLength > 0) {
                        const currentX = npc.pathX[0];
                        const currentY = npc.pathY[0];
                        const targetX = npc.serverPathX[npc.serverPathLength - 1];
                        const targetY = npc.serverPathY[npc.serverPathLength - 1];
                        const deltaX = clamp(targetX - currentX, -1, 1);
                        const deltaY = clamp(targetY - currentY, -1, 1);
                        // const deltaX = 0;
                        // const deltaY = 0;
                        const nextX = currentX + deltaX;
                        const nextY = currentY + deltaY;

                        for (let flagX = currentX; flagX < currentX + size; flagX++) {
                            for (let flagY = currentY; flagY < currentY + size; flagY++) {
                                collisionMap.unflag(flagX, flagY, 0x1000000);
                            }
                        }

                        let canMove = true;
                        exit: for (let flagX = nextX; flagX < nextX + size; flagX++) {
                            for (let flagY = nextY; flagY < nextY + size; flagY++) {
                                if (collisionMap.hasFlag(flagX, flagY, 0x1000000)) {
                                    canMove = false;
                                    break exit;
                                }
                            }
                        }

                        if (canMove) {
                            for (let flagX = nextX; flagX < nextX + size; flagX++) {
                                for (let flagY = nextY; flagY < nextY + size; flagY++) {
                                    collisionMap.flag(flagX, flagY, 0x1000000);
                                }
                            }

                            npc.queuePath(nextX, nextY, MovementType.WALK);
                        } else {
                            for (let flagX = currentX; flagX < currentX + size; flagX++) {
                                for (let flagY = currentY; flagY < currentY + size; flagY++) {
                                    collisionMap.flag(flagX, flagY, 0x1000000);
                                }
                            }
                        }

                        if (nextX === targetX && nextY === targetY) {
                            npc.serverPathLength--;
                        }
                    }

                }
            }

            for (let t = 0; t < clientTicksElapsed; t++) {
                for (const npc of chunk.npcs) {
                    npc.updateMovement(this.animationLoader);
                }
            }

            this.addNpcRenderData(chunk, chunk.npcs);

            this.visibleChunks[this.visibleChunkCount++] = chunk;
        }

        const newNpcDataTextureIndex = this.frameCount % this.npcDataTextureBuffer.length;
        const npcDataTextureIndex = (this.frameCount + 1) % this.npcDataTextureBuffer.length;
        this.npcDataTextureBuffer[newNpcDataTextureIndex]?.delete();
        this.npcDataTextureBuffer[newNpcDataTextureIndex] = this.app.createTexture2D(this.npcRenderData, 16, Math.max(Math.ceil(this.npcRenderCount / 16), 1),
            { internalFormat: PicoGL.RGBA16UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

        const npcRenderDataTexture = this.npcDataTextureBuffer[npcDataTextureIndex];

        // opaque pass
        for (let i = this.visibleChunkCount - 1; i >= 0; i--) {
            const chunk = this.visibleChunks[i];
            const regionDist = Math.max(Math.abs(cameraRegionX - chunk.regionX), Math.abs(cameraRegionY - chunk.regionY));

            const isLowDetail = regionDist >= this.regionLodDistance;
            let drawRangeOffset = 0;
            if (isLowDetail) {
                drawRangeOffset = chunk.drawRangesLowDetail.length - chunk.drawRanges.length;
            }

            const drawCall = isLowDetail ? chunk.drawCallLowDetail : chunk.drawCall;

            drawCall.uniform('u_currentTime', time);
            drawCall.uniform('u_timeLoaded', chunk.timeLoaded);
            drawCall.uniform('u_deltaTime', deltaTime);
            drawCall.uniform('u_brightness', this.brightness);
            drawCall.uniform('u_colorBanding', this.colorBanding);

            const drawRanges = isLowDetail ? chunk.drawRangesLowDetail : chunk.drawRanges;

            for (const animatedModel of chunk.animatedModels) {
                const frameId = animatedModel.frame;

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
        // opaque npc pass
        for (let i = this.visibleChunkCount - 1; i >= 0; i--) {
            const chunk = this.visibleChunks[i];

            const drawCall = chunk.drawCallNpc;
            if (!drawCall || !npcRenderDataTexture) {
                continue;
            }

            drawCall.uniform('u_currentTime', time);
            drawCall.uniform('u_timeLoaded', chunk.timeLoaded);
            drawCall.uniform('u_deltaTime', deltaTime);
            drawCall.uniform('u_brightness', this.brightness);
            drawCall.uniform('u_colorBanding', this.colorBanding);
            drawCall.uniform('u_npcDataOffset', chunk.npcDataTextureOffsets[npcDataTextureIndex]);
            drawCall.texture('u_modelDataTexture', npcRenderDataTexture)

            const drawRanges = chunk.drawRangesNpc;

            chunk.npcs.forEach((npc, i) => {
                const frameId = npc.movementFrame;

                const anim = (npc.data.walkAnim && npc.movementAnimation === npc.def.walkSequence) ? npc.data.walkAnim : npc.data.idleAnim;

                const frame = anim.frames[frameId];

                (drawCall as any).offsets[i] = frame[0];
                (drawCall as any).numElements[i] = frame[1];

                drawRanges[i] = frame;
            });

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

        // alpha pass
        for (let i = 0; i < this.visibleChunkCount; i++) {
            const chunk = this.visibleChunks[i];

            const drawCall = chunk.drawCallAlpha;

            drawCall.uniform('u_currentTime', time);
            drawCall.uniform('u_timeLoaded', chunk.timeLoaded);
            drawCall.uniform('u_deltaTime', deltaTime);
            drawCall.uniform('u_brightness', this.brightness);
            drawCall.uniform('u_colorBanding', this.colorBanding);

            const drawRanges = chunk.drawRangesAlpha;

            for (const animatedModel of chunk.animatedModels) {
                if (animatedModel.framesAlpha) {
                    const frameId = animatedModel.frame;

                    const frame = animatedModel.framesAlpha[frameId];

                    (drawCall as any).offsets[animatedModel.drawRangeAlphaIndex] = frame[0];
                    (drawCall as any).numElements[animatedModel.drawRangeAlphaIndex] = frame[1];

                    drawRanges[animatedModel.drawRangeAlphaIndex] = frame;
                }
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
        // alpha npc pass
        const nullFrame = [0, 0, 0];
        for (let i = 0; i < this.visibleChunkCount; i++) {
            const chunk = this.visibleChunks[i];

            const drawCall = chunk.drawCallNpc;
            if (!drawCall || !npcRenderDataTexture) {
                continue;
            }

            drawCall.uniform('u_currentTime', time);
            drawCall.uniform('u_timeLoaded', chunk.timeLoaded);
            drawCall.uniform('u_deltaTime', deltaTime);
            drawCall.uniform('u_brightness', this.brightness);
            drawCall.uniform('u_colorBanding', this.colorBanding);
            drawCall.uniform('u_npcDataOffset', chunk.npcDataTextureOffsets[npcDataTextureIndex]);
            drawCall.texture('u_modelDataTexture', npcRenderDataTexture)

            const drawRanges = chunk.drawRangesNpc;

            chunk.npcs.forEach((npc, i) => {
                const frameId = npc.movementFrame;

                const anim = (npc.data.walkAnim && npc.movementAnimation === npc.def.walkSequence) ? npc.data.walkAnim : npc.data.idleAnim;

                let frame: number[] = nullFrame;
                if (anim.framesAlpha) {
                    frame = anim.framesAlpha[frameId];
                }

                (drawCall as any).offsets[i] = frame[0];
                (drawCall as any).numElements[i] = frame[1];

                drawRanges[i] = frame;
            });

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
            console.log('rendered chunks', this.visibleChunkCount, this.frustumIntersection.planes);
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
                if (chunkData.loadNpcs === this.loadNpcs) {
                    this.chunks.set(regionId,
                        loadChunk(this.app, this.program, this.programNpc, this.npcLoader, this.animationLoader,
                            this.textureArray, this.textureUniformBuffer, this.sceneUniformBuffer, chunkData,
                            this.frameCount, cycle));
                }
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
        }, { collapsed: isTouchDevice }),
        'Distance': folder({
            'View': { value: 1, min: 1, max: 30, step: 1, onChange: (v) => { mapViewer.regionViewDistance = v; } },
            'Unload': { value: 2, min: 1, max: 30, step: 1, onChange: (v) => { mapViewer.regionUnloadDistance = v; } },
            'Lod': { value: 3, min: 1, max: 30, step: 1, onChange: (v) => { mapViewer.regionLodDistance = v; } },
        }, { collapsed: false }),
        'Npc': folder({
            'Load': { value: false, onChange: (v) => { mapViewer.setLoadNpcs(v); } },
        }, { collapsed: false }),
        'Render Controls': folder({
            'Brightness': { value: 1, min: 0, max: 4, step: 1, onChange: (v) => { mapViewer.brightness = 1.0 - v * 0.1; } },
            'Color Banding': { value: 50, min: 0, max: 100, step: 1, onChange: (v) => { mapViewer.colorBanding = 255 - v * 2; } },
            'Cull Back-faces': { value: true, onChange: (v) => { mapViewer.cullBackFace = v; } },
        }, { collapsed: true }),
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
                <img className='compass' style={{ transform: `rotate(${compassDegrees}deg)` }} src='/compass.png' onClick={() => {
                    mapViewer.yaw = 0;
                    mapViewer.runCameraListeners();
                }} />
                <div className='fps-counter'>{fps.toFixed(1)}</div>
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
