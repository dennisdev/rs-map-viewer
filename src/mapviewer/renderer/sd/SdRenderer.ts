import { Renderer } from "../Renderer";
import PicoGL, {
    DrawCall,
    App as PicoApp,
    Program,
    Texture,
    UniformBuffer,
    VertexBuffer,
    VertexArray,
    Renderbuffer,
    Framebuffer,
} from "picogl";
import { SdMapDataLoader } from "./data/SdMapDataLoader";
import { MapViewer } from "../../MapViewer";
import { SdMapLoaderInput } from "./data/SdMapLoaderInput";
import { SdMapData } from "./data/SdMapData";
import { createMainProgram, createNpcProgram } from "./shaders/SdShaders";
import { clamp } from "../../../util/MathUtil";
import { vec2 } from "gl-matrix";
import { SdMapSquare } from "./SdMapSquare";
import { MapManager } from "../MapManager";
import Denque from "denque";
import { CacheSystem } from "../../../rs/cache/CacheSystem";
import { CacheLoaderFactory } from "../../../rs/cache/loader/CacheLoaderFactory";
import { TextureLoader } from "../../../rs/texture/TextureLoader";
import { SeqTypeLoader } from "../../../rs/config/seqtype/SeqTypeLoader";
import { SeqFrameLoader } from "../../../rs/model/seq/SeqFrameLoader";
import { FRAME_FXAA_PROGRAM, FRAME_PROGRAM } from "../shared/shaders/Shaders";
import { Interactions } from "./Interactions";
import { LocTypeLoader } from "../../../rs/config/loctype/LocTypeLoader";
import { InteractType } from "./InteractType";
import { MenuTargetType } from "../../../rs/MenuEntry";
import { OsrsMenuEntry } from "../../../components/rs/menu/OsrsMenu";
import { ObjTypeLoader } from "../../../rs/config/objtype/ObjTypeLoader";
import { Pathfinder } from "../../../rs/pathfinder/Pathfinder";
import { NpcTypeLoader } from "../../../rs/config/npctype/NpcTypeLoader";
import { VarManager } from "../../../rs/config/vartype/VarManager";
import { DrawRange, NULL_DRAW_RANGE } from "../DrawRange";
import { BasTypeLoader } from "../../../rs/config/bastype/BasTypeLoader";
import { isTouchDevice } from "../../../util/DeviceUtil";
import { ProceduralTextureLoader } from "../../../rs/texture/ProceduralTextureLoader";
import { createTextureArray } from "../../../picogl/PicoTexture";

const MAX_TEXTURES = 2048;
const TEXTURE_SIZE = 128;

const INTERACT_BUFFER_COUNT = 2;

const INTERACTION_RADIUS = 5;

export class SdRenderer extends Renderer<SdMapSquare> {
    dataLoader = new SdMapDataLoader();

    cameraMoveTowardsPitch: boolean = false;

    shadersPromise?: Promise<Program[]>;
    mainProgram?: Program;
    mainAlphaProgram?: Program;
    npcProgram?: Program;
    frameProgram?: Program;
    frameFxaaProgram?: Program;

    smaaEdgesProgram?: Program;
    smaaWeightsProgram?: Program;
    smaaBlendProgram?: Program;

    lastFrameTime: DOMHighResTimeStamp = 0;

    mapManager: MapManager<SdMapSquare>;
    mapsToLoad: Denque<SdMapData> = new Denque();

    textureLoader?: TextureLoader;
    seqTypeLoader!: SeqTypeLoader;
    seqFrameLoader!: SeqFrameLoader;

    locTypeLoader!: LocTypeLoader;
    objTypeLoader!: ObjTypeLoader;
    npcTypeLoader!: NpcTypeLoader;

    basTypeLoader!: BasTypeLoader;

    varManager!: VarManager;

    textureArray?: Texture;
    textureMaterials?: Texture;

    sceneUniformBuffer?: UniformBuffer;

    cameraPosUni: vec2 = vec2.fromValues(0, 0);
    resolutionUni: vec2 = vec2.fromValues(0, 0);

    quadPositions?: VertexBuffer;
    quadArray?: VertexArray;

    frameDrawCall?: DrawCall;
    frameFxaaDrawCall?: DrawCall;

    colorTarget?: Renderbuffer;
    interactTarget?: Renderbuffer;
    depthTarget?: Renderbuffer;
    framebuffer?: Framebuffer;

    textureColorTarget?: Texture;
    textureFramebuffer?: Framebuffer;

    interactColorTarget?: Texture;
    interactFramebuffer?: Framebuffer;

    interactions: Interactions[];
    hoveredMapIds: Set<number> = new Set();
    closestInteractIndices: Map<number, number[]> = new Map();
    interactBuffer?: Float32Array;

    pathfinder: Pathfinder = new Pathfinder();

    lastClientTick: number = 0;
    lastTick: number = 0;

    npcRenderCount: number = 0;
    npcRenderData: Uint16Array = new Uint16Array(16 * 4);

    npcDataTextureBuffer: (Texture | undefined)[] = new Array(5);

    constructor(readonly mapViewer: MapViewer) {
        super();
        this.mapManager = new MapManager(
            this.mapViewer.workerPool.size * 2,
            this.queueMapLoad.bind(this),
        );
        this.interactions = new Array(INTERACT_BUFFER_COUNT);
        for (let i = 0; i < INTERACT_BUFFER_COUNT; i++) {
            this.interactions[i] = new Interactions(INTERACTION_RADIUS);
        }
    }

