import Denque from "denque";
import { mat4, vec2, vec3 } from "gl-matrix";
import {
    DrawCall,
    Framebuffer,
    App as PicoApp,
    PicoGL,
    Program,
    Texture,
    Timer,
    UniformBuffer,
    VertexArray,
    VertexBuffer,
} from "picogl";
import { useEffect, useState } from "react";
import { Joystick } from "react-joystick-component";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";
import { URLSearchParamsInit, useSearchParams } from "react-router-dom";
import { RegionLoader } from "../client/RegionLoader";
import { VarpManager } from "../client/VarpManager";
import { ConfigType } from "../client/fs/ConfigType";
import {
    DownloadProgress,
    MemoryFileSystem,
    loadFromStore,
} from "../client/fs/FileSystem";
import { IndexType } from "../client/fs/IndexType";
import { NpcDefinition } from "../client/fs/definition/NpcDefinition";
import {
    AnimationLoader,
    CachedAnimationLoader,
} from "../client/fs/loader/AnimationLoader";
import { CachedNpcLoader, NpcLoader } from "../client/fs/loader/NpcLoader";
import { TextureLoader } from "../client/fs/loader/TextureLoader";
import { CachedVarbitLoader } from "../client/fs/loader/VarbitLoader";
import { Pathfinder } from "../client/pathfinder/Pathfinder";
import { Scene } from "../client/scene/Scene";
import { clamp, lerp, slerp } from "../client/util/MathUtil";
import WebGLCanvas from "../components/Canvas";
import { OsrsLoadingBar } from "../components/OsrsLoadingBar";
import {
    MenuOption,
    OsrsMenu,
    OsrsMenuProps,
    TargetType,
} from "../components/OsrsMenu";
import { readPixelsAsync } from "./util/AsyncReadUtil";
import { FrustumIntersection } from "./util/FrustumIntersection";
import "./MapViewer.css";
import { fetchNpcSpawns, NpcSpawn } from "./npc/NpcSpawn";
import { ChunkData, ChunkDataLoader } from "./chunk/ChunkDataLoader";
import { ChunkLoaderWorkerPool } from "./chunk/ChunkLoaderWorkerPool";
import mainFragShader from "./shaders/main.frag.glsl";
import mainVertShader from "./shaders/main.vert.glsl";
import npcVertShader from "./shaders/npc.vert.glsl";
import quadFragShader from "./shaders/quad.frag.glsl";
import quadVertShader from "./shaders/quad.vert.glsl";
import { Npc } from "./npc/Npc";
import { Chunk, deleteChunk, loadChunk } from "./chunk/Chunk";
import { isIos, isTouchDevice, isWallpaperEngine } from "./util/DeviceUtil";
import {
    CacheInfo,
    fetchCacheList,
    getLatestCache,
    loadCache,
    LoadedCache,
} from "./CacheInfo";
import { MapViewerControls } from "./MapViewerControls";
import WebFont from "webfontloader";
import {
    CachedObjectLoader,
    ObjectLoader,
} from "../client/fs/loader/ObjectLoader";
import { ObjectDefinition } from "../client/fs/definition/ObjectDefinition";

const TAU = Math.PI * 2;
const RS_TO_RADIANS = TAU / 2048.0;
const RS_TO_DEGREES = (RS_TO_RADIANS * 180) / Math.PI;
const DEGREES_TO_RADIANS = Math.PI / 180;

function prependShader(shader: string, multiDraw: boolean): string {
    let header = "#version 300 es\n";
    if (multiDraw) {
        header += "#define MULTI_DRAW 1\n";
    }
    return header + shader;
}

function getMousePos(container: HTMLElement, event: MouseEvent | Touch): vec2 {
    var rect = container.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
}

function getRegionDistance(x: number, y: number, region: vec2): number {
    const dx = Math.max(Math.abs(x - (region[0] * 64 + 32)) - 32, 0);
    const dy = Math.max(Math.abs(y - (region[1] * 64 + 32)) - 32, 0);
    return Math.sqrt(dx * dx + dy * dy);
}

export enum ProjectionType {
    PERSPECTIVE,
    ORTHO,
}

export interface CameraPosition {
    position: vec3;
    pitch: number;
    yaw: number;
}

const TEXTURE_SIZE = 128;

const CHUNK_RENDER_FRAME_DELAY = 4;

const INTERACTION_RADIUS = 5;
const INTERACTION_SIZE = INTERACTION_RADIUS * 2 + 1;

enum InteractType {
    OBJECT = 1,
    NPC = 2,
}

const NULL_DRAW_RANGE = [0, 0, 0];

export class MapViewer {
    chunkLoaderWorker: ChunkLoaderWorkerPool;
    loadedCache!: LoadedCache;
    latestCacheInfo: CacheInfo;
    npcSpawns: NpcSpawn[];

    fileSystem!: MemoryFileSystem;
    textureProvider!: TextureLoader;
    objectLoader!: ObjectLoader;
    npcLoader!: NpcLoader;
    animationLoader!: AnimationLoader;
    varpManager!: VarpManager;

    pathfinder: Pathfinder = new Pathfinder();

    app!: PicoApp;

    hasMultiDraw: boolean = false;

    keys: Map<string, boolean> = new Map();

    timer!: Timer;

    program?: Program;
    programNpc?: Program;
    programQuad?: Program;

    frameBuffer!: Framebuffer;

    frameDrawCall!: DrawCall;

    quadPositions!: VertexBuffer;
    quadArray!: VertexArray;

    textureUniformBuffer?: UniformBuffer;
    sceneUniformBuffer!: UniformBuffer;

    textureArray?: Texture;

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

    fpsLimit: number = isWallpaperEngine ? 60 : 0;

    lastFrameTime: number = 0;
    lastClientTick: number = 0;
    lastTick: number = 0;

    onInited?: () => void;
    onFps?: (fps: number) => void;
    onCameraMoved?: (pos: vec3, pitch: number, yaw: number) => void;
    onCameraMoveEnd?: (pos: vec3, pitch: number, yaw: number) => void;

    onMouseMoved?: (x: number, y: number) => void;

    onMenuOpened?: (
        x: number,
        y: number,
        options: MenuOption[],
        tooltip: boolean
    ) => void;
    onMenuClosed?: () => void;

    hudHidden: boolean = false;
    lastHudHidden: number = 0;

    setHudHidden?: (hidden: boolean) => void;

    menuOpen: boolean = false;

    projectionType: ProjectionType = ProjectionType.PERSPECTIVE;
    fov: number = 90;
    orthoZoom: number = 15;

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
    maxPlane: number = Scene.MAX_PLANE - 1;

    tooltips: boolean = true;

    cullBackFace: boolean = true;
    lastCullBackFace: boolean = true;

    currentMouseX: number = 0;
    currentMouseY: number = 0;

    startMouseX: number = -1;
    startMouseY: number = -1;

    startPitch: number = -1;
    startYaw: number = -1;

    pickX: number = -1;
    pickY: number = -1;

    menuX: number = -1;
    menuY: number = -1;

    interactBuffer: Uint8Array = new Uint8Array(
        INTERACTION_SIZE * INTERACTION_SIZE * 4
    );
    interactRegionBuffer: Uint8Array = new Uint8Array(
        INTERACTION_SIZE * INTERACTION_SIZE * 4
    );

