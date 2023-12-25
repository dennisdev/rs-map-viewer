import { PicoGL, App as PicoApp } from "picogl";
import { CacheList, LoadedCache } from "./Caches";
import { Renderer } from "./renderer/Renderer";
import { RenderDataWorkerPool } from "./worker/RenderDataWorkerPool";
import { Camera, CameraPosition, ProjectionType } from "./Camera";
import { InputManager } from "./InputManager";
import { SdRenderer } from "./renderer/sd/SdRenderer";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { CacheLoaderFactory, getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";
import { RenderStats } from "./RenderStats";
import { vec3, vec4 } from "gl-matrix";
import { URLSearchParamsInit } from "react-router-dom";
import { getMapSquareId } from "../rs/map/MapFileIndex";
import { MapManager, MapSquare } from "./renderer/MapManager";
import { Scene } from "../rs/scene/Scene";
import { OsrsMenuEntry } from "../components/rs/menu/OsrsMenu";
import { MenuTargetType } from "../rs/MenuEntry";
import { ObjSpawn } from "./data/obj/ObjSpawn";
import { NpcSpawn } from "./data/npc/NpcSpawn";
import { isTouchDevice, isWallpaperEngine } from "../util/DeviceUtil";

const DEFAULT_RENDER_DISTANCE = isWallpaperEngine ? 512 : 128;

const CACHED_MAP_IMAGE_PREFIX = "/map-images/";

export class MapViewer {
    inputManager: InputManager = new InputManager();
    camera: Camera = new Camera(3242, -26, 3202, -245, 1862);

    loadedCache!: LoadedCache;
    cacheSystem?: CacheSystem;
    loaderFactory?: CacheLoaderFactory;

    app?: PicoApp;
    hasMultiDraw: boolean = false;

    renderer!: Renderer<MapSquare>;

    stats: RenderStats = new RenderStats();

    fpsLimit: number = 0;
    lastFrameTimeSec: DOMHighResTimeStamp = 0;

    lastFrameSearchParamsUpdated: number = 0;

    hudVisible: boolean = !isWallpaperEngine;

    mapImageUrls: Map<number, string> = new Map();
    loadingMapImageIds: Set<number> = new Set();

    needsFramebufferUpdate: boolean = false;

    // Settings

    // Tile distance
    renderDistance: number = DEFAULT_RENDER_DISTANCE;
    // Map square distance
    unloadDistance: number = 2;
    // Map square distance
    lodDistance: number = 3;

    loadObjs: boolean = true;
    loadNpcs: boolean = true;

    maxLevel: number = Scene.MAX_LEVELS - 1;

    skyColor: vec4 = vec4.fromValues(0, 0, 0, 1);
    fogDepth: number = 16;

    brightness: number = 1.0;
    colorBanding: number = 255;

    smoothTerrain: boolean = false;

    cullBackFace: boolean = true;

    // Anti aliasing
    msaaEnabled: boolean = false;
    fxaaEnabled: boolean = false;

    tooltips: boolean = !isTouchDevice;
    debugId: boolean = false;

    menuOpen: boolean = false;
    menuOpenedFrame: number = 0;
    menuX: number = -1;
    menuY: number = -1;
    menuEntries: OsrsMenuEntry[] = [];

    debugText?: string;

    constructor(
        readonly workerPool: RenderDataWorkerPool,
        readonly mapImageCache: Cache,
        readonly cacheList: CacheList,
        readonly objSpawns: ObjSpawn[],
        public npcSpawns: NpcSpawn[],
        cache: LoadedCache,
    ) {
        console.log("MapViewer constructor");
        this.setRenderer(new SdRenderer(this));
        this.initCache(cache);
        this.workerPool.loadCachedMapImages().then((mapImageUrls) => {
            mapImageUrls.forEach((value, key) => this.mapImageUrls.set(key, value));
        });
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

        if (this.loadedCache.info.name !== this.cacheList.latest.name) {
            params["cache"] = this.loadedCache.info.name;
        }

        params["v"] = 1;

        return params;
    }

    applySearchParams(searchParams: URLSearchParams) {
        const cx = searchParams.get("cx");
        const cy = searchParams.get("cy");
        const cz = searchParams.get("cz");

        const pitch = searchParams.get("p");
        const yaw = searchParams.get("y");

        const v = searchParams.get("v");

        if (searchParams.get("pt") === "o") {
            this.camera.projectionType = ProjectionType.ORTHO;
        }

        const zoom = searchParams.get("z");
        if (zoom) {
            this.camera.orthoZoom = parseInt(zoom);
        }

        if (cx && cy && cz) {
            const pos = vec3.fromValues(parseFloat(cx), -parseFloat(cy), parseFloat(cz));
            this.camera.pos = pos;
        }
        if (pitch) {
            this.camera.pitch = parseInt(pitch);
            if (!v) {
                this.camera.pitch = -this.camera.pitch;
            }
        }
        if (yaw) {
            this.camera.yaw = parseInt(yaw);
            if (!v) {
                this.camera.yaw = 2048 - this.camera.yaw;
            }
        }
    }

    init() {
        this.renderer.mapManager.update(
            this.camera,
            this.stats.frameCount,
            this.renderDistance,
            this.unloadDistance,
        );
    }

    initCache(cache: LoadedCache): void {
        this.loadedCache = cache;
        this.cacheSystem = CacheSystem.fromFiles(cache.type, cache.files);
        this.loaderFactory = getCacheLoaderFactory(cache.info, this.cacheSystem);
        this.workerPool.initCache(cache, this.objSpawns, this.npcSpawns);
        this.clearMapImageUrls();
        if (this.renderer) {
            this.renderer.initCache(this.app, this.cacheSystem, this.loaderFactory);
        }
        this.lastFrameSearchParamsUpdated = this.stats.frameCount;
    }

    setRenderer(renderer: Renderer<MapSquare>): void {
        const app = this.app;
        const prevRenderer = this.renderer;
        if (app && prevRenderer) {
            prevRenderer.cleanup(app);
        }
        this.renderer = renderer;
        if (app) {
            renderer.init(app);
        }
    }

    initGl = (gl: WebGL2RenderingContext) => {
        console.log("MapViewer init");

        if (gl.canvas instanceof HTMLCanvasElement) {
            this.inputManager.init(gl.canvas);
        }

        this.app = PicoGL.createApp(gl as any);

        // hack to get the right multi draw extension for picogl
        const state: any = this.app.state;
        const ext = gl.getExtension("WEBGL_multi_draw");
        PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED = ext;
        state.extensions.multiDrawInstanced = ext;

        this.hasMultiDraw = !!PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED;

        if (this.renderer) {
            this.renderer.init(this.app);
        }
    };

    static getCachedMapImageUrl(mapX: number, mapY: number): string {
        return CACHED_MAP_IMAGE_PREFIX + `${mapX}_${mapY}.png`;
    }

    async queueMinimapLoad(mapX: number, mapY: number) {
        const mapManager = this.renderer.mapManager;
        const mapId = getMapSquareId(mapX, mapY);
        if (
            this.loadingMapImageIds.size > this.workerPool.size * 4 ||
            this.mapImageUrls.has(mapId) ||
            this.loadingMapImageIds.has(mapId) ||
            mapManager.invalidMapIds.has(mapId) ||
            mapManager.loadingMapIds.has(mapId)
        ) {
            return;
        }
        this.loadingMapImageIds.add(mapId);

        const minimapData = await this.workerPool.queueMinimap(mapX, mapY, 0);
        if (minimapData) {
            const url = URL.createObjectURL(minimapData.minimapBlob);
            this.setMapImageUrl(mapX, mapY, url);
        } else {
            mapManager.invalidMapIds.add(mapId);
        }

        this.loadingMapImageIds.delete(mapId);
    }

    getMapImageUrl(mapX: number, mapY: number): string | undefined {
        if (mapX < 0 || mapY < 0 || mapX >= MapManager.MAX_MAP_X || mapY >= MapManager.MAX_MAP_Y) {
            return undefined;
        }
        this.queueMinimapLoad(mapX, mapY);
        const mapId = getMapSquareId(mapX, mapY);
        return this.mapImageUrls.get(mapId);
    }

    setMapImageUrl(mapX: number, mapY: number, url: string, cache: boolean = true): void {
        const mapId = getMapSquareId(mapX, mapY);
        const old = this.mapImageUrls.get(mapId);
        if (old) {
            URL.revokeObjectURL(old);
        }
        if (cache) {
            fetch(url).then((resp) => {
                if (resp.ok) {
                    const request = new Request(MapViewer.getCachedMapImageUrl(mapX, mapY), {
                        headers: {
                            "RS-Cache-Name": this.loadedCache.info.name,
                        },
                    });
                    this.mapImageCache.put(request, resp);
                }
            });
        }
        this.mapImageUrls.set(mapId, url);
    }

    setLoadObjs(load: boolean) {
        if (this.loadObjs !== load) {
            this.renderer.clearMaps();
        }
        this.loadObjs = load;
    }

    setLoadNpcs(load: boolean) {
        if (this.loadNpcs !== load) {
            this.renderer.clearMaps();
        }
        this.loadNpcs = load;
    }

    setSmoothTerrain(smooth: boolean) {
        if (this.smoothTerrain !== smooth) {
            this.renderer.clearMaps();
        }
        this.smoothTerrain = smooth;
    }

    setMaxLevel(level: number): void {
        if (this.maxLevel !== level) {
            this.renderer.clearMaps();
        }
        this.maxLevel = level;
    }

    setSkyColor(r: number, g: number, b: number) {
        this.skyColor[0] = r / 255;
        this.skyColor[1] = g / 255;
        this.skyColor[2] = b / 255;
    }

    setMsaa(enabled: boolean) {
        this.msaaEnabled = enabled;
        this.needsFramebufferUpdate = true;
    }

    setFxaa(enabled: boolean) {
        this.fxaaEnabled = enabled;
    }

    closeMenu = () => {
        this.menuOpen = false;
        this.menuX = -1;
        this.menuY = -1;
        this.app?.canvas?.focus();
    };

    onExamine = (entry: OsrsMenuEntry) => {
        let lookupType: string | undefined;
        switch (entry.targetType) {
            case MenuTargetType.NPC:
                lookupType = "npc";
                break;
            case MenuTargetType.LOC:
                lookupType = "object";
                break;
            case MenuTargetType.OBJ:
                lookupType = "item";
                break;
        }
        if (lookupType) {
            window.open(
                `https://oldschool.runescape.wiki/w/Special:Lookup?type=${lookupType}&id=${entry.targetId}`,
                "_blank",
            );
        }
        this.closeMenu();
    };

    /**
     * Sets the camera position to a new arbitrary position
     * @param newPosition Any of the items you want to move: Position, pitch, yaw
     */
    setCamera(newPosition: Partial<CameraPosition>): void {
        if (newPosition.position) {
            vec3.copy(this.camera.pos, newPosition.position);
        }
        if (newPosition.pitch !== undefined) {
            this.camera.pitch = newPosition.pitch;
        }
        if (newPosition.yaw !== undefined) {
            this.camera.yaw = newPosition.yaw;
        }
        this.camera.updated = true;
    }

    render = (gl: WebGL2RenderingContext, time: DOMHighResTimeStamp, resized: boolean) => {
        const app = this.app;
        if (!app) {
            return;
        }
        const width = gl.canvas.width;
        const height = gl.canvas.height;
        if (resized) {
            app.resize(width, height);
        }

        if (window.wallpaperFpsLimit !== undefined) {
            this.fpsLimit = window.wallpaperFpsLimit;
        }

        const timeSec = time * 0.001;
        const deltaTimeSec = timeSec - this.lastFrameTimeSec;
        if (this.fpsLimit) {
            const tolerance = 0.001;
            if (deltaTimeSec < 1 / this.fpsLimit - tolerance) {
                return;
            }
        }

        this.stats.update(time);

        if (this.cullBackFace) {
            app.enable(PicoGL.CULL_FACE);
        } else {
            app.disable(PicoGL.CULL_FACE);
        }

        if (this.renderer) {
            this.renderer.render(app, time, deltaTimeSec, resized);
        }

        if (this.camera.updated) {
            this.lastFrameSearchParamsUpdated = this.stats.frameCount;
        }

        this.lastFrameTimeSec = timeSec;
        this.inputManager.onFrameEnd();
        this.camera.onFrameEnd();
        this.stats.onFrameEnd();
    };

    cleanup = (gl: WebGL2RenderingContext) => {
        console.log("MapViewer cleanup");
        this.inputManager.cleanUp();
        this.clearMapImageUrls();
        if (this.app && this.renderer) {
            this.renderer.cleanup(this.app);
        }
        this.app = undefined;
    };

    clearMapImageUrls(): void {
        for (const url of this.mapImageUrls.values()) {
            URL.revokeObjectURL(url);
        }
        this.mapImageUrls.clear();
        this.loadingMapImageIds.clear();
    }
}