    override init(app: PicoApp): void {
        this.mapViewer.workerPool.initLoader(this.dataLoader);
        console.log("SdRenderer init");

        app.gl.getExtension("EXT_float_blend");

        app.enable(PicoGL.CULL_FACE);
        app.enable(PicoGL.DEPTH_TEST);
        app.depthFunc(PicoGL.LEQUAL);
        app.enable(PicoGL.BLEND);
        app.blendFunc(PicoGL.SRC_ALPHA, PicoGL.ONE_MINUS_SRC_ALPHA);
        app.clearColor(0.0, 0.0, 0.0, 1.0);

        this.shadersPromise = this.initShaders(app);

        this.sceneUniformBuffer = app.createUniformBuffer([
            PicoGL.FLOAT_MAT4,
            PicoGL.FLOAT_MAT4,
            PicoGL.FLOAT_MAT4,
            PicoGL.FLOAT_VEC4,
            PicoGL.FLOAT_VEC2,
            PicoGL.FLOAT,
            PicoGL.FLOAT,
            PicoGL.FLOAT,
            PicoGL.FLOAT,
            PicoGL.FLOAT,
        ]);

        if (this.textureLoader) {
            this.initTextures(app, this.textureLoader);
        }

        this.quadPositions = app.createVertexBuffer(
            PicoGL.FLOAT,
            2,
            new Float32Array([-1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1]),
        );

        this.quadArray = app.createVertexArray().vertexAttributeBuffer(0, this.quadPositions);

        this.initFramebuffer(app);

        this.textureColorTarget = app.createTexture2D(app.width, app.height, {
            minFilter: PicoGL.LINEAR,
            magFilter: PicoGL.LINEAR,
        });
        this.textureFramebuffer = app.createFramebuffer().colorTarget(0, this.textureColorTarget);

        // Interact
        this.interactColorTarget = app.createTexture2D(app.width, app.height, {
            internalFormat: PicoGL.RGBA32F,
            type: PicoGL.FLOAT,
            minFilter: PicoGL.NEAREST,
            magFilter: PicoGL.NEAREST,
        });
        this.interactFramebuffer = app.createFramebuffer().colorTarget(0, this.interactColorTarget);
    }

    initFramebuffer(app: PicoApp): void {
        this.framebuffer?.delete();
        this.colorTarget?.delete();
        this.interactTarget?.delete();
        this.depthTarget?.delete();

        let samples = 0;
        if (this.mapViewer.msaaEnabled) {
            samples = app.gl.getParameter(PicoGL.MAX_SAMPLES);
        }

        this.colorTarget = app.createRenderbuffer(app.width, app.height, PicoGL.RGBA8, samples);
        this.interactTarget = app.createRenderbuffer(
            app.width,
            app.height,
            PicoGL.RGBA32F,
            samples,
        );
        this.depthTarget = app.createRenderbuffer(
            app.width,
            app.height,
            PicoGL.DEPTH_COMPONENT24,
            samples,
        );
        this.framebuffer = app
            .createFramebuffer()
            .colorTarget(0, this.colorTarget)
            .colorTarget(1, this.interactTarget)
            .depthTarget(this.depthTarget);

        this.mapViewer.needsFramebufferUpdate = false;
    }

    async initShaders(app: PicoApp): Promise<Program[]> {
        const hasMultiDraw = this.mapViewer.hasMultiDraw;

        const programs = await app.createPrograms(
            createMainProgram(hasMultiDraw, false),
            createMainProgram(hasMultiDraw, true),
            createNpcProgram(hasMultiDraw, true),
            FRAME_PROGRAM,
            FRAME_FXAA_PROGRAM,
        );

        const [mainProgram, mainAlphaProgram, npcProgram, frameProgram, frameFxaaProgram] =
            programs;
        this.mainProgram = mainProgram;
        this.mainAlphaProgram = mainAlphaProgram;
        this.npcProgram = npcProgram;
        this.frameProgram = frameProgram;
        this.frameFxaaProgram = frameFxaaProgram;

        this.frameDrawCall = app.createDrawCall(frameProgram, this.quadArray);
        this.frameFxaaDrawCall = app.createDrawCall(frameFxaaProgram, this.quadArray);

        return programs;
    }

    initTextures(app: PicoApp, textureLoader: TextureLoader): void {
        let textureIds = textureLoader.getTextureIds().filter((id) => textureLoader.isSd(id));
        textureIds = textureIds.slice(0, MAX_TEXTURES - 1);

        this.initTextureArray(app, textureLoader, textureIds);
        this.initMaterialsTexture(app, textureLoader, textureIds);

        console.log("init textures", textureIds, textureLoader.getTextureIds().length);
    }

    initTextureArray(app: PicoApp, textureLoader: TextureLoader, textureIds: number[]): void {
        if (this.textureArray) {
            this.textureArray.delete();
            this.textureArray = undefined;
        }

        const pixelCount = TEXTURE_SIZE * TEXTURE_SIZE;

        const textureCount = textureIds.length;
        const pixels = new Int32Array((textureCount + 1) * pixelCount);

        // White texture
        pixels.fill(0xffffffff, 0, pixelCount);

        for (let i = 0; i < textureCount; i++) {
            const textureId = textureIds[i];
            try {
                const texturePixels = textureLoader.getPixelsArgb(
                    textureId,
                    TEXTURE_SIZE,
                    true,
                    1.0,
                );
                pixels.set(texturePixels, (i + 1) * pixelCount);
            } catch (e) {
                console.error("Failed loading texture", textureId, e);
            }
        }

        this.textureArray = createTextureArray(
            app,
            new Uint8Array(pixels.buffer),
            TEXTURE_SIZE,
            TEXTURE_SIZE,
            textureCount + 1,
            {
                // wrapS: PicoGL.CLAMP_TO_EDGE,
                maxAnisotropy: PicoGL.WEBGL_INFO.MAX_TEXTURE_ANISOTROPY,
            },
        );
    }