    hoveredRegionIds = new Set<number>();

    chunkDataLoader?: ChunkDataLoader;

    lastCameraX: number = -1;
    lastCameraY: number = -1;

    lastCameraRegionX: number = -1;
    lastCameraRegionY: number = -1;

    regionPositions?: vec2[];

    frustumIntersection: FrustumIntersection = new FrustumIntersection();
    chunkIntersectBox: number[][] = [
        [0, (-240 * 10) / 128, 0],
        [0, (240 * 3) / 128, 0],
    ];

    isVisiblePos: vec3 = [0, 0, 0];
    moveCameraRotOrigin: vec3 = [0, 0, 0];

    npcRenderCount: number = 0;
    npcRenderData: Uint16Array = new Uint16Array(16 * 4);

    npcRenderDataTexture: Texture | undefined;
    npcDataTextureBuffer: (Texture | undefined)[] = new Array(5);

    constructor(
        chunkLoaderWorker: ChunkLoaderWorkerPool,
        loadedCache: LoadedCache,
        latestCacheInfo: CacheInfo,
        npcSpawns: NpcSpawn[]
    ) {
        this.chunkLoaderWorker = chunkLoaderWorker;
        this.latestCacheInfo = latestCacheInfo;
        this.npcSpawns = npcSpawns;

        this.initCache(loadedCache);

        // console.log('create map viewer', performance.now());

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
        this.onContextMenu = this.onContextMenu.bind(this);
        this.onPositionJoystickMove = this.onPositionJoystickMove.bind(this);
        this.onPositionJoystickStop = this.onPositionJoystickStop.bind(this);
        this.onCameraJoystickMove = this.onCameraJoystickMove.bind(this);
        this.onCameraJoystickStop = this.onCameraJoystickStop.bind(this);
        this.closeMenu = this.closeMenu.bind(this);
        this.checkInteractions = this.checkInteractions.bind(this);
        this.render = this.render.bind(this);
    }

    initCache(cache: LoadedCache) {
        this.loadedCache = cache;

        this.chunkLoaderWorker.init(cache, this.npcSpawns);

        this.fileSystem = loadFromStore(cache.store);

        const configIndex = this.fileSystem.getIndex(IndexType.CONFIGS);
        const mapIndex = this.fileSystem.getIndex(IndexType.MAPS);
        const spriteIndex = this.fileSystem.getIndex(IndexType.SPRITES);
        const textureIndex = this.fileSystem.getIndex(IndexType.TEXTURES);

        const objectArchive = configIndex.getArchive(ConfigType.OBJECT);
        const npcArchive = configIndex.getArchive(ConfigType.NPC);
        const animationArchive = configIndex.getArchive(ConfigType.SEQUENCE);
        const varbitArchive = configIndex.getArchive(ConfigType.VARBIT);

        this.objectLoader = new CachedObjectLoader(objectArchive, cache.info);
        this.npcLoader = new CachedNpcLoader(npcArchive, cache.info);
        this.animationLoader = new CachedAnimationLoader(
            animationArchive,
            cache.info
        );
        const varbitLoader = new CachedVarbitLoader(varbitArchive, cache.info);

        this.varpManager = new VarpManager(varbitLoader);

        this.invalidRegionIds.clear();
        console.time("check invalid regions");
        for (let x = 0; x < 100; x++) {
            for (let y = 0; y < 200; y++) {
                if (RegionLoader.getTerrainArchiveId(mapIndex, x, y) === -1) {
                    this.invalidRegionIds.add(RegionLoader.getRegionId(x, y));
                }
            }
        }
        console.timeEnd("check invalid regions");

        this.regionPositions = undefined;

        this.textureProvider = TextureLoader.load(
            textureIndex,
            spriteIndex,
            cache.info
        );

        if (this.app) {
            this.deleteChunks();
            if (this.textureUniformBuffer) {
                this.textureUniformBuffer.delete();
                this.textureUniformBuffer = undefined;
            }
            if (this.textureArray) {
                this.textureArray.delete();
                this.textureArray = undefined;
            }
            this.initTextures();
        }
    }

    init(gl: WebGL2RenderingContext) {
        // console.log('init start', performance.now());
        if (!(gl.canvas instanceof HTMLCanvasElement)) {
            return;
        }

        if (!isWallpaperEngine) {
            gl.canvas.addEventListener("keydown", this.onKeyDown);
            gl.canvas.addEventListener("keyup", this.onKeyUp);
            gl.canvas.addEventListener("mousemove", this.onMouseMove);
            gl.canvas.addEventListener("mousedown", this.onMouseDown);
            gl.canvas.addEventListener("mouseup", this.onMouseUp);
            gl.canvas.addEventListener("mouseleave", this.onMouseLeave);
            gl.canvas.addEventListener("touchstart", this.onTouchStart);
            gl.canvas.addEventListener("touchmove", this.onTouchMove);
            gl.canvas.addEventListener("touchend", this.onTouchEnd);
            gl.canvas.addEventListener("focusout", this.onFocusOut);
            gl.canvas.addEventListener("contextmenu", this.onContextMenu);
            gl.canvas.focus();
        }

        const cameraX = -this.cameraPos[0];
        const cameraY = -this.cameraPos[2];

        const cameraRegionX = (cameraX / 64) | 0;
        const cameraRegionY = (cameraY / 64) | 0;

        // queue a chunk as soon as possible so we don't have idling workers
        this.queueChunkLoad(cameraRegionX, cameraRegionY, true);

        // console.log(this.cameraPos);

        const app = (this.app = PicoGL.createApp(gl as any));

        // hack to get the right multi draw extension for picogl
        if (!PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED) {
            const state: any = app.state;
            const ext = gl.getExtension("WEBGL_multi_draw");
            PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED = ext;
            state.extensions.multiDrawInstanced = ext;
        }

        this.hasMultiDraw = !!PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED;

        this.tooltips = this.hasMultiDraw;

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

        const colorTarget = app.createTexture2D(app.width, app.height, {
            internalFormat: PicoGL.RGBA8,
        });
        const interactTarget = app.createTexture2D(app.width, app.height, {
            internalFormat: PicoGL.RGBA8,
        });
        const interactRegionTarget = app.createTexture2D(
            app.width,
            app.height,
            {
                internalFormat: PicoGL.RGBA8,
            }
        );
        const depthTarget = app.createRenderbuffer(
            app.width,
            app.height,
            PicoGL.DEPTH_COMPONENT24
        );
        this.frameBuffer = app
            .createFramebuffer()
            .colorTarget(0, colorTarget)
            .colorTarget(1, interactTarget)
            .colorTarget(2, interactRegionTarget)
            .depthTarget(depthTarget);

        this.quadPositions = app.createVertexBuffer(
            PicoGL.FLOAT,
            2,
            new Float32Array([-1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1])
        );

        this.quadArray = app
            .createVertexArray()
            .vertexAttributeBuffer(0, this.quadPositions);

        app.createPrograms(
            [
                prependShader(mainVertShader, this.hasMultiDraw),
                prependShader(mainFragShader, this.hasMultiDraw),
            ],
            [
                prependShader(npcVertShader, this.hasMultiDraw),
                prependShader(mainFragShader, this.hasMultiDraw),
            ],
            [
                prependShader(quadVertShader, this.hasMultiDraw),
                prependShader(quadFragShader, this.hasMultiDraw),
            ]
        ).then(([program, programNpc, programQuad]) => {
            this.program = program;
            this.programNpc = programNpc;
            this.programQuad = programQuad;

            this.frameDrawCall = app
                .createDrawCall(this.programQuad, this.quadArray)
                .texture("u_frame", this.frameBuffer.colorAttachments[0]);
        });

        this.sceneUniformBuffer = app.createUniformBuffer([
            PicoGL.FLOAT_MAT4,
            PicoGL.FLOAT_MAT4,
            PicoGL.FLOAT_MAT4,
        ]);

        this.initTextures();

        console.timeEnd("first load");

        console.log(gl.getSupportedExtensions());

        if (this.onInited) {
            this.onInited();
        }
    }

