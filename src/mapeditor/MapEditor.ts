import { vec3 } from "gl-matrix";
import { URLSearchParamsInit } from "react-router-dom";

import { CacheList, LoadedCache } from "../mapviewer/Caches";
import { Camera, ProjectionType } from "../mapviewer/Camera";
import { InputManager } from "../mapviewer/InputManager";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { CacheLoaderFactory, getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";
import { BasTypeLoader } from "../rs/config/bastype/BasTypeLoader";
import { FloorTypeLoader, OverlayFloorTypeLoader } from "../rs/config/floortype/FloorTypeLoader";
import { LocModelLoader } from "../rs/config/loctype/LocModelLoader";
import { LocTypeLoader } from "../rs/config/loctype/LocTypeLoader";
import { NpcTypeLoader } from "../rs/config/npctype/NpcTypeLoader";
import { ObjTypeLoader } from "../rs/config/objtype/ObjTypeLoader";
import { SeqTypeLoader } from "../rs/config/seqtype/SeqTypeLoader";
import { VarManager } from "../rs/config/vartype/VarManager";
import { MapFileIndex } from "../rs/map/MapFileIndex";
import { ModelLoader } from "../rs/model/ModelLoader";
import { SeqFrameLoader } from "../rs/model/seq/SeqFrameLoader";
import { SceneBuilder } from "../rs/scene/SceneBuilder";
import { TextureLoader } from "../rs/texture/TextureLoader";
import { RenderDataWorkerPool } from "../worker/RenderDataWorkerPool";
import { MapEditorRenderer } from "./MapEditorRenderer";
import { WebGLMapEditorRenderer } from "./webgl/WebGLMapEditorRenderer";

const DEFAULT_RENDER_DISTANCE = 128;

export class MapEditor {
    inputManager: InputManager = new InputManager();
    camera: Camera = new Camera(3242, -26, 3202, -245, 1862);

    renderer: MapEditorRenderer;

    // Cache
    loadedCache!: LoadedCache;
    cacheSystem!: CacheSystem;
    loaderFactory!: CacheLoaderFactory;

    textureLoader!: TextureLoader;
    seqTypeLoader!: SeqTypeLoader;
    seqFrameLoader!: SeqFrameLoader;

    locTypeLoader!: LocTypeLoader;
    objTypeLoader!: ObjTypeLoader;
    npcTypeLoader!: NpcTypeLoader;

    basTypeLoader!: BasTypeLoader;

    varManager!: VarManager;

    mapFileIndex!: MapFileIndex;

    underlayTypeLoader!: FloorTypeLoader;
    overlayTypeLoader!: OverlayFloorTypeLoader;

    modelLoader!: ModelLoader;
    locModelLoader!: LocModelLoader;

    sceneBuilder!: SceneBuilder;

    // Settings

    // Tile distance
    renderDistance: number = DEFAULT_RENDER_DISTANCE;
    // Map square distance
    unloadDistance: number = 2;
    // Map square distance
    lodDistance: number = 3;

    // State
    needsSearchParamUpdate: boolean = false;
    lastTimeSearchParamsUpdated: number = 0;

    debugText?: string;

    constructor(
        readonly workerPool: RenderDataWorkerPool,
        readonly cacheList: CacheList,
        cache: LoadedCache,
    ) {
        this.renderer = new WebGLMapEditorRenderer(this);
        this.initCache(cache);
    }

    initCache(cache: LoadedCache): void {
        this.loadedCache = cache;
        this.cacheSystem = CacheSystem.fromFiles(cache.type, cache.files);
        this.loaderFactory = getCacheLoaderFactory(cache.info, this.cacheSystem);
        this.workerPool.initCache(cache, [], []);

        this.textureLoader = this.loaderFactory.getTextureLoader();
        this.seqTypeLoader = this.loaderFactory.getSeqTypeLoader();
        this.seqFrameLoader = this.loaderFactory.getSeqFrameLoader();
        this.locTypeLoader = this.loaderFactory.getLocTypeLoader();
        this.objTypeLoader = this.loaderFactory.getObjTypeLoader();
        this.npcTypeLoader = this.loaderFactory.getNpcTypeLoader();
        this.basTypeLoader = this.loaderFactory.getBasTypeLoader();

        this.varManager = new VarManager(this.loaderFactory.getVarBitTypeLoader());
        const questTypeLoader = this.loaderFactory.getQuestTypeLoader();
        if (questTypeLoader) {
            this.varManager.setQuestsCompleted(questTypeLoader);
        }

        const mapFileLoader = this.loaderFactory.getMapFileLoader();
        this.mapFileIndex = mapFileLoader.mapFileIndex;

        this.underlayTypeLoader = this.loaderFactory.getUnderlayTypeLoader();
        this.overlayTypeLoader = this.loaderFactory.getOverlayTypeLoader();

        this.modelLoader = this.loaderFactory.getModelLoader();

        this.locModelLoader = new LocModelLoader(
            this.locTypeLoader,
            this.modelLoader,
            this.textureLoader,
            this.seqTypeLoader,
            this.seqFrameLoader,
            this.loaderFactory.getSkeletalSeqLoader(),
        );

        this.sceneBuilder = new SceneBuilder(
            cache.info,
            mapFileLoader,
            this.underlayTypeLoader,
            this.overlayTypeLoader,
            this.locTypeLoader,
            this.locModelLoader,
            cache.xteas,
        );
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

    updateSearchParams(): void {
        this.needsSearchParamUpdate = true;
        this.lastTimeSearchParamsUpdated = performance.now();
    }
}