    async debugTexture(textureLoader: TextureLoader, textureId: number): Promise<void> {
        if (!(textureLoader instanceof ProceduralTextureLoader)) {
            return;
        }
        try {
            const size = textureLoader.isSmall(textureId) ? 64 : 128;

            const proceduralTexture = textureLoader.getTexture(textureId)?.proceduralTexture;
            if (proceduralTexture) {
                // proceduralTexture.colourOperation = proceduralTexture.operations[3];
            }

            const texturePixels = textureLoader.getPixelsArgb(textureId, size, true, 0.7);

            const canvas = new OffscreenCanvas(size, size);
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                throw new Error("Could not get canvas context");
            }

            const imageData = new ImageData(size, size);
            const data = imageData.data;

            for (let i = 0; i < texturePixels.length; i++) {
                const index = i * 4;
                data[index] = (texturePixels[i] >> 16) & 0xff;
                data[index + 1] = (texturePixels[i] >> 8) & 0xff;
                data[index + 2] = texturePixels[i] & 0xff;
                data[index + 3] = (texturePixels[i] >> 24) & 0xff;
            }

            imageData.data.set(data);

            ctx.putImageData(imageData, 0, 0);

            const blob = await canvas.convertToBlob();
            const url = URL.createObjectURL(blob);
            console.log("debug texture", textureId, url);
            window.open(url, "_blank");
        } catch (e) {
            console.error("Failed loading texture", textureId, e);
        }
    }

    initMaterialsTexture(app: PicoApp, textureLoader: TextureLoader, textureIds: number[]): void {
        if (this.textureMaterials) {
            this.textureMaterials.delete();
            this.textureMaterials = undefined;
        }

        const textureCount = textureIds.length + 1;

        const data = new Int8Array(textureCount * 4);
        for (let i = 0; i < textureIds.length; i++) {
            const id = textureIds[i];
            try {
                const material = textureLoader.getMaterial(id);

                const index = (i + 1) * 4;
                data[index] = material.animU;
                data[index + 1] = material.animV;
                data[index + 2] = material.alphaCutOff * 255;
            } catch (e) {
                console.error("Failed loading texture", id, e);
            }
        }

        this.textureMaterials = app.createTexture2D(data, textureCount, 1, {
            minFilter: PicoGL.NEAREST,
            magFilter: PicoGL.NEAREST,
            internalFormat: PicoGL.RGBA8I,
        });
    }

    override initCache(
        app: PicoApp | undefined,
        cacheSystem: CacheSystem,
        loaderFactory: CacheLoaderFactory,
    ): void {
        this.textureLoader = loaderFactory.getTextureLoader();
        this.seqTypeLoader = loaderFactory.getSeqTypeLoader();
        this.seqFrameLoader = loaderFactory.getSeqFrameLoader();
        this.locTypeLoader = loaderFactory.getLocTypeLoader();
        this.objTypeLoader = loaderFactory.getObjTypeLoader();
        this.npcTypeLoader = loaderFactory.getNpcTypeLoader();
        this.basTypeLoader = loaderFactory.getBasTypeLoader();

        this.varManager = new VarManager(loaderFactory.getVarBitTypeLoader());
        const questTypeLoader = loaderFactory.getQuestTypeLoader();
        if (questTypeLoader) {
            this.varManager.setQuestsCompleted(questTypeLoader);
        }

        const mapFileIndex = loaderFactory.getMapFileIndex();
        this.mapManager.init(mapFileIndex);
        this.mapsToLoad.clear();

        console.log(
            "init cache",
            app,
            "loc count:",
            this.locTypeLoader.getCount(),
            "obj count:",
            this.objTypeLoader.getCount(),
            "npc count:",
            this.npcTypeLoader.getCount(),
            "seq count:",
            this.seqTypeLoader.getCount(),
        );

        if (app) {
            this.initTextures(app, this.textureLoader);
        }
    }

    draw(drawCall: DrawCall, drawRanges: number[][]) {
        if (this.mapViewer.hasMultiDraw) {
            drawCall.draw();
        } else {
            for (let i = 0; i < drawRanges.length; i++) {
                drawCall.uniform("u_drawId", i);
                drawCall.drawRanges(drawRanges[i]);
                drawCall.draw();
            }
        }
    }

    override render(
        app: PicoApp,
        time: DOMHighResTimeStamp,
        deltaTimeSec: number,
        resized: boolean,
    ): void {
        if (!(app.gl instanceof WebGL2RenderingContext)) {
            return;
        }

        const gl = app.gl;

        const timeSec = time * 0.001;

        const frameCount = this.mapViewer.stats.frameCount;

        const tick = Math.floor(timeSec / 0.6);
        const ticksElapsed = Math.min(tick - this.lastTick, 1);
        if (ticksElapsed > 0) {
            this.lastTick = tick;
        }

        const clientTick = Math.floor(timeSec / 0.02);
        const clientTicksElapsed = Math.min(clientTick - this.lastClientTick, 50);
        if (clientTicksElapsed > 0) {
            this.lastClientTick = clientTick;
        }

        if (this.mapViewer.needsFramebufferUpdate) {
            this.initFramebuffer(app);
        }

        if (
            !this.mainProgram ||
            !this.mainAlphaProgram ||
            !this.npcProgram ||
            !this.sceneUniformBuffer ||
            !this.framebuffer ||
            !this.textureFramebuffer ||
            !this.frameDrawCall ||
            !this.interactFramebuffer
        ) {
            return;
        }

        if (resized) {
            this.framebuffer.resize();
            this.textureFramebuffer.resize();
            this.interactFramebuffer.resize();

            this.resolutionUni[0] = app.width;
            this.resolutionUni[1] = app.height;
        }

        if (frameCount % 1000 === 0) {
            console.log("fps", this.mapViewer.stats.frameTimeFps);
        }

        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

        this.handleInput(deltaTimeSec);

        camera.update(app.width, app.height);

        const renderDistance = this.mapViewer.renderDistance;

        this.mapManager.update(camera, frameCount, renderDistance, this.mapViewer.unloadDistance);

        this.cameraPosUni[0] = camera.getPosX();
        this.cameraPosUni[1] = camera.getPosZ();

        this.sceneUniformBuffer
            .set(0, camera.viewProjMatrix as Float32Array)
            .set(1, camera.viewMatrix as Float32Array)
            .set(2, camera.projectionMatrix as Float32Array)
            .set(3, this.mapViewer.skyColor as Float32Array)
            .set(4, this.cameraPosUni as Float32Array)
            .set(5, renderDistance as any)
            .set(6, this.mapViewer.fogDepth as any)
            .set(7, timeSec as any)
            .set(8, this.mapViewer.brightness as any)
            .set(9, this.mapViewer.colorBanding as any)
            .update();

        const currInteractions = this.interactions[frameCount % this.interactions.length];

        // For now disabled if MSAA is enabled.
        if (!inputManager.isPointerLock()) {
            this.checkInteractions(gl, currInteractions);
        } else if (this.hoveredMapIds.size > 0) {
            this.hoveredMapIds.clear();
        }

        app.enable(PicoGL.DEPTH_TEST);
        app.depthMask(true);

        app.drawFramebuffer(this.framebuffer);

        app.clearColor(0.0, 0.0, 0.0, 1.0);
        app.clear();
        app.gl.clearBufferfv(PicoGL.COLOR, 0, this.mapViewer.skyColor);

        this.tickPass(timeSec, ticksElapsed, clientTicksElapsed);

        const npcDataTextureIndex = this.updateNpcDataTexture(app);
        const npcDataTexture = this.npcDataTextureBuffer[npcDataTextureIndex];

        app.disable(PicoGL.BLEND);
        this.renderOpaquePass(app, timeSec);
        this.renderOpaqueNpcPass(app, timeSec, npcDataTextureIndex, npcDataTexture);

        app.enable(PicoGL.BLEND);
        // app.depthMask(false);
        this.renderTransparentPass(app, timeSec);
        this.renderTransparentNpcPass(app, timeSec, npcDataTextureIndex, npcDataTexture);

        // Can't sample from renderbuffer so blit to a texture for sampling.
        app.readFramebuffer(this.framebuffer);

        app.drawFramebuffer(this.textureFramebuffer);
        gl.readBuffer(PicoGL.COLOR_ATTACHMENT0);
        app.blitFramebuffer(PicoGL.COLOR_BUFFER_BIT);

        // Disabled interactions if MSAA is enabled for now
        if (!inputManager.isPointerLock()) {
            const mouseX = inputManager.mouseX;
            const mouseY = inputManager.mouseY;
            if (mouseX !== -1 && mouseY !== -1) {
                if (this.mapViewer.msaaEnabled) {
                    // TODO: reading from the multisampled framebuffer is not accurate
                    app.drawFramebuffer(this.interactFramebuffer);
                    gl.readBuffer(PicoGL.COLOR_ATTACHMENT1);
                    app.blitFramebuffer(PicoGL.COLOR_BUFFER_BIT);

                    app.readFramebuffer(this.interactFramebuffer);
                    gl.readBuffer(PicoGL.COLOR_ATTACHMENT0);
                } else {
                    gl.readBuffer(PicoGL.COLOR_ATTACHMENT1);
                }

                currInteractions.read(gl, mouseX, mouseY);
            }
        }

        app.disable(PicoGL.DEPTH_TEST);
        app.depthMask(false);

        app.disable(PicoGL.BLEND);

        app.clearMask(PicoGL.COLOR_BUFFER_BIT | PicoGL.DEPTH_BUFFER_BIT);
        app.clearColor(0.0, 0.0, 0.0, 1.0);
        app.defaultDrawFramebuffer().clear();

        if (this.frameFxaaDrawCall && this.mapViewer.fxaaEnabled) {
            this.frameFxaaDrawCall.uniform("u_resolution", this.resolutionUni);
            this.frameFxaaDrawCall.texture("u_frame", this.textureFramebuffer.colorAttachments[0]);
            this.frameFxaaDrawCall.draw();
        } else {
            this.frameDrawCall.texture("u_frame", this.textureFramebuffer.colorAttachments[0]);
            this.frameDrawCall.draw();
        }

        if (this.textureArray && this.textureMaterials) {
            const mapData = this.mapsToLoad.shift();
            if (mapData && this.isValidMapData(mapData)) {
                this.loadMap(
                    app,
                    this.mainProgram,
                    this.mainAlphaProgram,
                    this.npcProgram,
                    this.textureArray,
                    this.textureMaterials,
                    this.sceneUniformBuffer,
                    mapData,
                    timeSec,
                );
            }
        }
    }

    tickPass(time: number, ticksElapsed: number, clientTicksElapsed: number): void {
        const cycle = time / 0.02;

        this.npcRenderCount = 0;
        for (let i = 0; i < this.mapManager.visibleMapCount; i++) {
            const map = this.mapManager.visibleMaps[i];

            for (const loc of map.locsAnimated) {
                loc.update(this.seqFrameLoader, cycle);
            }

            for (let t = 0; t < ticksElapsed; t++) {
                for (const npc of map.npcs) {
                    npc.updateServerMovement(this.pathfinder, map.borderSize, map.collisionMaps);
                }
            }

            for (let t = 0; t < clientTicksElapsed; t++) {
                for (const npc of map.npcs) {
                    npc.updateMovement(this.seqTypeLoader, this.seqFrameLoader);
                }
            }

            this.addNpcRenderData(map);
        }
    }

    addNpcRenderData(map: SdMapSquare) {
        const npcs = map.npcs;

        if (npcs.length === 0) {
            return;
        }

        const frameCount = this.mapViewer.stats.frameCount;

        map.npcDataTextureOffsets[frameCount % map.npcDataTextureOffsets.length] =
            this.npcRenderCount;

        const newCount = this.npcRenderCount + npcs.length;

        if (this.npcRenderData.length / 4 < newCount) {
            const newData = new Uint16Array(Math.ceil((newCount * 2) / 16) * 16 * 4);
            newData.set(this.npcRenderData);
            this.npcRenderData = newData;
        }

        for (const npc of npcs) {
            let offset = this.npcRenderCount * 4;

            const tileX = npc.x >> 7;
            const tileY = npc.y >> 7;

            let renderPlane = npc.level;
            if (renderPlane < 3 && (map.getTileRenderFlag(1, tileX, tileY) & 0x2) === 2) {
                renderPlane++;
            }

            this.npcRenderData[offset++] = npc.x;
            this.npcRenderData[offset++] = npc.y;
            this.npcRenderData[offset++] = (npc.rotation << 2) | renderPlane;
            this.npcRenderData[offset++] = npc.npcType.id;

            this.npcRenderCount++;
        }
    }

    updateNpcDataTexture(app: PicoApp) {
        const frameCount = this.mapViewer.stats.frameCount;

        const newNpcDataTextureIndex = frameCount % this.npcDataTextureBuffer.length;
        const npcDataTextureIndex = (frameCount + 1) % this.npcDataTextureBuffer.length;
        this.npcDataTextureBuffer[newNpcDataTextureIndex]?.delete();
        this.npcDataTextureBuffer[newNpcDataTextureIndex] = app.createTexture2D(
            this.npcRenderData,
            16,
            Math.max(Math.ceil(this.npcRenderCount / 16), 1),
            {
                internalFormat: PicoGL.RGBA16UI,
                minFilter: PicoGL.NEAREST,
                magFilter: PicoGL.NEAREST,
            },
        );

        return npcDataTextureIndex;
    }

    renderOpaquePass(app: PicoApp, time: number): void {
        const camera = this.mapViewer.camera;
        const cameraMapX = camera.getMapX();
        const cameraMapY = camera.getMapY();

        for (let i = 0; i < this.mapManager.visibleMapCount; i++) {
            const map = this.mapManager.visibleMaps[i];
            const dist = map.getMapDistance(cameraMapX, cameraMapY);

            const isInteract = this.hoveredMapIds.has(map.id);
            const isLod = dist >= this.mapViewer.lodDistance;
            // const isLod = false;

            const { drawCall, drawRanges } = map.getDrawCall(false, isInteract, isLod);

            for (const loc of map.locsAnimated) {
                const frameId = loc.frame;
                const frame = loc.anim.frames[frameId | 0];

                const index = loc.getDrawRangeIndex(false, isInteract, isLod);
                if (index !== -1) {
                    drawCall.offsets[index] = frame[0];
                    (drawCall as any).numElements[index] = frame[1];

                    drawRanges[index] = frame;
                }
            }

            this.draw(drawCall, drawRanges);
        }
    }

    renderOpaqueNpcPass(
        app: PicoApp,
        time: number,
        npcDataTextureIndex: number,
        npcDataTexture: Texture | undefined,
    ): void {
        if (!npcDataTexture || !this.mapViewer.loadNpcs) {
            return;
        }

        for (let i = 0; i < this.mapManager.visibleMapCount; i++) {
            const map = this.mapManager.visibleMaps[i];
            const npcs = map.npcs;

            if (npcs.length === 0) {
                continue;
            }

            const dataOffset = map.npcDataTextureOffsets[npcDataTextureIndex];
            if (dataOffset === -1) {
                continue;
            }

            const { drawCall, drawRanges } = map.drawCallNpc;

            drawCall.uniform("u_npcDataOffset", dataOffset);
            drawCall.texture("u_npcDataTexture", npcDataTexture);

            for (let i = 0; i < npcs.length; i++) {
                const npc = npcs[i];
                const anim = npc.getAnimationFrames();

                const frameId = npc.movementFrame;
                const frame = anim.frames[frameId];

                (drawCall as any).offsets[i] = frame[0];
                (drawCall as any).numElements[i] = frame[1];

                drawRanges[i] = frame;
            }

            this.draw(drawCall, drawRanges);
        }
    }

    renderTransparentPass(app: PicoApp, time: number): void {
        const camera = this.mapViewer.camera;
        const cameraMapX = camera.getMapX();
        const cameraMapY = camera.getMapY();

        for (let i = this.mapManager.visibleMapCount - 1; i >= 0; i--) {
            const map = this.mapManager.visibleMaps[i];
            const dist = map.getMapDistance(cameraMapX, cameraMapY);

            const isInteract = this.hoveredMapIds.has(map.id);
            const isLod = dist >= this.mapViewer.lodDistance;

            const { drawCall, drawRanges } = map.getDrawCall(true, isInteract, isLod);

            for (const loc of map.locsAnimated) {
                if (loc.anim.framesAlpha) {
                    const frameId = loc.frame;
                    const frame = loc.anim.framesAlpha[frameId | 0];

                    const index = loc.getDrawRangeIndex(true, isInteract, isLod);
                    if (index !== -1) {
                        drawCall.offsets[index] = frame[0];
                        (drawCall as any).numElements[index] = frame[1];

                        drawRanges[index] = frame;
                    }
                }
            }

            this.draw(drawCall, drawRanges);
        }
    }

    renderTransparentNpcPass(
        app: PicoApp,
        time: number,
        npcDataTextureIndex: number,
        npcDataTexture: Texture | undefined,
    ): void {
        if (!npcDataTexture || !this.mapViewer.loadNpcs) {
            return;
        }

        for (let i = this.mapManager.visibleMapCount - 1; i >= 0; i--) {
            const map = this.mapManager.visibleMaps[i];
            const npcs = map.npcs;

            if (npcs.length === 0) {
                continue;
            }

            const dataOffset = map.npcDataTextureOffsets[npcDataTextureIndex];
            if (dataOffset === -1) {
                continue;
            }

            const { drawCall, drawRanges } = map.drawCallNpc;

            drawCall.uniform("u_npcDataOffset", dataOffset);
            drawCall.texture("u_npcDataTexture", npcDataTexture);

            for (let i = 0; i < npcs.length; i++) {
                const npc = npcs[i];
                const anim = npc.getAnimationFrames();

                const frameId = npc.movementFrame;
                let frame: DrawRange = NULL_DRAW_RANGE;
                if (anim.framesAlpha) {
                    frame = anim.framesAlpha[frameId];
                }

                (drawCall as any).offsets[i] = frame[0];
                (drawCall as any).numElements[i] = frame[1];

                drawRanges[i] = frame;
            }

            this.draw(drawCall, drawRanges);
        }
    }

    checkInteractions(gl: WebGL2RenderingContext, interactions: Interactions): void {
        const interactReady = interactions.check(
            gl,
            this.hoveredMapIds,
            this.closestInteractIndices,
        );
        if (interactReady) {
            this.interactBuffer = interactions.interactBuffer;
        }

        if (!this.interactBuffer) {
            return;
        }

        const frameCount = this.mapViewer.stats.frameCount;

        const inputManager = this.mapViewer.inputManager;
        const isMouseDown = inputManager.dragX !== -1 || inputManager.dragY !== -1;
        const picked = inputManager.pickX !== -1 && inputManager.pickY !== -1;

        if (!interactReady && !picked) {
            return;
        }

        const menuCooldown = isTouchDevice ? 50 : 10;

        if (
            inputManager.mouseX === -1 ||
            inputManager.mouseY === -1 ||
            frameCount - this.mapViewer.menuOpenedFrame < menuCooldown
        ) {
            return;
        }

        // Don't auto close menu on touch devices
        if (this.mapViewer.menuOpen && !picked && !isMouseDown && isTouchDevice) {
            return;
        }

        const menuEntries: OsrsMenuEntry[] = [];
        const examineEntries: OsrsMenuEntry[] = [];

        const locIds = new Set<number>();
        const objIds = new Set<number>();
        const npcIds = new Set<number>();

        for (let i = 0; i < INTERACTION_RADIUS + 1; i++) {
            const indices = this.closestInteractIndices.get(i);
            if (!indices) {
                continue;
            }
            for (const index of indices) {
                const interactId = this.interactBuffer[index];
                const interactType = this.interactBuffer[index + 2];
                if (interactType === InteractType.LOC) {
                    const locType = this.locTypeLoader.load(interactId);
                    if (locType.name === "null" && !this.mapViewer.debugId) {
                        continue;
                    }
                    if (locIds.has(interactId)) {
                        continue;
                    }
                    locIds.add(interactId);

                    for (const option of locType.actions) {
                        if (!option) {
                            continue;
                        }
                        menuEntries.push({
                            option,
                            targetId: locType.id,
                            targetType: MenuTargetType.LOC,
                            targetName: locType.name,
                            targetLevel: -1,
                            onClick: this.mapViewer.closeMenu,
                        });
                    }

                    examineEntries.push({
                        option: "Examine",
                        targetId: locType.id,
                        targetType: MenuTargetType.LOC,
                        targetName: locType.name,
                        targetLevel: -1,
                        onClick: this.mapViewer.onExamine,
                    });
                } else if (interactType === InteractType.OBJ) {
                    const objType = this.objTypeLoader.load(interactId);
                    if (objType.name === "null" && !this.mapViewer.debugId) {
                        continue;
                    }
                    if (objIds.has(interactId)) {
                        continue;
                    }
                    objIds.add(interactId);

                    for (const option of objType.groundActions) {
                        if (!option) {
                            continue;
                        }
                        menuEntries.push({
                            option,
                            targetId: objType.id,
                            targetType: MenuTargetType.OBJ,
                            targetName: objType.name,
                            targetLevel: -1,
                            onClick: this.mapViewer.closeMenu,
                        });
                    }

                    examineEntries.push({
                        option: "Examine",
                        targetId: objType.id,
                        targetType: MenuTargetType.OBJ,
                        targetName: objType.name,
                        targetLevel: -1,
                        onClick: this.mapViewer.onExamine,
                    });
                } else if (interactType === InteractType.NPC) {
                    let npcType = this.npcTypeLoader.load(interactId);
                    if (npcType.transforms) {
                        const transformed = npcType.transform(this.varManager, this.npcTypeLoader);
                        if (!transformed) {
                            continue;
                        }
                        npcType = transformed;
                    }
                    if (npcType.name === "null" && !this.mapViewer.debugId) {
                        continue;
                    }
                    if (npcIds.has(interactId)) {
                        continue;
                    }
                    npcIds.add(interactId);

                    for (const option of npcType.actions) {
                        if (!option) {
                            continue;
                        }
                        menuEntries.push({
                            option,
                            targetId: npcType.id,
                            targetType: MenuTargetType.NPC,
                            targetName: npcType.name,
                            targetLevel: npcType.combatLevel,
                            onClick: this.mapViewer.closeMenu,
                        });
                    }

                    examineEntries.push({
                        option: "Examine",
                        targetId: npcType.id,
                        targetType: MenuTargetType.NPC,
                        targetName: npcType.name,
                        targetLevel: npcType.combatLevel,
                        onClick: this.mapViewer.onExamine,
                    });
                }
            }
        }

        menuEntries.push({
            option: "Walk here",
            targetId: -1,
            targetType: MenuTargetType.NONE,
            targetName: "",
            targetLevel: -1,
            onClick: this.mapViewer.closeMenu,
        });
        menuEntries.push(...examineEntries);
        menuEntries.push({
            option: "Cancel",
            targetId: -1,
            targetType: MenuTargetType.NONE,
            targetName: "",
            targetLevel: -1,
            onClick: this.mapViewer.closeMenu,
        });

        this.mapViewer.menuOpen = picked;
        if (picked) {
            this.mapViewer.menuOpenedFrame = frameCount;
        }
        this.mapViewer.menuX = inputManager.mouseX;
        this.mapViewer.menuY = inputManager.mouseY;
        this.mapViewer.menuEntries = menuEntries;
    }

    handleInput(deltaTimeSec: number) {
        this.handleKeyInput(deltaTimeSec);
        this.handleMouseInput();
        this.handleJoystickInput(deltaTimeSec);
    }

    handleKeyInput(deltaTimeSec: number) {
        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

        let cameraSpeedMult = 1.0;
        if (inputManager.isShiftDown()) {
            cameraSpeedMult = 10.0;
        }

        const deltaPitch = 64 * 5 * deltaTimeSec;
        const deltaYaw = 64 * 5 * deltaTimeSec;

        // camera direction controls
        if (inputManager.isKeyDown("ArrowUp")) {
            camera.updatePitch(camera.pitch, deltaPitch);
        }
        if (inputManager.isKeyDown("ArrowDown")) {
            camera.updatePitch(camera.pitch, -deltaPitch);
        }
        if (inputManager.isKeyDown("ArrowRight")) {
            camera.updateYaw(camera.yaw, deltaYaw);
        }
        if (inputManager.isKeyDown("ArrowLeft")) {
            camera.updateYaw(camera.yaw, -deltaYaw);
        }

        // camera position controls
        let deltaX = 0;
        let deltaY = 0;
        let deltaZ = 0;

        const deltaPos = 16 * cameraSpeedMult * deltaTimeSec;
        const deltaHeight = 8 * cameraSpeedMult * deltaTimeSec;

        if (inputManager.isKeyDown("KeyW")) {
            // Forward
            deltaZ -= deltaPos;
        }
        if (inputManager.isKeyDown("KeyA")) {
            // Left
            deltaX += deltaPos;
        }
        if (inputManager.isKeyDown("KeyS")) {
            // Back
            deltaZ += deltaPos;
        }
        if (inputManager.isKeyDown("KeyD")) {
            // Right
            deltaX -= deltaPos;
        }
        if (inputManager.isKeyDown("KeyE") || inputManager.isKeyDown("KeyR")) {
            // Move up
            deltaY -= deltaHeight;
        }
        if (
            inputManager.isKeyDown("KeyQ") ||
            inputManager.isKeyDown("KeyC") ||
            inputManager.isKeyDown("KeyF")
        ) {
            // Move down
            deltaY += deltaHeight;
        }

        if (deltaX !== 0 || deltaZ !== 0) {
            camera.move(deltaX, 0, deltaZ, this.cameraMoveTowardsPitch);
        }
        if (deltaY !== 0) {
            camera.move(0, deltaY, 0);
        }

        if (inputManager.isKeyDown("KeyP")) {
            camera.pos[0] = 2780;
            camera.pos[2] = 9537;
        }

        if (inputManager.isKeyDownEvent("F1")) {
            this.mapViewer.hudVisible = !this.mapViewer.hudVisible;
        }

        if (inputManager.isKeyDownEvent("F2") && this.mapViewer.app) {
            const canvas = this.mapViewer.app.canvas;
            if (canvas instanceof HTMLCanvasElement) {
                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "map.png";
                        a.click();
                        URL.revokeObjectURL(url);
                    }
                });
            }
        }
    }

    handleMouseInput() {
        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

        if (inputManager.isPointerLock()) {
            this.mapViewer.closeMenu();
        }

        // mouse/touch controls
        const deltaMouseX = inputManager.getDeltaMouseX();
        const deltaMouseY = inputManager.getDeltaMouseY();

        if (deltaMouseX !== 0 || deltaMouseY !== 0) {
            if (inputManager.isTouch) {
                camera.move(0, clamp(-deltaMouseY, -100, 100) * 0.004, 0);
            } else {
                camera.updatePitch(camera.pitch, deltaMouseY * 0.9);
                camera.updateYaw(camera.yaw, deltaMouseX * -0.9);
            }
        }
    }

    handleJoystickInput(deltaTimeSec: number) {
        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

        const deltaPitch = 64 * 5 * deltaTimeSec;
        const deltaYaw = 64 * 5 * deltaTimeSec;

        // joystick controls
        const positionJoystickEvent = inputManager.positionJoystickEvent;
        const cameraJoystickEvent = inputManager.cameraJoystickEvent;

        if (positionJoystickEvent) {
            const moveX = positionJoystickEvent.x ?? 0;
            const moveY = positionJoystickEvent.y ?? 0;

            camera.move(
                moveX * 32 * -deltaTimeSec,
                0,
                moveY * 32 * -deltaTimeSec,
                this.cameraMoveTowardsPitch,
            );
        }

        if (cameraJoystickEvent) {
            const moveX = cameraJoystickEvent.x ?? 0;
            const moveY = cameraJoystickEvent.y ?? 0;
            camera.updatePitch(camera.pitch, deltaPitch * 1.5 * moveY);
            camera.updateYaw(camera.yaw, deltaYaw * 1.5 * moveX);
        }
    }

    clearMaps(): void {
        this.mapManager.cleanup();
        this.mapsToLoad.clear();
    }

    override cleanup(): void {
        console.log("SdRenderer cleanup");
        this.mapViewer.workerPool.resetLoader(this.dataLoader);
        this.cleanupAsync();
        this.textureArray?.delete();
        this.textureArray = undefined;

        this.textureMaterials?.delete();
        this.textureMaterials = undefined;

        this.sceneUniformBuffer?.delete();
        this.sceneUniformBuffer = undefined;

        this.quadArray?.delete();
        this.quadArray = undefined;

        this.quadPositions?.delete();
        this.quadPositions = undefined;

        this.framebuffer?.delete();
        this.framebuffer = undefined;

        this.colorTarget?.delete();
        this.colorTarget = undefined;

        this.interactTarget?.delete();
        this.interactTarget = undefined;

        this.depthTarget?.delete();
        this.depthTarget = undefined;

        this.textureFramebuffer?.delete();
        this.textureFramebuffer = undefined;

        this.textureColorTarget?.delete();
        this.textureColorTarget = undefined;

        this.interactFramebuffer?.delete();
        this.interactFramebuffer = undefined;

        this.interactColorTarget?.delete();
        this.interactColorTarget = undefined;

        for (const texture of this.npcDataTextureBuffer) {
            texture?.delete();
        }

        this.clearMaps();
    }

    async cleanupAsync(): Promise<void> {
        if (!this.shadersPromise) {
            return;
        }
        const programs = await this.shadersPromise;
        for (const program of programs) {
            program.delete();
        }
        this.shadersPromise = undefined;
    }

    isValidMapData(mapData: SdMapData): boolean {
        return (
            mapData.cacheName === this.mapViewer.loadedCache.info.name &&
            mapData.maxLevel === this.mapViewer.maxLevel &&
            mapData.loadObjs === this.mapViewer.loadObjs &&
            mapData.loadNpcs === this.mapViewer.loadNpcs &&
            mapData.smoothTerrain === this.mapViewer.smoothTerrain
        );
    }

    loadMap(
        app: PicoApp,
        mainProgram: Program,
        mainAlphaProgram: Program,
        npcProgram: Program,
        textureArray: Texture,
        textureMaterials: Texture,
        sceneUniformBuffer: UniformBuffer,
        mapData: SdMapData,
        time: number,
    ): void {
        const { mapX, mapY } = mapData;

        this.mapViewer.setMapImageUrl(mapX, mapY, URL.createObjectURL(mapData.minimapBlob));

        const frameCount = this.mapViewer.stats.frameCount;
        this.mapManager.addMap(
            mapX,
            mapY,
            SdMapSquare.load(
                this.seqTypeLoader,
                this.npcTypeLoader,
                this.basTypeLoader,
                app,
                mainProgram,
                mainAlphaProgram,
                npcProgram,
                textureArray,
                textureMaterials,
                sceneUniformBuffer,
                mapData,
                time,
                frameCount,
            ),
        );
    }

    async queueMapLoad(mapX: number, mapY: number): Promise<void> {
        const mapData = await this.mapViewer.workerPool.queueLoad<
            SdMapLoaderInput,
            SdMapData | undefined,
            SdMapDataLoader
        >(this.dataLoader, {
            mapX,
            mapY,
            maxLevel: this.mapViewer.maxLevel,
            loadObjs: this.mapViewer.loadObjs,
            loadNpcs: this.mapViewer.loadNpcs,
            smoothTerrain: this.mapViewer.smoothTerrain,
            minimizeDrawCalls: !this.mapViewer.hasMultiDraw,
        });

        if (mapData) {
            if (this.isValidMapData(mapData)) {
                this.mapsToLoad.push(mapData);
            }
        } else {
            this.mapManager.addInvalidMap(mapX, mapY);
        }
    }
}