    initTextures() {
        this.textureUniformBuffer = this.app.createUniformBuffer(
            new Array(128 * 2).fill(PicoGL.FLOAT_VEC2)
        );

        console.time("load texture array");
        const textureArrayImage = this.textureProvider.createTextureArrayImage(
            1.0,
            TEXTURE_SIZE,
            true
        );
        console.timeEnd("load texture array");

        this.textureArray = this.app.createTextureArray(
            new Uint8Array(textureArrayImage.buffer),
            TEXTURE_SIZE,
            TEXTURE_SIZE,
            this.textureProvider.getTextureCount() + 1,
            {
                // wrapS: PicoGL.CLAMP_TO_EDGE,
                maxAnisotropy: PicoGL.WEBGL_INFO.MAX_TEXTURE_ANISOTROPY,
            }
        );

        const textureAnimDirectionUvs = [
            vec2.fromValues(0.0, 0.0),
            vec2.fromValues(0.0, -1.0),
            vec2.fromValues(-1.0, 0.0),
            vec2.fromValues(0.0, 1.0),
            vec2.fromValues(1.0, 0.0),
        ];
        const textures = this.textureProvider.getDefinitions();
        for (let i = 0; i < textures.length; i++) {
            const texture = textures[i];

            const uv = vec2.mul(
                vec2.create(),
                textureAnimDirectionUvs[texture.animationDirection],
                [texture.animationSpeed, texture.animationSpeed]
            );

            this.textureUniformBuffer.set((i + 1) * 2, uv as Float32Array);
        }

        this.textureUniformBuffer.update();

        console.log("textures: ", textures.length);
    }

    getSearchParams(): URLSearchParamsInit {
        const cx = (-this.cameraPos[0].toFixed(2)).toString();
        const cy = this.cameraPos[1].toFixed(2).toString();
        const cz = (-this.cameraPos[2].toFixed(2)).toString();

        const yaw = (this.yaw | 0) & 2047;

        const p = (this.pitch | 0).toString();
        const y = yaw.toString();

        const params: any = {
            cx,
            cy,
            cz,
            p,
            y,
        };

        if (this.projectionType === ProjectionType.ORTHO) {
            params["pt"] = "o";
            params["z"] = this.orthoZoom.toString();
        }

        if (this.loadedCache.info.name !== this.latestCacheInfo.name) {
            params["cache"] = this.loadedCache.info.name;
        }

        return params;
    }

    onKeyDown(event: KeyboardEvent) {
        // console.log('down', event.key, event.shiftKey);
        this.keys.set(event.key, true);
        if (event.shiftKey) {
            this.keys.set("Shift", true);
        }
        event.preventDefault();
    }

