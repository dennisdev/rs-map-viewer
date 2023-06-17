import Denque from "denque";
import { mat4, vec2, vec3, vec4 } from "gl-matrix";
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
import { clamp } from "../client/util/MathUtil";
import WebGLCanvas from "../components/Canvas";
import { OsrsLoadingBar } from "../components/OsrsLoadingBar";
import { MenuOption, OsrsMenu, OsrsMenuProps } from "../components/OsrsMenu";
import { readPixelsAsync } from "./util/AsyncReadUtil";
import { FrustumIntersection } from "./util/FrustumIntersection";
import "./MapViewer.css";
import { fetchNpcSpawns, NpcSpawn } from "./npc/NpcSpawn";
import { ChunkDataLoader } from "./chunk/ChunkDataLoader";
import { ChunkLoaderWorkerPool } from "./chunk/ChunkLoaderWorkerPool";
import mainFragShader from "./shaders/main.frag.glsl";
import mainVertShader from "./shaders/main.vert.glsl";
import npcVertShader from "./shaders/npc.vert.glsl";
import frameFragShader from "./shaders/frame.frag.glsl";
import frameVertShader from "./shaders/frame.vert.glsl";
import frameFxaaFragShader from "./shaders/frame-fxaa.frag.glsl";
import frameFxaaVertShader from "./shaders/frame-fxaa.vert.glsl";
import { Npc } from "./npc/Npc";
import { Chunk, deleteChunk, loadChunk } from "./chunk/Chunk";
import { isIos, isTouchDevice, isWallpaperEngine } from "./util/DeviceUtil";
import {
    CacheInfo,
    deleteOldCaches,
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
import { InteractType } from "./chunk/InteractType";
import { CachedItemLoader, ItemLoader } from "../client/fs/loader/ItemLoader";
import { ChunkData } from "./chunk/ChunkData";
import { DrawRange } from "./chunk/DrawRange";
import { ItemSpawn, fetchItemSpawns } from "./item/ItemSpawn";
import { MinimapContainer } from "../components/minimap/MinimapContainer";
import { MinimapImage } from "../components/minimap/MinimapImage";
import { WorldMapModal } from "../components/worldmap/WorldMapModal";
import { Camera, ProjectionType } from "./Camera";
import { RS_TO_DEGREES, RS_TO_RADIANS } from "./MathConstants";

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

function getAxisDeadzone(axis: number, zone: number): number {
    if (Math.abs(axis) < zone) {
        return 0;
    } else if (axis < 0) {
        return axis + zone;
    } else {
        return axis - zone;
    }
}

function getRegionDistance(
    x: number,
    y: number,
    regionX: number,
    regionY: number
): number {
    const dx = Math.max(Math.abs(x - (regionX * 64 + 32)) - 32, 0);
    const dy = Math.max(Math.abs(y - (regionY * 64 + 32)) - 32, 0);
    return Math.sqrt(dx * dx + dy * dy);
}

export enum AntiAliasType {
    NONE,
    FXAA,
}

export interface CameraPosition {
    position: vec3;
    pitch: number;
    yaw: number;
}

type RegionId = number;

const TEXTURE_SIZE = 128;

const CHUNK_RENDER_FRAME_DELAY = 4;

const INTERACTION_RADIUS = 5;
const INTERACTION_SIZE = INTERACTION_RADIUS * 2 + 1;

const NULL_DRAW_RANGE: DrawRange = [0, 0, 0];

const DEFAULT_VIEW_DISTANCE = isWallpaperEngine ? 5 : 2;

const DEFAULT_RENDER_DISTANCE = DEFAULT_VIEW_DISTANCE * 64;

export class MapViewer {
    chunkLoaderWorker: ChunkLoaderWorkerPool;
    loadedCache!: LoadedCache;
    latestCacheInfo: CacheInfo;
    npcSpawns: NpcSpawn[];
    itemSpawns: ItemSpawn[];

    fileSystem!: MemoryFileSystem;
    textureProvider!: TextureLoader;
    objectLoader!: ObjectLoader;
    npcLoader!: NpcLoader;
    itemLoader!: ItemLoader;
    animationLoader!: AnimationLoader;
    varpManager!: VarpManager;

    pathfinder: Pathfinder = new Pathfinder();

    app!: PicoApp;

    hasMultiDraw: boolean = false;

    keys: Map<string, boolean> = new Map();

    timer!: Timer;

    program?: Program;
    programNpc?: Program;
    programFrame?: Program;
    programFrameFxaa?: Program;

    frameBuffer!: Framebuffer;

    resolutionUni: vec2 = vec2.fromValues(0, 0);
    frameDrawCall!: DrawCall;
    frameFxaaDrawCall!: DrawCall;

    quadPositions!: VertexBuffer;
    quadArray!: VertexArray;

    textureUniformBuffer?: UniformBuffer;
    sceneUniformBuffer!: UniformBuffer;

    textureArray?: Texture;

    chunks: Map<number, Chunk> = new Map();
    minimapUrls: Map<number, string> = new Map();

    loadingRegionIds: Set<number> = new Set();
    loadingMinimapRegionIds: Set<number> = new Set();
    invalidRegionIds: Set<number> = new Set();

    chunksToLoad: Denque<ChunkData> = new Denque();

    camera: Camera = new Camera(3242, -26, 3202, 0, 0);

    frameCount: number = 0;
    fps: number = 0;
    fpsFrameCount: number = 0;
    fpsLastTime: number = 0;

    fpsLimit: number = 0;

    lastFrameTime: number = 0;
    lastClientTick: number = 0;
    lastTick: number = 0;

    onInit?: () => void;
    onFps?: (fps: number) => void;
    onCameraMove?: (pos: vec3, pitch: number, yaw: number) => void;
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

    renderDistance: number = DEFAULT_RENDER_DISTANCE;
    renderDistanceUpdated: boolean = false;

    regionUnloadDistance: number = 2;
    regionLodDistance: number = 3;

    renderRegionBounds: vec4 = vec4.fromValues(0, 0, 0, 0);

    visibleRegionCount: number = 0;
    visibleRegions: RegionId[] = [];

    visibleChunkCount: number = 0;
    visibleChunks: Chunk[] = [];

    skyColor: vec4 = vec4.fromValues(0, 0, 0, 1);
    fogDepth: number = 16;
    brightness: number = 1.0;
    colorBanding: number = 255;

    antiAliasing: AntiAliasType = AntiAliasType.NONE;

    loadNpcs: boolean = true;
    loadItems: boolean = true;
    maxPlane: number = Scene.MAX_PLANE - 1;

    tooltips: boolean = true;

    cullBackFace: boolean = true;
    lastCullBackFace: boolean = true;

    positionJoystickEvent?: IJoystickUpdateEvent;
    cameraJoystickEvent?: IJoystickUpdateEvent;

    gamepadIndex?: number;

    currentMouseX: number = -1;
    currentMouseY: number = -1;

    startMouseX: number = -1;
    startMouseY: number = -1;

    startPitch: number = -1;
    startYaw: number = -1;

    pickX: number = -1;
    pickY: number = -1;

    menuX: number = -1;
    menuY: number = -1;

    closestInteractions = new Map<number, number[]>();

    interactBuffer: Uint8Array = new Uint8Array(
        INTERACTION_SIZE * INTERACTION_SIZE * 4
    );
    interactRegionBuffer: Uint8Array = new Uint8Array(
        INTERACTION_SIZE * INTERACTION_SIZE * 4
    );

    hoveredRegionIds = new Set<number>();

    chunkDataLoader?: ChunkDataLoader;

    cameraPosUni: vec2 = vec2.fromValues(0, 0);

    lastCameraX: number = -1;
    lastCameraY: number = -1;

    lastCameraRegionX: number = -1;
    lastCameraRegionY: number = -1;

    frustumIntersection: FrustumIntersection = new FrustumIntersection();
    chunkIntersectBox: number[][] = [
        [0, (-240 * 10) / 128, 0],
        [0, (240 * 3) / 128, 0],
    ];

    isVisiblePos: vec3 = [0, 0, 0];

    npcRenderCount: number = 0;
    npcRenderData: Uint16Array = new Uint16Array(16 * 4);

    npcRenderDataTexture: Texture | undefined;
    npcDataTextureBuffer: (Texture | undefined)[] = new Array(5);

    constructor(
        chunkLoaderWorker: ChunkLoaderWorkerPool,
        loadedCache: LoadedCache,
        latestCacheInfo: CacheInfo,
        npcSpawns: NpcSpawn[],
        itemSpawns: ItemSpawn[]
    ) {
        this.chunkLoaderWorker = chunkLoaderWorker;
        this.latestCacheInfo = latestCacheInfo;
        this.npcSpawns = npcSpawns;
        this.itemSpawns = itemSpawns;

        this.initCache(loadedCache);

        if (isWallpaperEngine && window.wallpaperFpsLimit) {
            this.fpsLimit = window.wallpaperFpsLimit;
        }

        window.wallpaperPropertyListener = {
            applyGeneralProperties: (properties: any) => {
                if (properties.fps) {
                    this.fpsLimit = properties.fps;
                }
            },
        };

        window.addEventListener("gamepadconnected", (e) => {
            console.log("gamepad connected", e.gamepad);
            this.gamepadIndex = e.gamepad.index;
        });
        window.addEventListener("gamepaddisconnected", (e) => {
            this.gamepadIndex = undefined;
        });

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
        this.onHoveredRegionBuffer = this.onHoveredRegionBuffer.bind(this);
        this.checkInteractions = this.checkInteractions.bind(this);
        this.render = this.render.bind(this);
    }

    initCache(cache: LoadedCache) {
        this.loadedCache = cache;

        this.chunkLoaderWorker.init(cache, this.npcSpawns, this.itemSpawns);

        this.fileSystem = loadFromStore(cache.store);

        const configIndex = this.fileSystem.getIndex(IndexType.CONFIGS);
        const mapIndex = this.fileSystem.getIndex(IndexType.MAPS);
        const spriteIndex = this.fileSystem.getIndex(IndexType.SPRITES);
        const textureIndex = this.fileSystem.getIndex(IndexType.TEXTURES);

        const objectArchive = configIndex.getArchive(ConfigType.OBJECT);
        const npcArchive = configIndex.getArchive(ConfigType.NPC);
        const itemArchive = configIndex.getArchive(ConfigType.ITEM);
        const animationArchive = configIndex.getArchive(ConfigType.SEQUENCE);
        const varbitArchive = configIndex.getArchive(ConfigType.VARBIT);

        this.objectLoader = new CachedObjectLoader(objectArchive, cache.info);
        this.npcLoader = new CachedNpcLoader(npcArchive, cache.info);
        this.itemLoader = new CachedItemLoader(itemArchive, cache.info);
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

        this.textureProvider = TextureLoader.load(
            textureIndex,
            spriteIndex,
            cache.info
        );

        if (this.app) {
            this.deleteChunks();
            this.deleteMinimaps();
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

        this.renderRegionBounds.fill(0);
    }

    init(gl: WebGL2RenderingContext) {
        // console.log('init start', performance.now());
        if (!(gl.canvas instanceof HTMLCanvasElement)) {
            return;
        }

        if (!isWallpaperEngine) {
            gl.canvas.addEventListener("keydown", this.onKeyDown);
            gl.canvas.addEventListener("keyup", this.onKeyUp);
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
        gl.canvas.addEventListener("mousemove", this.onMouseMove);

        const cameraX = this.camera.getPosX();
        const cameraY = this.camera.getPosZ();

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

        this.tooltips = this.hasMultiDraw && !isTouchDevice;

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
                prependShader(frameVertShader, this.hasMultiDraw),
                prependShader(frameFragShader, this.hasMultiDraw),
            ],
            [
                prependShader(frameFxaaVertShader, this.hasMultiDraw),
                prependShader(frameFxaaFragShader, this.hasMultiDraw),
            ]
        ).then(([program, programNpc, programFrame, programFrameFxaa]) => {
            this.program = program;
            this.programNpc = programNpc;
            this.programFrame = programFrame;
            this.programFrameFxaa = programFrameFxaa;

            this.frameDrawCall = app
                .createDrawCall(this.programFrame, this.quadArray)
                .texture("u_frame", this.frameBuffer.colorAttachments[0]);

            this.frameFxaaDrawCall = app
                .createDrawCall(this.programFrameFxaa, this.quadArray)
                .texture("u_frame", this.frameBuffer.colorAttachments[0]);
        });

        this.sceneUniformBuffer = app.createUniformBuffer([
            PicoGL.FLOAT_MAT4,
            PicoGL.FLOAT_MAT4,
            PicoGL.FLOAT_MAT4,
            PicoGL.FLOAT_VEC4,
            PicoGL.FLOAT_VEC2,
            PicoGL.FLOAT,
            PicoGL.FLOAT,
        ]);

        this.initTextures();

        console.timeEnd("first load");

        console.log(gl.getSupportedExtensions());

        if (this.onInit) {
            this.onInit();
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
        const cx = this.camera.getPosX().toFixed(2).toString();
        const cy = -this.camera.getPosY().toFixed(2).toString();
        const cz = this.camera.getPosZ().toFixed(2).toString();

        const yaw = this.camera.yaw & 2047;

        const p = (this.camera.pitch | 0).toString();
        const y = yaw.toString();

        const params: any = {
            cx,
            cy,
            cz,
            p,
            y,
        };

        if (this.camera.projectionType === ProjectionType.ORTHO) {
            params["pt"] = "o";
            params["z"] = this.camera.orthoZoom.toString();
        }

        if (this.loadedCache.info.name !== this.latestCacheInfo.name) {
            params["cache"] = this.loadedCache.info.name;
        }

        return params;
    }

    setSkyColor(r: number, g: number, b: number) {
        this.skyColor[0] = r / 255;
        this.skyColor[1] = g / 255;
        this.skyColor[2] = b / 255;
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
        this.startPitch = this.camera.pitch;
        this.startYaw = this.camera.yaw;
    }

    onTouchStart(event: TouchEvent) {
        const [x, y] = getMousePos(this.app.canvas, event.touches[0]);
        this.startMouseX = x;
        this.startMouseY = y;
        this.currentMouseX = x;
        this.currentMouseY = y;
        this.startPitch = this.camera.pitch;
        this.startYaw = this.camera.yaw;
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
        this.currentMouseX = -1;
        this.currentMouseY = -1;
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
        vec3.transformMat4(pos, pos, this.camera.viewProjMatrix);
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

        return this.camera.frustum.intersectsBox(this.chunkIntersectBox);
    }

    /**
     * Sets the camera position to a new arbitrary position
     * @param newPosition Any of the items you want to move: Position, pitch, yaw
     */
    setCamera(newPosition: Partial<CameraPosition>): void {
        if (newPosition.position) {
            vec3.copy(this.camera.pos, newPosition.position);
        }
        if (newPosition.pitch) {
            this.camera.pitch = newPosition.pitch;
        }
        if (newPosition.yaw) {
            this.camera.yaw = newPosition.yaw;
        }
        this.camera.updated = true;
    }

    runCameraCallbacks() {
        this.runCameraMoveCallback();
        this.runCameraMoveEndCallback();
    }

    runCameraMoveCallback() {
        if (this.onCameraMove) {
            const yaw = this.camera.yaw & 2047;
            this.onCameraMove(this.camera.pos, this.camera.pitch, yaw);
        }
    }

    runCameraMoveEndCallback() {
        if (this.onCameraMoveEnd) {
            const yaw = this.camera.yaw & 2047;
            this.onCameraMoveEnd(this.camera.pos, this.camera.pitch, yaw);
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
                        this.loadItems,
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

    async queueMinimapLoad(regionX: number, regionY: number) {
        const regionId = RegionLoader.getRegionId(regionX, regionY);
        if (
            this.loadingMinimapRegionIds.size <
                this.chunkLoaderWorker.size * 2 &&
            !this.loadingMinimapRegionIds.has(regionId) &&
            !this.loadingRegionIds.has(regionId) &&
            !this.minimapUrls.has(regionId) &&
            !this.invalidRegionIds.has(regionId)
        ) {
            this.loadingRegionIds.add(regionId);

            const minimapData = await this.chunkLoaderWorker.pool.queue(
                (worker) => worker.loadMinimap(regionX, regionY, 0)
            );

            if (!minimapData) {
                this.invalidRegionIds.add(regionId);
            } else if (
                minimapData.cacheInfo.name === this.loadedCache.info.name
            ) {
                this.setMinimapUrl(
                    regionId,
                    URL.createObjectURL(minimapData.minimapBlob)
                );
            }

            this.loadingRegionIds.delete(regionId);
        }
    }

    getMinimapUrl(regionX: number, regionY: number) {
        this.queueMinimapLoad(regionX, regionY);
        const regionId = RegionLoader.getRegionId(regionX, regionY);
        return this.minimapUrls.get(regionId);
    }

    setMinimapUrl(regionId: number, url: string) {
        const old = this.minimapUrls.get(regionId);
        if (old) {
            URL.revokeObjectURL(old);
        }
        this.minimapUrls.set(regionId, url);
    }

    deleteChunks() {
        for (const chunk of this.chunks.values()) {
            deleteChunk(chunk);
        }
        this.chunks.clear();
        this.loadingRegionIds.clear();
        this.chunksToLoad.clear();
    }

    deleteMinimaps() {
        for (const url of this.minimapUrls.values()) {
            URL.revokeObjectURL(url);
        }
        this.minimapUrls.clear();
        this.loadingMinimapRegionIds.clear();
    }

    setLoadNpcs(load: boolean) {
        if (this.loadNpcs !== load) {
            this.deleteChunks();
        }
        this.loadNpcs = load;
    }

    setLoadItems(load: boolean) {
        if (this.loadItems !== load) {
            this.deleteChunks();
        }
        this.loadItems = load;
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
            this.camera.updatePitch(this.camera.pitch, deltaPitch);
        }
        if (this.keys.get("ArrowDown")) {
            this.camera.updatePitch(this.camera.pitch, -deltaPitch);
        }
        if (this.keys.get("ArrowRight")) {
            this.camera.updateYaw(this.camera.yaw, deltaYaw);
        }
        if (this.keys.get("ArrowLeft")) {
            this.camera.updateYaw(this.camera.yaw, -deltaYaw);
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

            this.camera.move(
                moveX * 32 * -deltaTime,
                0,
                moveY * 32 * -deltaTime
            );
        }

        if (this.cameraJoystickEvent) {
            const moveX = this.cameraJoystickEvent.x || 0;
            const moveY = this.cameraJoystickEvent.y || 0;
            this.camera.updatePitch(
                this.camera.pitch,
                deltaPitch * 1.5 * moveY
            );
            this.camera.updateYaw(this.camera.yaw, deltaYaw * 1.5 * moveX);
        }

        // controller
        let gamepad: Gamepad | null = null;
        if (this.gamepadIndex !== undefined) {
            const gamepads = navigator.getGamepads();
            if (gamepads) {
                gamepad = gamepads[this.gamepadIndex];
            }
        }

        if (gamepad && gamepad.connected && gamepad.mapping === "standard") {
            // X
            if (gamepad.buttons[0].value === 1) {
                cameraSpeedMult = 10;
            }

            const zone = 0.1;

            const leftX = getAxisDeadzone(gamepad.axes[0], zone);
            const leftY = getAxisDeadzone(-gamepad.axes[1], zone);
            const leftTrigger = gamepad.buttons[6].value;

            const rightX = getAxisDeadzone(gamepad.axes[2], zone);
            const rightY = getAxisDeadzone(-gamepad.axes[3], zone);
            const rightTrigger = gamepad.buttons[7].value;

            const trigger = leftTrigger - rightTrigger;

            if (leftX !== 0 || leftY !== 0 || trigger !== 0) {
                this.camera.move(
                    leftX * 32 * cameraSpeedMult * -deltaTime,
                    trigger * 32 * cameraSpeedMult * -deltaTime,
                    leftY * 32 * cameraSpeedMult * -deltaTime
                );
            }

            if (rightX !== 0) {
                this.camera.updateYaw(this.camera.yaw, deltaYaw * 1.5 * rightX);
            }
            if (rightY !== 0) {
                this.camera.updatePitch(
                    this.camera.pitch,
                    deltaPitch * 1.5 * rightY
                );
            }
        }

        // mouse/touch controls
        if (this.startMouseX !== -1 && this.startMouseY !== -1) {
            const deltaMouseX = this.startMouseX - this.currentMouseX;
            const deltaMouseY = this.startMouseY - this.currentMouseY;

            if (isTouchDevice) {
                this.camera.move(0, clamp(deltaMouseY, -100, 100) * 0.004, 0);
            } else {
                this.camera.updatePitch(this.startPitch, deltaMouseY * 0.9);
                this.camera.updateYaw(this.startYaw, deltaMouseX * -0.9);
            }
        }

        // camera position controls
        if (this.keys.get("w") || this.keys.get("W")) {
            this.camera.move(0, 0, -16 * cameraSpeedMult * deltaTime);
        }
        if (this.keys.get("a") || this.keys.get("A")) {
            this.camera.move(16 * cameraSpeedMult * deltaTime, 0, 0);
        }
        if (this.keys.get("s") || this.keys.get("S")) {
            this.camera.move(0, 0, 16 * cameraSpeedMult * deltaTime);
        }
        if (this.keys.get("d") || this.keys.get("D")) {
            this.camera.move(-16 * cameraSpeedMult * deltaTime, 0, 0);
        }
        if (this.keys.get("e") || this.keys.get("E")) {
            this.camera.move(0, -8 * cameraSpeedMult * deltaTime, 0);
        }
        if (
            this.keys.get("q") ||
            this.keys.get("Q") ||
            this.keys.get("c") ||
            this.keys.get("C")
        ) {
            this.camera.move(0, 8 * cameraSpeedMult * deltaTime, 0);
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
                this.fps,
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
        ).then(this.onHoveredRegionBuffer);
    }

    onHoveredRegionBuffer(buf: ArrayBufferView) {
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
        this.closestInteractions.clear();

        for (let x = 0; x < INTERACTION_SIZE; x++) {
            for (let y = 0; y < INTERACTION_SIZE; y++) {
                const index = (x + y * INTERACTION_SIZE) * 4;
                if (this.interactBuffer[index + 2] !== 0) {
                    const dist = Math.max(
                        Math.abs(x - INTERACTION_RADIUS),
                        Math.abs(y - INTERACTION_RADIUS)
                    );
                    const interactions = this.closestInteractions.get(dist);
                    if (interactions) {
                        interactions.push(index);
                    } else {
                        this.closestInteractions.set(dist, [index]);
                    }
                }
            }
        }

        const menuOptions: MenuOption[] = [];
        const examineOptions: MenuOption[] = [];

        const interactions: number[] = [];
        for (let i = 0; i < INTERACTION_SIZE; i++) {
            const interactionsAtDist = this.closestInteractions.get(i);
            if (interactionsAtDist) {
                interactions.push(...interactionsAtDist);
            }
        }

        const npcIds = new Set<number>();
        const objectIds = new Set<number>();
        const itemIds = new Set<number>();

        for (const index of interactions) {
            const interactId =
                (this.interactBuffer[index] << 8) |
                this.interactBuffer[index + 1];
            if (interactId === 0xffff) {
                continue;
            }
            const interactType: InteractType = this.interactBuffer[index + 2];
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
                    const target = {
                        name: objectName,
                        type: InteractType.OBJECT,
                    };

                    menuOptions.push(
                        ...def.actions
                            .filter((action) => !!action)
                            .map(
                                (action): MenuOption => ({
                                    id: objectId,
                                    action,
                                    target,
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
                        target,
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

                    const target = {
                        name: npcName,
                        type: InteractType.NPC,
                    };

                    menuOptions.push(
                        ...def.actions
                            .filter((action) => !!action)
                            .map(
                                (action): MenuOption => ({
                                    id: npcId,
                                    action,
                                    target,
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
                        target,
                        level: npcLevel,
                        onClick: openWikiOnClick,
                    });
                }
            } else if (interactType === InteractType.ITEM) {
                if (itemIds.has(interactId)) {
                    continue;
                }
                itemIds.add(interactId);

                const def = this.itemLoader.getDefinition(interactId);

                const itemId = def.id;
                const itemName = def.name;

                const target = {
                    name: itemName,
                    type: InteractType.ITEM,
                };

                menuOptions.push(
                    ...def.groundActions
                        .filter((action): action is string => !!action)
                        .map(
                            (action): MenuOption => ({
                                id: itemId,
                                action,
                                target,
                                onClick: this.closeMenu,
                            })
                        )
                );

                const openWikiOnClick = () => {
                    window.open(
                        "https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=" +
                            itemId,
                        "_blank"
                    );
                };

                examineOptions.push({
                    id: itemId,
                    action: "Examine",
                    target,
                    onClick: openWikiOnClick,
                });
            } else {
                console.warn("Unknown interact type: " + interactType);
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

        // this.setFps(1.0 / deltaTime);

        if (time - this.fpsLastTime > 1.0) {
            this.fpsLastTime = time;
            this.setFps(this.fpsFrameCount);
            this.fpsFrameCount = 0;
        }

        this.fpsFrameCount++;

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

        if (this.lastCullBackFace !== this.cullBackFace) {
            this.updateCullFace();
        }

        const lastCameraUpdated = this.camera.updated;
        this.camera.updated = false;

        this.handleInput(time, deltaTime);
        if (this.hasMultiDraw && (!isTouchDevice || this.tooltips)) {
            this.readHoveredRegion();
        }
        if (this.tooltips) {
            this.readHover();
        }

        if (
            !this.menuOpen &&
            this.tooltips &&
            this.currentMouseX !== -1 &&
            this.currentMouseY !== -1
        ) {
            this.checkInteractions(
                this.currentMouseX,
                this.currentMouseY,
                true
            );
        }

        if (this.camera.updated) {
            this.runCameraMoveCallback();
        }
        if (lastCameraUpdated && !this.camera.updated) {
            this.runCameraMoveEndCallback();
        }

        this.camera.update(canvasWidth, canvasHeight);

        const cameraX = this.camera.getPosX();
        const cameraY = this.camera.getPosZ();

        this.cameraPosUni[0] = cameraX;
        this.cameraPosUni[1] = cameraY;

        const cameraRegionX = (cameraX / 64) | 0;
        const cameraRegionY = (cameraY / 64) | 0;

        this.sceneUniformBuffer
            .set(0, this.camera.viewProjMatrix as Float32Array)
            .set(1, this.camera.viewMatrix as Float32Array)
            .set(2, this.camera.projectionMatrix as Float32Array)
            .set(3, this.skyColor as Float32Array)
            .set(4, this.cameraPosUni as Float32Array)
            .set(5, this.renderDistance as any)
            .set(6, this.fogDepth as any)
            .update();

        const renderDistance = this.renderDistance;

        const renderStartX = Math.floor((cameraX - renderDistance) / 64);
        const renderStartY = Math.floor((cameraY - renderDistance) / 64);

        const renderEndX = Math.ceil((cameraX + renderDistance) / 64);
        const renderEndY = Math.ceil((cameraY + renderDistance) / 64);

        this.timer.start();

        const renderBoundsChanged =
            this.renderRegionBounds[0] !== renderStartX ||
            this.renderRegionBounds[1] !== renderStartY ||
            this.renderRegionBounds[2] !== renderEndX ||
            this.renderRegionBounds[3] !== renderEndY;

        if (renderBoundsChanged) {
            this.visibleRegionCount = 0;
            for (let x = renderStartX; x < renderEndX; x++) {
                for (let y = renderStartY; y < renderEndY; y++) {
                    const regionX = x;
                    const regionY = y;
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

                    this.visibleRegions[this.visibleRegionCount++] = regionId;
                }
            }
        }

        this.visibleRegions.length = this.visibleRegionCount;
        // sort front to back
        this.visibleRegions.sort((a, b) => {
            const regionDistA = getRegionDistance(
                cameraX,
                cameraY,
                a >> 8,
                a & 0xff
            );
            const regionDistB = getRegionDistance(
                cameraX,
                cameraY,
                b >> 8,
                b & 0xff
            );
            return regionDistA - regionDistB;
        });

        this.visibleChunkCount = 0;
        for (let i = 0; i < this.visibleRegionCount; i++) {
            const regionId = this.visibleRegions[i];
            const chunk = this.chunks.get(regionId);
            if (!chunk) {
                this.queueChunkLoad(regionId >> 8, regionId & 0xff);
                continue;
            }
            if (
                !this.isChunkVisible(chunk.regionX, chunk.regionY) ||
                this.frameCount - chunk.frameLoaded < CHUNK_RENDER_FRAME_DELAY
            ) {
                continue;
            }

            this.visibleChunks[this.visibleChunkCount++] = chunk;
        }

        this.npcRenderCount = 0;
        for (let i = 0; i < this.visibleChunkCount; i++) {
            const chunk = this.visibleChunks[i];

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
        }

        const npcDataTextureIndex = this.updateNpcDataTexture();
        const npcRenderDataTexture =
            this.npcDataTextureBuffer[npcDataTextureIndex];

        this.app.drawFramebuffer(this.frameBuffer);

        // There might be a more efficient way to do this
        this.app.clear();
        gl.clearBufferfv(gl.COLOR, 0, this.skyColor);

        this.app.disable(gl.BLEND);

        // opaque pass, front to back
        for (let i = 0; i < this.visibleChunkCount; i++) {
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
        // opaque npc pass, front to back
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
                const frame = anim.frames[frameId];

                (drawCall as any).offsets[i] = frame[0];
                (drawCall as any).numElements[i] = frame[1];

                drawRanges[i] = frame;
            });

            this.draw(drawCall, drawRanges);
        }

        this.app.enable(gl.BLEND);

        // alpha pass, back to front
        for (let i = this.visibleChunkCount - 1; i >= 0; i--) {
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
        // alpha npc pass, back to front
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
                let frame: DrawRange = NULL_DRAW_RANGE;
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

        if (this.antiAliasing === AntiAliasType.FXAA) {
            this.resolutionUni[0] = canvasWidth;
            this.resolutionUni[1] = canvasHeight;

            this.frameFxaaDrawCall.uniform("u_resolution", this.resolutionUni);
            this.frameFxaaDrawCall.draw();
        } else {
            this.frameDrawCall.draw();
        }

        if (this.keys.get("h")) {
            console.log(
                "rendered chunks",
                this.visibleChunkCount,
                this.frustumIntersection.planes
            );
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
                    chunkData.loadItems === this.loadItems &&
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
                    this.setMinimapUrl(
                        regionId,
                        URL.createObjectURL(chunkData.minimapBlob)
                    );
                }
                this.loadingRegionIds.delete(regionId);
            }
        }

        if (this.visibleChunkCount > this.visibleChunks.length) {
            // Delete 1 per frame
            this.visibleChunks.length -= 1;
        }

        for (const chunk of this.chunks.values()) {
            const regionX = chunk.regionX;
            const regionY = chunk.regionY;
            if (
                regionX < renderStartX - this.regionUnloadDistance ||
                regionX > renderEndX + this.regionUnloadDistance ||
                regionY < renderStartY - this.regionUnloadDistance ||
                regionY > renderEndY + this.regionUnloadDistance
            ) {
                console.log("deleting chunk", regionX, regionY);
                deleteChunk(chunk);
                this.chunks.delete(RegionLoader.getRegionId(regionX, regionY));
            }
        }

        this.timer.end();

        this.frameCount++;

        this.renderDistanceUpdated = false;

        this.renderRegionBounds[0] = renderStartX;
        this.renderRegionBounds[1] = renderStartY;
        this.renderRegionBounds[2] = renderEndX;
        this.renderRegionBounds[3] = renderEndY;

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
    const [downloadProgress, setDownloadProgress] = useState<
        DownloadProgress | undefined
    >(undefined);
    const [fps, setFps] = useState<number>(0);
    const [compassDegrees, setCompassDegrees] = useState<number>(0);
    const [menuProps, setMenuProps] = useState<OsrsMenuProps | undefined>(
        undefined
    );
    const [hudHidden, setHudHidden] = useState<boolean>(isWallpaperEngine);
    const [minimapImages, setMinimapImages] = useState<JSX.Element[]>([]);
    const [isWorldMapOpen, setWorldMapOpen] = useState<boolean>(false);

    function openWorldMap() {
        setWorldMapOpen(true);
    }

    function closeWorldMap() {
        setWorldMapOpen(false);
        mapViewer.app.canvas.focus();
    }

    useEffect(() => {
        mapViewer.onInit = () => {
            setInited(true);
        };
        if (mapViewer.textureUniformBuffer) {
            setInited(true);
        }
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

        const callback = (time: number) => {
            if (!mapViewer.hudHidden) {
                const cameraX = mapViewer.camera.getPosX();
                const cameraY = mapViewer.camera.getPosZ();

                const cameraRegionX = (cameraX / 64) | 0;
                const cameraRegionY = (cameraY / 64) | 0;

                const offsetX = (-128 + (cameraX % 64) * 4) | 0;
                const offsetY = (-128 + (cameraY % 64) * 4) | 0;

                const images: JSX.Element[] = [];

                for (let rx = 0; rx < 3; rx++) {
                    for (let ry = 0; ry < 3; ry++) {
                        const regionX = cameraRegionX - 1 + rx;
                        const regionY = cameraRegionY - 1 + ry;

                        const regionId = RegionLoader.getRegionId(
                            regionX,
                            regionY
                        );

                        const minimapUrl = mapViewer.getMinimapUrl(
                            regionX,
                            regionY
                        );

                        const url = minimapUrl
                            ? minimapUrl
                            : "/minimap-black.png";

                        const x = rx * 255 - offsetX;
                        const y = 255 * 2 - ry * 255 + offsetY;

                        images.push(
                            <MinimapImage
                                key={regionId}
                                src={url}
                                left={x}
                                top={y}
                            />
                        );
                    }
                }

                setFps(mapViewer.fps);
                setCompassDegrees(
                    (mapViewer.camera.yaw & 2047) * RS_TO_DEGREES
                );
                setMinimapImages(images);
            }

            window.requestAnimationFrame(callback);
        };
        window.requestAnimationFrame(callback);
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

    function getMapPosition() {
        const cameraX = mapViewer.camera.getPosX();
        const cameraY = mapViewer.camera.getPosZ();

        return {
            x: cameraX | 0,
            y: cameraY | 0,
        };
    }

    function onMapClicked(x: number, y: number) {
        mapViewer.camera.pos[0] = x;
        mapViewer.camera.pos[2] = y;
        mapViewer.camera.updated = true;
        closeWorldMap();
    }

    function loadMapImageUrl(regionX: number, regionY: number) {
        return mapViewer.getMinimapUrl(regionX, regionY);
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
                        {minimapImages && (
                            <MinimapContainer
                                yawDegrees={compassDegrees}
                                onCompassClick={() => {
                                    mapViewer.camera.setYaw(0);
                                }}
                                onWorldMapClick={openWorldMap}
                            >
                                {minimapImages}
                            </MinimapContainer>
                        )}
                        <div className="fps-counter content-text">
                            {fps.toFixed(1)}
                        </div>
                    </div>
                    <WorldMapModal
                        isOpen={isWorldMapOpen}
                        onRequestClose={closeWorldMap}
                        getPosition={getMapPosition}
                        onDoubleClick={onMapClicked}
                        loadMapImageUrl={loadMapImageUrl}
                    />
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

const MAX_POOL_SIZE = isWallpaperEngine ? 1 : 4;

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
            const npcSpawnsPromise = fetchNpcSpawns();
            const itemSpawnsPromise = fetchItemSpawns();

            const cacheNameParam = searchParams.get("cache");
            const caches = await cachesPromise;
            deleteOldCaches(caches);
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

            console.time("load item spawns");
            const itemSpawns = await itemSpawnsPromise;
            console.timeEnd("load item spawns");

            console.log("item spawn count", itemSpawns.length);

            const mapViewer = new MapViewer(
                pool,
                loadedCache,
                latestCacheInfo,
                npcSpawns,
                itemSpawns
            );

            const cx = searchParams.get("cx");
            const cy = searchParams.get("cy");
            const cz = searchParams.get("cz");

            const pitch = searchParams.get("p");
            const yaw = searchParams.get("y");

            if (searchParams.get("pt") === "o") {
                mapViewer.camera.projectionType = ProjectionType.ORTHO;
            }

            const zoom = searchParams.get("z");
            if (zoom) {
                mapViewer.camera.orthoZoom = parseInt(zoom);
            }

            if (cx && cy && cz) {
                const pos: vec3 = vec3.fromValues(
                    parseFloat(cx),
                    -parseFloat(cy),
                    parseFloat(cz)
                );
                mapViewer.camera.pos = pos;
            }
            if (pitch) {
                mapViewer.camera.pitch = parseInt(pitch);
            }
            if (yaw) {
                mapViewer.camera.yaw = parseInt(yaw);
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