    onKeyUp(event: KeyboardEvent) {
        console.log("up", event.key, event.shiftKey);
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
        if (
            this.onMenuClosed &&
            this.menuOpen &&
            Math.max(Math.abs(this.menuX - x), Math.abs(this.menuY - y)) > 20
        ) {
            this.onMenuClosed();
            this.menuOpen = false;
        }
        if (this.onMouseMoved) {
            this.onMouseMoved(x, y);
        }
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

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        this.pickX = event.x;
        this.pickY = event.y;
        console.log("clicked,", this.pickX, this.pickY, this.hoveredRegionIds);
        if (this.tooltips) {
            this.checkInteractions(this.pickX, this.pickY, false);
        } else {
            this.readPicked();
        }
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

    isPositionVisible(pos: vec3): boolean {
        vec3.transformMat4(pos, pos, this.viewProjMatrix);
        return (
            pos[0] >= -1.0 &&
            pos[0] <= 1.0 &&
            pos[1] >= -1.0 &&
            pos[1] <= 1.0 &&
            pos[2] >= -1.0 &&
            pos[2] <= 1.0
        );
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

        vec3.rotateY(
            delta,
            delta,
            this.moveCameraRotOrigin,
            (2047 - this.yaw) * RS_TO_RADIANS
        );

        vec3.add(this.cameraPos, this.cameraPos, delta);
        this.cameraUpdated = true;
    }

    /**
     * Sets the camera position to a new arbitrary position
     * @param newPosition Any of the items you want to move: Position, pitch, yaw
     */
    setCamera(newPosition: Partial<CameraPosition>): void {
        if (newPosition.position) {
            vec3.copy(this.cameraPos, newPosition.position);
        }
        if (newPosition.pitch) {
            this.pitch = newPosition.pitch;
        }
        if (newPosition.yaw) {
            this.yaw = newPosition.yaw;
        }
        this.cameraUpdated = true;
    }

    runCameraCallbacks() {
        this.runCameraMoveCallback();
        this.runCameraMoveEndCallback();
    }

    runCameraMoveCallback() {
        if (this.onCameraMoved) {
            const yaw = this.yaw & 2047;
            this.onCameraMoved(this.cameraPos, this.pitch, yaw);
        }
    }

    runCameraMoveEndCallback() {
        if (this.onCameraMoveEnd) {
            const yaw = this.yaw & 2047;
            this.onCameraMoveEnd(this.cameraPos, this.pitch, yaw);
        }
    }

    queueChunkLoad(regionX: number, regionY: number, force: boolean = false) {
        const regionId = RegionLoader.getRegionId(regionX, regionY);
        if (
            this.loadingRegionIds.size < this.chunkLoaderWorker.size * 2 &&
            !this.loadingRegionIds.has(regionId) &&
            !this.chunks.has(regionId) &&
            (force || this.isChunkVisible(regionX, regionY))
        ) {
            // console.log('queue load', regionX, regionY, performance.now());
            this.loadingRegionIds.add(regionId);

            this.chunkLoaderWorker.pool
                .queue((worker) =>
                    worker.load(
                        regionX,
                        regionY,
                        !this.hasMultiDraw,
                        this.loadNpcs,
                        this.maxPlane
                    )
                )
                .then((chunkData) => {
                    if (chunkData) {
                        this.chunksToLoad.push(chunkData);
                    } else {
                        this.invalidRegionIds.add(regionId);
                    }
                });
        }
    }

    deleteChunks() {
        for (const chunk of this.chunks.values()) {
            deleteChunk(chunk);
        }
        this.chunks.clear();
        this.loadingRegionIds.clear();
        this.chunksToLoad.clear();
    }

    setLoadNpcs(load: boolean) {
        if (this.loadNpcs !== load) {
            this.deleteChunks();
        }
        this.loadNpcs = load;
    }

    setMaxPlane(maxPlane: number) {
        if (this.maxPlane !== maxPlane) {
            this.deleteChunks();
        }
        this.maxPlane = maxPlane;
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
        if (this.onFps) {
            this.onFps(this.fps);
        }
    }

    addNpcRenderData(chunk: Chunk, npcs: Npc[]) {
        if (npcs.length === 0) {
            return;
        }

        chunk.npcDataTextureOffsets[
            this.frameCount % chunk.npcDataTextureOffsets.length
        ] = this.npcRenderCount;

        const newCount = this.npcRenderCount + npcs.length;

        if (this.npcRenderData.length / 4 < newCount) {
            const newData = new Uint16Array(
                Math.ceil((newCount * 2) / 16) * 16 * 4
            );
            newData.set(this.npcRenderData);
            this.npcRenderData = newData;
        }

        npcs.forEach((npc, i) => {
            let offset = this.npcRenderCount * 4;

            const tileX = npc.x >> 7;
            const tileY = npc.y >> 7;

            let renderPlane = npc.data.plane;
            if (
                renderPlane < 3 &&
                (chunk.tileRenderFlags[1][tileX][tileY] & 0x2) === 2
            ) {
                renderPlane = npc.data.plane + 1;
            }

            this.npcRenderData[offset++] = npc.x;
            this.npcRenderData[offset++] = npc.y;
            this.npcRenderData[offset++] = (npc.rotation << 2) | renderPlane;
            this.npcRenderData[offset++] = npc.data.id;

            this.npcRenderCount++;
        });
    }

    handleInput(time: number, deltaTime: number) {
        let cameraSpeedMult = 1.0;
        if (this.keys.get("Shift")) {
            cameraSpeedMult = 10.0;
        }

        const deltaPitch = 64 * 3 * deltaTime;
        const deltaYaw = 64 * 5 * deltaTime;

        // camera direction controls
        if (this.keys.get("ArrowUp")) {
            this.updatePitch(this.pitch, -deltaPitch);
        }
        if (this.keys.get("ArrowDown")) {
            this.updatePitch(this.pitch, deltaPitch);
        }
        if (this.keys.get("ArrowRight")) {
            this.updateYaw(this.yaw, -deltaYaw);
        }
        if (this.keys.get("ArrowLeft")) {
            this.updateYaw(this.yaw, deltaYaw);
        }

        // 200ms cooldown
        if (this.keys.get("F1") && time - this.lastHudHidden > 0.2) {
            this.hudHidden = !this.hudHidden;
            this.lastHudHidden = time;
            if (this.setHudHidden) {
                this.setHudHidden(this.hudHidden);
            }
        }

        // joystick controls
        if (this.positionJoystickEvent) {
            const moveX = this.positionJoystickEvent.x || 0;
            const moveY = this.positionJoystickEvent.y || 0;

            this.moveCamera(
                moveX * 32 * -deltaTime,
                0,
                moveY * 32 * -deltaTime
            );
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

            if (isTouchDevice) {
                this.moveCamera(0, clamp(deltaMouseY, -100, 100) * 0.004, 0);
            } else {
                this.updatePitch(this.startPitch, deltaMouseY * 0.6);
                this.updateYaw(this.startYaw, deltaMouseX * -0.9);
            }
        }

        // camera position controls
        if (this.keys.get("w") || this.keys.get("W")) {
            this.moveCamera(0, 0, -16 * cameraSpeedMult * deltaTime);
        }
        if (this.keys.get("a") || this.keys.get("A")) {
            this.moveCamera(16 * cameraSpeedMult * deltaTime, 0, 0);
        }
        if (this.keys.get("s") || this.keys.get("S")) {
            this.moveCamera(0, 0, 16 * cameraSpeedMult * deltaTime);
        }
        if (this.keys.get("d") || this.keys.get("D")) {
            this.moveCamera(-16 * cameraSpeedMult * deltaTime, 0, 0);
        }
        if (this.keys.get("e") || this.keys.get("E")) {
            this.moveCamera(0, 8 * cameraSpeedMult * deltaTime, 0);
        }
        if (
            this.keys.get("q") ||
            this.keys.get("Q") ||
            this.keys.get("c") ||
            this.keys.get("C")
        ) {
            this.moveCamera(0, -8 * cameraSpeedMult * deltaTime, 0);
        }

        if (this.keys.get("t") && this.timer.ready()) {
            const totalTriangles = Array.from(this.chunks.values())
                .map((t) => t.triangleCount)
                .reduce((a, b) => a + b, 0);

            console.log(
                this.timer.cpuTime,
                this.timer.gpuTime,
                this.chunks.size,
                "triangles",
                totalTriangles,
                this.hoveredRegionIds
            );
            console.log(time);
        }

        if (this.keys.get("r") && this.timer.ready()) {
            this.app.enable(PicoGL.RASTERIZER_DISCARD);
        }
        if (this.keys.get("f") && this.timer.ready()) {
            this.app.disable(PicoGL.RASTERIZER_DISCARD);
        }

        if (this.keys.get("p") && this.chunkDataLoader) {
            for (let i = 0; i < 20; i++) {
                this.chunkDataLoader.load(
                    50,
                    50,
                    false,
                    false,
                    Scene.MAX_PLANE - 1
                );

                this.chunkDataLoader.regionLoader.regions.clear();
                this.chunkDataLoader.regionLoader.blendedUnderlayColors.clear();
                this.chunkDataLoader.regionLoader.lightLevels.clear();

                this.chunkDataLoader.objectModelLoader.modelDataCache.clear();
                this.chunkDataLoader.objectModelLoader.modelCache.clear();
            }
        }
    }

    readPicked() {
        const gl = this.app.gl as WebGL2RenderingContext;

        if (this.pickX !== -1 && this.pickY !== -1) {
            this.app.readFramebuffer(this.frameBuffer);

            gl.readBuffer(gl.COLOR_ATTACHMENT0 + 1);

            readPixelsAsync(
                gl,
                this.pickX - INTERACTION_RADIUS,
                gl.canvas.height - this.pickY - INTERACTION_RADIUS,
                INTERACTION_SIZE,
                INTERACTION_SIZE,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                this.interactBuffer
            ).then(
                this.checkInteractionsCallback(this.pickX, this.pickY, false)
            );

            this.pickX = -1;
            this.pickY = -1;
        }
    }

    readHover() {
        if (this.currentMouseX === -1 || this.currentMouseY === -1) {
            return;
        }

        const gl = this.app.gl as WebGL2RenderingContext;

        this.app.readFramebuffer(this.frameBuffer);

        gl.readBuffer(gl.COLOR_ATTACHMENT0 + 1);

        readPixelsAsync(
            gl,
            this.currentMouseX - INTERACTION_RADIUS,
            gl.canvas.height - this.currentMouseY - INTERACTION_RADIUS,
            INTERACTION_SIZE,
            INTERACTION_SIZE,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this.interactBuffer
        );
    }

    readHoveredRegion() {
        if (this.currentMouseX === -1 || this.currentMouseY === -1) {
            return;
        }

        const gl = this.app.gl as WebGL2RenderingContext;

        this.app.readFramebuffer(this.frameBuffer);

        gl.readBuffer(gl.COLOR_ATTACHMENT0 + 2);

        readPixelsAsync(
            gl,
            this.currentMouseX - INTERACTION_RADIUS,
            gl.canvas.height - this.currentMouseY - INTERACTION_RADIUS,
            INTERACTION_SIZE,
            INTERACTION_SIZE,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this.interactRegionBuffer
        ).then((buf) => {
            this.hoveredRegionIds.clear();
            for (let x = 0; x < INTERACTION_SIZE; x++) {
                for (let y = 0; y < INTERACTION_SIZE; y++) {
                    const index = (x + y * INTERACTION_SIZE) * 4;

                    const regionX = this.interactRegionBuffer[index];
                    const regionY = this.interactRegionBuffer[index + 1];

                    const regionId = RegionLoader.getRegionId(regionX, regionY);

                    if (regionId !== 0) {
                        this.hoveredRegionIds.add(regionId);
                    }
                }
            }

            // console.log(Array.from(this.interactRegionBuffer.slice(0, 4)), regionIds);
        });
    }

    closeMenu() {
        if (this.onMenuClosed) {
            this.onMenuClosed();
            this.menuOpen = false;
        }
        this.app.canvas.focus();
    }

    checkInteractionsCallback(
        pickedX: number,
        pickedY: number,
        tooltip: boolean
    ) {
        return (buf: ArrayBufferView) =>
            this.checkInteractions(pickedX, pickedY, tooltip);
    }

    checkInteractions(pickedX: number, pickedY: number, tooltip: boolean) {
        const closestInteractions = new Map<number, number[]>();

        for (let x = 0; x < INTERACTION_SIZE; x++) {
            for (let y = 0; y < INTERACTION_SIZE; y++) {
                const index = (x + y * INTERACTION_SIZE) * 4;
                if (this.interactBuffer[index + 2] !== 0) {
                    const dist = Math.max(
                        Math.abs(x - INTERACTION_RADIUS),
                        Math.abs(y - INTERACTION_RADIUS)
                    );
                    const interactions = closestInteractions.get(dist);
                    if (interactions) {
                        interactions.push(index);
                    } else {
                        closestInteractions.set(dist, [index]);
                    }
                }
            }
        }

        const menuOptions: MenuOption[] = [];
        const examineOptions: MenuOption[] = [];

        const interactions: number[] = [];
        for (let i = 0; i < INTERACTION_SIZE; i++) {
            const interactionsAtDist = closestInteractions.get(i);
            if (interactionsAtDist) {
                interactions.push(...interactionsAtDist);
            }
        }

        const npcIds = new Set<number>();
        const objectIds = new Set<number>();

        for (const index of interactions) {
            const interactId =
                (this.interactBuffer[index] << 8) |
                this.interactBuffer[index + 1];
            if (interactId === 0xffff) {
                continue;
            }
            const interactType = this.interactBuffer[index + 2];
            if (interactType === InteractType.OBJECT) {
                if (objectIds.has(interactId)) {
                    continue;
                }
                objectIds.add(interactId);

                let def: ObjectDefinition | undefined =
                    this.objectLoader.getDefinition(interactId);
                if (def.transforms) {
                    def = def.transform(this.varpManager, this.objectLoader);
                }
                if (!def) {
                    continue;
                }
                const objectId = def.id;
                const objectName = def.name;
                if (objectName !== "null") {
                    menuOptions.push(
                        ...def.actions
                            .filter((action) => !!action)
                            .map(
                                (action): MenuOption => ({
                                    id: objectId,
                                    action: action,
                                    target: {
                                        name: objectName,
                                        type: TargetType.OBJECT,
                                    },
                                    onClick: this.closeMenu,
                                })
                            )
                    );

                    const openWikiOnClick = () => {
                        window.open(
                            "https://oldschool.runescape.wiki/w/Special:Lookup?type=object&id=" +
                                interactId,
                            "_blank"
                        );
                    };

                    examineOptions.push({
                        id: objectId,
                        action: "Examine",
                        target: {
                            name: objectName,
                            type: TargetType.OBJECT,
                        },
                        level: 0,
                        onClick: openWikiOnClick,
                    });
                }
            } else if (interactType === InteractType.NPC) {
                if (npcIds.has(interactId)) {
                    continue;
                }
                npcIds.add(interactId);

                let def: NpcDefinition | undefined =
                    this.npcLoader.getDefinition(interactId);
                if (def.transforms) {
                    def = def.transform(this.varpManager, this.npcLoader);
                }
                if (def) {
                    const npcId = def.id;
                    const npcName = def.name;
                    const npcLevel = def.combatLevel;

                    menuOptions.push(
                        ...def.actions
                            .filter((action) => !!action)
                            .map(
                                (action): MenuOption => ({
                                    id: npcId,
                                    action: action,
                                    target: {
                                        name: npcName,
                                        type: TargetType.NPC,
                                    },
                                    level: npcLevel,
                                    onClick: this.closeMenu,
                                })
                            )
                    );

                    const openWikiOnClick = () => {
                        window.open(
                            "https://oldschool.runescape.wiki/w/Special:Lookup?type=npc&id=" +
                                npcId,
                            "_blank"
                        );
                    };

                    examineOptions.push({
                        id: npcId,
                        action: "Examine",
                        target: {
                            name: npcName,
                            type: TargetType.NPC,
                        },
                        level: npcLevel,
                        onClick: openWikiOnClick,
                    });
                }
            }
        }

        menuOptions.push({
            id: -1,
            action: "Walk here",
            onClick: this.closeMenu,
        });
        menuOptions.push(...examineOptions);
        menuOptions.push({
            id: -1,
            action: "Cancel",
            onClick: this.closeMenu,
        });

        if (this.onMenuOpened) {
            this.onMenuOpened(pickedX, pickedY, menuOptions, tooltip);
            this.menuOpen = !tooltip;
            this.menuX = pickedX;
            this.menuY = pickedY;
        }
    }

    updateProjection() {
        const canvasWidth = this.app.width;
        const canvasHeight = this.app.height;

        mat4.identity(this.projectionMatrix);
        if (this.projectionType === ProjectionType.PERSPECTIVE) {
            mat4.perspective(
                this.projectionMatrix,
                this.fov * DEGREES_TO_RADIANS,
                canvasWidth / canvasHeight,
                0.1,
                1024.0 * 4
            );
        } else {
            mat4.ortho(
                this.projectionMatrix,
                -canvasWidth / this.orthoZoom,
                canvasWidth / this.orthoZoom,
                -canvasHeight / this.orthoZoom,
                canvasHeight / this.orthoZoom,
                -1024.0 * 8,
                1024.0 * 8
            );
        }
        mat4.rotateX(this.projectionMatrix, this.projectionMatrix, Math.PI);

        // TODO: properly invert this
        mat4.identity(this.viewMatrix);
        if (this.pitch !== 0) {
            mat4.rotateX(
                this.viewMatrix,
                this.viewMatrix,
                this.pitch * RS_TO_RADIANS
            );
        }
        if (this.yaw !== 0) {
            mat4.rotateY(
                this.viewMatrix,
                this.viewMatrix,
                this.yaw * RS_TO_RADIANS
            );
        }
        mat4.translate(this.viewMatrix, this.viewMatrix, this.cameraPos);

        mat4.multiply(
            this.viewProjMatrix,
            this.projectionMatrix,
            this.viewMatrix
        );

        this.frustumIntersection.setPlanes(this.viewProjMatrix);
    }

    updateNpcDataTexture() {
        const newNpcDataTextureIndex =
            this.frameCount % this.npcDataTextureBuffer.length;
        const npcDataTextureIndex =
            (this.frameCount + 1) % this.npcDataTextureBuffer.length;
        this.npcDataTextureBuffer[newNpcDataTextureIndex]?.delete();
        this.npcDataTextureBuffer[newNpcDataTextureIndex] =
            this.app.createTexture2D(
                this.npcRenderData,
                16,
                Math.max(Math.ceil(this.npcRenderCount / 16), 1),
                {
                    internalFormat: PicoGL.RGBA16UI,
                    minFilter: PicoGL.NEAREST,
                    magFilter: PicoGL.NEAREST,
                }
            );

        return npcDataTextureIndex;
    }

    setMainUniforms(drawCall: DrawCall, time: number, deltaTime: number) {
        drawCall.uniform("u_currentTime", time);
        drawCall.uniform("u_deltaTime", deltaTime);
        drawCall.uniform("u_brightness", this.brightness);
        drawCall.uniform("u_colorBanding", this.colorBanding);
    }

    draw(drawCall: DrawCall, drawRanges: number[][]) {
        if (this.hasMultiDraw) {
            drawCall.draw();
        } else {
            for (let i = 0; i < drawRanges.length; i++) {
                drawCall.uniform("u_drawId", i);
                drawCall.drawRanges(drawRanges[i]);
                drawCall.draw();
            }
        }
    }

    sortRegionPositions() {
        if (!this.regionPositions) {
            return;
        }

        const cameraX = -this.cameraPos[0];
        const cameraY = -this.cameraPos[2];

        // sort front to back
        this.regionPositions.sort((a, b) => {
            const regionDistA = getRegionDistance(cameraX, cameraY, a);
            const regionDistB = getRegionDistance(cameraX, cameraY, b);
            return regionDistA - regionDistB;
        });
    }

    render(
        gl: WebGL2RenderingContext,
        time: DOMHighResTimeStamp,
        resized: boolean
    ) {
        time *= 0.001;
        const deltaTime = time - this.lastFrameTime;

        if (this.fpsLimit) {
            const tolerance = 0.001;
            if (deltaTime < 1 / this.fpsLimit - tolerance) {
                return;
            }
        }

        this.lastFrameTime = time;

        this.setFps(1.0 / deltaTime);

        const cycle = time / 0.02;

        const clientTick = Math.floor(time / 0.02);
        const clientTicksElapsed = Math.min(
            clientTick - this.lastClientTick,
            50
        );
        if (clientTicksElapsed > 0) {
            this.lastClientTick = clientTick;
        }

        const tick = Math.floor(time / 0.6);
        const ticksElapsed = Math.min(tick - this.lastTick, 1);
        if (ticksElapsed > 0) {
            this.lastTick = tick;
        }

        const canvasWidth = gl.canvas.width;
        const canvasHeight = gl.canvas.height;

        if (resized) {
            this.app.resize(canvasWidth, canvasHeight);
            this.frameBuffer.resize();
        }

        // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (
            !this.program ||
            !this.programNpc ||
            !this.textureUniformBuffer ||
            !this.textureArray
        ) {
            console.warn("MapViewer not ready");
            return;
        }

        if (this.lastCullBackFace != this.cullBackFace) {
            this.updateCullFace();
        }

        const movedCameraLastFrame = this.cameraUpdated;
        this.cameraUpdated = false;

        this.handleInput(time, deltaTime);
        if (this.hasMultiDraw) {
            this.readHoveredRegion();
        }
        if (this.tooltips) {
            this.readHover();
        }

        if (!this.menuOpen && this.tooltips) {
            this.checkInteractions(
                this.currentMouseX,
                this.currentMouseY,
                true
            );
        }

        if (this.cameraUpdated) {
            this.runCameraMoveCallback();
        }
        if (movedCameraLastFrame && !this.cameraUpdated) {
            this.runCameraMoveEndCallback();
        }

        this.updateProjection();

        this.sceneUniformBuffer
            .set(0, this.viewProjMatrix as Float32Array)
            .set(1, this.viewMatrix as Float32Array)
            .set(2, this.projectionMatrix as Float32Array)
            .update();

        const cameraX = -this.cameraPos[0];
        const cameraY = -this.cameraPos[2];

        const cameraRegionX = (cameraX / 64) | 0;
        const cameraRegionY = (cameraY / 64) | 0;

        const viewDistanceRegionIds =
            this.viewDistanceRegionIds[this.frameCount % 2];
        const lastViewDistanceRegionIds =
            this.viewDistanceRegionIds[(this.frameCount + 1) % 2];

        viewDistanceRegionIds.clear();

        let sortRegionPositions =
            this.lastCameraX != cameraX ||
            this.lastCameraY != cameraY ||
            this.lastRegionViewDistance != this.regionViewDistance;
        if (
            this.lastCameraRegionX != cameraRegionX ||
            this.lastCameraRegionY != cameraRegionY ||
            this.lastRegionViewDistance != this.regionViewDistance ||
            this.regionPositions === undefined
        ) {
            const viewDistance = this.regionViewDistance;

            if (!this.regionPositions) {
                this.regionPositions = [];
                sortRegionPositions = true;
            }

            this.regionPositions.length = 0;
            for (let x = -(viewDistance - 1); x < viewDistance; x++) {
                for (let y = -(viewDistance - 1); y < viewDistance; y++) {
                    const regionX = cameraRegionX + x;
                    const regionY = cameraRegionY + y;
                    if (
                        regionX < 0 ||
                        regionX >= 100 ||
                        regionY < 0 ||
                        regionY >= 200
                    ) {
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
                const regionY = regionId & 0xff;
                const xDist = Math.abs(regionX - cameraRegionX);
                const yDist = Math.abs(regionY - cameraRegionY);
                const dist = Math.max(xDist, yDist);
                if (
                    dist >=
                    this.regionViewDistance + this.regionUnloadDistance - 1
                ) {
                    deleteChunk(chunk);
                    this.chunks.delete(regionId);
                    console.log(
                        "deleting chunk ",
                        dist,
                        this.regionViewDistance,
                        this.regionUnloadDistance,
                        chunk
                    );
                }
            }
        }

        this.timer.start();

        if (sortRegionPositions) {
            this.sortRegionPositions();
        }

        this.visibleChunkCount = 0;
        this.npcRenderCount = 0;

        // draw back to front
        for (let i = this.regionPositions.length - 1; i >= 0; i--) {
            const pos = this.regionPositions[i];
            const regionId = RegionLoader.getRegionId(pos[0], pos[1]);
            const chunk = this.chunks.get(regionId);
            viewDistanceRegionIds.add(regionId);
            if (
                !chunk ||
                !this.isChunkVisible(pos[0], pos[1]) ||
                this.frameCount - chunk.frameLoaded < CHUNK_RENDER_FRAME_DELAY
            ) {
                continue;
            }

            // fade in chunks even if it loaded a while ago
            if (!lastViewDistanceRegionIds.has(regionId)) {
                chunk.timeLoaded = time;

                chunk.drawCall.uniform("u_timeLoaded", chunk.timeLoaded);
                chunk.drawCallLowDetail.uniform(
                    "u_timeLoaded",
                    chunk.timeLoaded
                );
                chunk.drawCallInteract.uniform(
                    "u_timeLoaded",
                    chunk.timeLoaded
                );
                chunk.drawCallAlpha.uniform("u_timeLoaded", chunk.timeLoaded);
                chunk.drawCallInteractAlpha.uniform(
                    "u_timeLoaded",
                    chunk.timeLoaded
                );
                chunk.drawCallNpc?.uniform("u_timeLoaded", chunk.timeLoaded);
            }

            for (const object of chunk.animatedObjects) {
                // advance frame
                object.update(cycle);
            }

            for (let t = 0; t < ticksElapsed; t++) {
                for (const npc of chunk.npcs) {
                    npc.updateServerMovement(
                        this.pathfinder,
                        chunk.collisionMaps
                    );
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

        const npcDataTextureIndex = this.updateNpcDataTexture();
        const npcRenderDataTexture =
            this.npcDataTextureBuffer[npcDataTextureIndex];

        this.app.drawFramebuffer(this.frameBuffer).clear();

        // opaque pass
        for (let i = this.visibleChunkCount - 1; i >= 0; i--) {
            const chunk = this.visibleChunks[i];
            const regionDist = Math.max(
                Math.abs(cameraRegionX - chunk.regionX),
                Math.abs(cameraRegionY - chunk.regionY)
            );

            const isInteract = this.hoveredRegionIds.has(
                RegionLoader.getRegionId(chunk.regionX, chunk.regionY)
            );
            const isLowDetail = regionDist >= this.regionLodDistance;

            let drawCall = chunk.drawCall;
            let drawRanges = chunk.drawRanges;
            let drawRangeOffset = 0;
            if (isInteract) {
                if (isLowDetail) {
                    drawCall = chunk.drawCallInteractLowDetail;
                    drawRanges = chunk.drawRangesInteractLowDetail;
                } else {
                    drawCall = chunk.drawCallInteract;
                    drawRanges = chunk.drawRangesInteract;
                }
                drawRangeOffset =
                    drawRanges.length - chunk.drawRangesInteract.length;
            } else if (isLowDetail) {
                drawCall = chunk.drawCallLowDetail;
                drawRanges = chunk.drawRangesLowDetail;
                drawRangeOffset =
                    chunk.drawRangesLowDetail.length - chunk.drawRanges.length;
            }

            this.setMainUniforms(drawCall, time, deltaTime);

            for (const object of chunk.animatedObjects) {
                const frameId = object.frame;
                const frame = object.frames[frameId];

                const drawRangeIndex = isInteract
                    ? object.drawRangeInteractIndex
                    : object.drawRangeIndex;

                const offset = drawRangeIndex + drawRangeOffset;

                (drawCall as any).offsets[offset] = frame[0];
                (drawCall as any).numElements[offset] = frame[1];

                drawRanges[offset] = frame;
            }

            this.draw(drawCall, drawRanges);
        }
        // opaque npc pass
        for (let i = this.visibleChunkCount - 1; i >= 0; i--) {
            const chunk = this.visibleChunks[i];

            const drawCall = chunk.drawCallNpc;
            if (!drawCall || !npcRenderDataTexture) {
                continue;
            }

            this.setMainUniforms(drawCall, time, deltaTime);
            drawCall.uniform(
                "u_npcDataOffset",
                chunk.npcDataTextureOffsets[npcDataTextureIndex]
            );
            drawCall.texture("u_modelDataTexture", npcRenderDataTexture);

            const drawRanges = chunk.drawRangesNpc;

            chunk.npcs.forEach((npc, i) => {
                const anim = npc.getAnimationFrames();

                const frameId = npc.movementFrame;
                const frame = anim.frames[frameId];

                (drawCall as any).offsets[i] = frame[0];
                (drawCall as any).numElements[i] = frame[1];

                drawRanges[i] = frame;
            });

            this.draw(drawCall, drawRanges);
        }

        // alpha pass
        for (let i = 0; i < this.visibleChunkCount; i++) {
            const chunk = this.visibleChunks[i];

            const isInteract = this.hoveredRegionIds.has(
                RegionLoader.getRegionId(chunk.regionX, chunk.regionY)
            );

            const drawCall = isInteract
                ? chunk.drawCallInteractAlpha
                : chunk.drawCallAlpha;

            this.setMainUniforms(drawCall, time, deltaTime);

            const drawRanges = isInteract
                ? chunk.drawRangesInteractAlpha
                : chunk.drawRangesAlpha;

            for (const object of chunk.animatedObjects) {
                if (object.framesAlpha) {
                    const frameId = object.frame;
                    const frame = object.framesAlpha[frameId];

                    const offset = isInteract
                        ? object.drawRangeInteractAlphaIndex
                        : object.drawRangeAlphaIndex;

                    (drawCall as any).offsets[offset] = frame[0];
                    (drawCall as any).numElements[offset] = frame[1];

                    drawRanges[offset] = frame;
                }
            }

            this.draw(drawCall, drawRanges);
        }
        // alpha npc pass
        for (let i = 0; i < this.visibleChunkCount; i++) {
            const chunk = this.visibleChunks[i];

            const drawCall = chunk.drawCallNpc;
            if (!drawCall || !npcRenderDataTexture) {
                continue;
            }

            this.setMainUniforms(drawCall, time, deltaTime);
            drawCall.uniform(
                "u_npcDataOffset",
                chunk.npcDataTextureOffsets[npcDataTextureIndex]
            );
            drawCall.texture("u_modelDataTexture", npcRenderDataTexture);

            const drawRanges = chunk.drawRangesNpc;

            chunk.npcs.forEach((npc, i) => {
                const anim = npc.getAnimationFrames();

                const frameId = npc.movementFrame;
                let frame: number[] = NULL_DRAW_RANGE;
                if (anim.framesAlpha) {
                    frame = anim.framesAlpha[frameId];
                }

                (drawCall as any).offsets[i] = frame[0];
                (drawCall as any).numElements[i] = frame[1];

                drawRanges[i] = frame;
            });

            this.draw(drawCall, drawRanges);
        }

        this.app.defaultDrawFramebuffer().clear();

        this.frameDrawCall.draw();

        if (this.keys.get("h")) {
            console.log(
                "rendered chunks",
                this.visibleChunkCount,
                this.frustumIntersection.planes
            );
        }

        for (const regionPos of this.regionPositions) {
            this.queueChunkLoad(regionPos[0], regionPos[1]);
        }

        // TODO: upload x bytes per frame
        if (this.frameCount % 30 || this.chunks.size === 0) {
            const chunkData = this.chunksToLoad.shift();
            if (chunkData) {
                // console.log('loaded', chunkData.regionX, chunkData.regionY, performance.now())
                const regionId = RegionLoader.getRegionId(
                    chunkData.regionX,
                    chunkData.regionY
                );
                if (
                    chunkData.loadNpcs === this.loadNpcs &&
                    chunkData.maxPlane === this.maxPlane &&
                    chunkData.cacheInfo.name === this.loadedCache.info.name
                ) {
                    this.chunks.set(
                        regionId,
                        loadChunk(
                            this.app,
                            this.program,
                            this.programNpc,
                            this.npcLoader,
                            this.animationLoader,
                            this.textureArray,
                            this.textureUniformBuffer,
                            this.sceneUniformBuffer,
                            chunkData,
                            this.frameCount,
                            cycle
                        )
                    );
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
        return "0 Bytes";
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

interface MapViewerContainerProps {
    mapViewer: MapViewer;
    caches: CacheInfo[];
}

function MapViewerContainer({ mapViewer, caches }: MapViewerContainerProps) {
    const [inited, setInited] = useState<boolean>(
        !!mapViewer.textureUniformBuffer
    );
    const [fps, setFps] = useState<number>(0);
    const [compassDegrees, setCompassDegrees] = useState<number>(0);
    const [menuProps, setMenuProps] = useState<OsrsMenuProps | undefined>(
        undefined
    );
    const [hudHidden, setHudHidden] = useState<boolean>(isWallpaperEngine);
    const [downloadProgress, setDownloadProgress] = useState<
        DownloadProgress | undefined
    >(undefined);

    useEffect(() => {
        mapViewer.onInited = () => {
            setInited(true);
        };
        if (mapViewer.textureUniformBuffer) {
            setInited(true);
        }
        mapViewer.onFps = setFps;
        mapViewer.onCameraMoved = (pos, pitch, yaw) => {
            setCompassDegrees((2047 - yaw) * RS_TO_DEGREES);
        };
        mapViewer.runCameraMoveCallback();
        mapViewer.onMouseMoved = (x, y) => {
            setMenuProps((props) => {
                if (!props) {
                    return undefined;
                }
                if (!props.tooltip) {
                    return props;
                }
                return {
                    ...props,
                    x,
                    y,
                };
            });
        };
        mapViewer.onMenuOpened = (x, y, options, tooltip) => {
            setMenuProps({ x, y, options, tooltip });
        };
        mapViewer.onMenuClosed = () => {
            setMenuProps(undefined);
        };
        mapViewer.hudHidden = hudHidden;
        mapViewer.setHudHidden = setHudHidden;
    }, [mapViewer]);

    let loadingBarOverlay: JSX.Element | undefined = undefined;
    if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress =
            ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        loadingBarOverlay = (
            <div className="overlay-container">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    }

    return (
        <div>
            {loadingBarOverlay}
            {menuProps && <OsrsMenu {...menuProps} />}
            {inited && (
                <MapViewerControls
                    mapViewer={mapViewer}
                    caches={caches}
                    setDownloadProgress={setDownloadProgress}
                    hidden={hudHidden}
                />
            )}
            {!hudHidden && (
                <span>
                    <div className="hud left-top">
                        <img
                            className="compass"
                            style={{
                                transform: `rotate(${compassDegrees}deg)`,
                            }}
                            src="/compass.png"
                            onClick={() => {
                                mapViewer.yaw = 0;
                                mapViewer.runCameraCallbacks();
                            }}
                        />
                        <div className="fps-counter content-text">
                            {fps.toFixed(1)}
                        </div>
                    </div>
                </span>
            )}
            {isTouchDevice && (
                <div className="joystick-container left">
                    <Joystick
                        size={75}
                        baseColor="#181C20"
                        stickColor="#007BFF"
                        stickSize={40}
                        move={mapViewer.onPositionJoystickMove}
                        stop={mapViewer.onPositionJoystickStop}
                    ></Joystick>
                </div>
            )}
            {isTouchDevice && (
                <div className="joystick-container right">
                    <Joystick
                        size={75}
                        baseColor="#181C20"
                        stickColor="#007BFF"
                        stickSize={40}
                        move={mapViewer.onCameraJoystickMove}
                        stop={mapViewer.onCameraJoystickStop}
                    ></Joystick>
                </div>
            )}

            <WebGLCanvas
                init={mapViewer.init}
                draw={mapViewer.render}
            ></WebGLCanvas>
        </div>
    );
}

const MAX_POOL_SIZE = isIos ? 1 : 4;

const poolSize = Math.min(navigator.hardwareConcurrency, MAX_POOL_SIZE);
const pool = ChunkLoaderWorkerPool.init(poolSize);
// console.log('start App', performance.now());

const cachesPromise = fetchCacheList();

function MapViewerApp() {
    const [downloadProgress, setDownloadProgress] = useState<
        DownloadProgress | undefined
    >(undefined);
    const [mapViewer, setMapViewer] = useState<MapViewer | undefined>(
        undefined
    );
    const [caches, setCaches] = useState<CacheInfo[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();

    // const test = new Test();

    useEffect(() => {
        // console.log('start fetch', performance.now());
        console.time("first load");
        const load = async () => {
            const cacheNameParam = searchParams.get("cache");
            const npcSpawnsPromise = fetchNpcSpawns();
            const caches = await cachesPromise;
            const latestCacheInfo = getLatestCache(caches);
            if (!latestCacheInfo) {
                console.error("Could not load the latest cache info");
                return;
            }

            let cacheInfo: CacheInfo | undefined = undefined;
            if (cacheNameParam) {
                cacheInfo = caches.find(
                    (cache) => cache.name === cacheNameParam
                );
            }
            if (!cacheInfo) {
                cacheInfo = latestCacheInfo;
            }

            const loadedCache = await loadCache(cacheInfo, setDownloadProgress);
            setDownloadProgress(undefined);

            console.time("load npc spawns");
            const npcSpawns = await npcSpawnsPromise;
            console.timeEnd("load npc spawns");

            const mapViewer = new MapViewer(
                pool,
                loadedCache,
                latestCacheInfo,
                npcSpawns
            );

            const cx = searchParams.get("cx");
            const cy = searchParams.get("cy");
            const cz = searchParams.get("cz");

            const pitch = searchParams.get("p");
            const yaw = searchParams.get("y");

            if (searchParams.get("pt") === "o") {
                mapViewer.projectionType = ProjectionType.ORTHO;
            }

            const zoom = searchParams.get("z");
            if (zoom) {
                mapViewer.orthoZoom = parseInt(zoom);
            }

            if (cx && cy && cz) {
                const pos: vec3 = [
                    -parseFloat(cx),
                    parseFloat(cy),
                    -parseFloat(cz),
                ];
                mapViewer.cameraPos = pos;
            }
            if (pitch) {
                mapViewer.pitch = parseInt(pitch);
            }
            if (yaw) {
                mapViewer.yaw = parseInt(yaw);
            }

            setCaches(caches);
            setMapViewer(mapViewer);
        };

        if (!isIos) {
            load().catch(console.error);
        }

        WebFont.load({
            custom: {
                families: ["OSRS"],
            },
        });
    }, []);

    let content: JSX.Element | undefined = undefined;
    if (isIos) {
        content = (
            <div className="center-content-container">
                <div className="content-text">iOS is not supported.</div>
            </div>
        );
    } else if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress =
            ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        content = (
            <div className="center-content-container">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    } else if (mapViewer) {
        content = (
            <MapViewerContainer
                mapViewer={mapViewer}
                caches={caches}
            ></MapViewerContainer>
        );
    }
    return <div className="App">{content}</div>;
}

export default MapViewerApp;
