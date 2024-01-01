import { vec2 } from "gl-matrix";
import PicoGL, {
    DrawCall,
    Framebuffer,
    App as PicoApp,
    Program,
    Renderbuffer,
    Texture,
    UniformBuffer,
} from "picogl";

import { newDrawRange } from "../../mapviewer/webgl/DrawRange";
import { createTextureArray } from "../../picogl/PicoTexture";
import { getMapSquareId } from "../../rs/map/MapFileIndex";
import { clamp } from "../../util/MathUtil";
import { MapEditorRenderer } from "../MapEditorRenderer";
import { EditorMapSquare } from "./EditorMapSquare";
import { HIGHLIGHT_PROGRAM, TERRAIN_PROGRAM, TILE_PICKING_PROGRAM } from "./shaders/Shaders";

const MAX_TEXTURES = 256;
const TEXTURE_SIZE = 128;

export class WebGLMapEditorRenderer extends MapEditorRenderer<EditorMapSquare> {
    app!: PicoApp;
    gl!: WebGL2RenderingContext;

    hasMultiDraw: boolean = false;

    // Shaders
    shadersPromise?: Promise<Program[]>;
    terrainProgram?: Program;
    tilePickingProgram?: Program;
    highlightTileProgram?: Program;

    // Uniforms
    sceneUniformBuffer?: UniformBuffer;

    cameraPosUni: vec2 = vec2.fromValues(0, 0);
    resolutionUni: vec2 = vec2.fromValues(0, 0);

    // Framebuffers
    pickFramebuffer?: Framebuffer;
    pickColorTarget?: Renderbuffer;
    pickDepthTarget?: Renderbuffer;

    // Textures
    textureArray?: Texture;
    textureMaterials?: Texture;

    textureIds: number[] = [];
    loadedTextureIds: Set<number> = new Set();

    // Draw calls
    tilePickingDrawCall!: DrawCall;
    highlightTileDrawCall!: DrawCall;

    // State
    tilePickingBuffer = new Uint8Array(4);

    brushSize: number = 0;

    hoverWorldX: number = -1;
    hoverWorldY: number = -1;

    async init(): Promise<void> {
        await super.init();

        this.app = PicoGL.createApp(this.canvas);
        this.gl = this.app.gl as WebGL2RenderingContext;

        // hack to get the right multi draw extension for picogl
        const state: any = this.app.state;
        const ext = this.gl.getExtension("WEBGL_multi_draw");
        PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED = ext;
        state.extensions.multiDrawInstanced = ext;

        this.hasMultiDraw = !!PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED;

        this.app.enable(PicoGL.CULL_FACE);
        this.app.enable(PicoGL.DEPTH_TEST);
        this.app.depthFunc(PicoGL.LEQUAL);
        this.app.enable(PicoGL.BLEND);
        this.app.blendFunc(PicoGL.SRC_ALPHA, PicoGL.ONE_MINUS_SRC_ALPHA);
        this.app.clearColor(0.0, 0.0, 0.0, 1.0);
        this.app.clear();

        this.shadersPromise = this.initShaders();
        await this.shadersPromise;

        this.sceneUniformBuffer = this.app.createUniformBuffer([
            PicoGL.FLOAT_MAT4, // mat4 u_viewProjMatrix;
            PicoGL.FLOAT_MAT4, // mat4 u_viewMatrix;
            PicoGL.FLOAT_MAT4, // mat4 u_projectionMatrix;
        ]);

        this.initFramebuffers();
        this.initTextures();

        this.tilePickingDrawCall.uniformBlock("SceneUniforms", this.sceneUniformBuffer);
        // 6 vertices/2 triangles per tile
        this.tilePickingDrawCall.drawRanges(newDrawRange(0, 64 * 64 * 6));

        this.highlightTileDrawCall.uniformBlock("SceneUniforms", this.sceneUniformBuffer);
        // 6 vertices/2 triangles per tile
        this.highlightTileDrawCall.drawRanges(newDrawRange(0, 6));
    }

    async initShaders(): Promise<Program[]> {
        const hasMultiDraw = this.hasMultiDraw;

        const programs = await this.app.createPrograms(
            TERRAIN_PROGRAM,
            TILE_PICKING_PROGRAM,
            HIGHLIGHT_PROGRAM,
        );

        const [terrainProgram, tilePickingProgram, highlightTileProgram] = programs;
        this.terrainProgram = terrainProgram;
        this.tilePickingProgram = tilePickingProgram;
        this.highlightTileProgram = highlightTileProgram;

        this.tilePickingDrawCall = this.app.createDrawCall(this.tilePickingProgram);
        this.highlightTileDrawCall = this.app.createDrawCall(this.highlightTileProgram);

        return programs;
    }

    initFramebuffers(): void {
        this.pickFramebuffer?.delete();
        this.pickColorTarget?.delete();
        this.pickDepthTarget?.delete();

        let samples = 0;

        this.pickColorTarget = this.app.createRenderbuffer(
            this.app.width,
            this.app.height,
            PicoGL.RGBA8,
            samples,
        );
        this.pickDepthTarget = this.app.createRenderbuffer(
            this.app.width,
            this.app.height,
            PicoGL.DEPTH_COMPONENT24,
            samples,
        );
        this.pickFramebuffer = this.app
            .createFramebuffer()
            .colorTarget(0, this.pickColorTarget)
            .depthTarget(this.pickDepthTarget);
    }

    initTextures(): void {
        const textureLoader = this.mapEditor.textureLoader;

        const allTextureIds = textureLoader.getTextureIds();

        this.textureIds = allTextureIds
            .filter((id) => textureLoader.isSd(id))
            .slice(0, MAX_TEXTURES - 1);

        this.initTextureArray();
        this.initMaterialsTexture();

        console.log("init textures", this.textureIds, allTextureIds.length);
    }

    initTextureArray() {
        if (this.textureArray) {
            this.textureArray.delete();
            this.textureArray = undefined;
        }
        this.loadedTextureIds.clear();

        console.time("load textures");

        const pixelCount = TEXTURE_SIZE * TEXTURE_SIZE;

        const textureCount = this.textureIds.length;
        const pixels = new Int32Array((textureCount + 1) * pixelCount);

        // White texture
        pixels.fill(0xffffffff, 0, pixelCount);

        const cacheInfo = this.mapEditor.loadedCache.info;

        let maxPreloadTextures = textureCount;
        // we should check if the texture loader is procedural instead
        if (cacheInfo.game === "runescape" && cacheInfo.revision >= 508) {
            maxPreloadTextures = 64;
        }

        for (let i = 0; i < Math.min(textureCount, maxPreloadTextures); i++) {
            const textureId = this.textureIds[i];
            try {
                const texturePixels = this.mapEditor.textureLoader.getPixelsArgb(
                    textureId,
                    TEXTURE_SIZE,
                    true,
                    1.0,
                );
                pixels.set(texturePixels, (i + 1) * pixelCount);
            } catch (e) {
                console.error("Failed loading texture", textureId, e);
            }
            this.loadedTextureIds.add(textureId);
        }

        this.textureArray = createTextureArray(
            this.app,
            new Uint8Array(pixels.buffer),
            TEXTURE_SIZE,
            TEXTURE_SIZE,
            textureCount + 1,
            {
                // wrapS: PicoGL.CLAMP_TO_EDGE,
                maxAnisotropy: PicoGL.WEBGL_INFO.MAX_TEXTURE_ANISOTROPY,
            },
        );

        console.timeEnd("load textures");
    }

    initMaterialsTexture(): void {
        if (this.textureMaterials) {
            this.textureMaterials.delete();
            this.textureMaterials = undefined;
        }

        const textureCount = this.textureIds.length + 1;

        const data = new Int8Array(textureCount * 4);
        for (let i = 0; i < this.textureIds.length; i++) {
            const id = this.textureIds[i];
            try {
                const material = this.mapEditor.textureLoader.getMaterial(id);

                const index = (i + 1) * 4;
                data[index] = material.animU;
                data[index + 1] = material.animV;
                data[index + 2] = material.alphaCutOff * 255;
            } catch (e) {
                console.error("Failed loading texture", id, e);
            }
        }

        this.textureMaterials = this.app.createTexture2D(data, textureCount, 1, {
            minFilter: PicoGL.NEAREST,
            magFilter: PicoGL.NEAREST,
            internalFormat: PicoGL.RGBA8I,
        });
    }

    override async queueLoadMap(mapX: number, mapY: number): Promise<void> {
        const mapData = await this.mapEditor.workerPool.queueLoadEditorMapData(mapX, mapY);
        if (
            !mapData ||
            !this.sceneUniformBuffer ||
            !this.textureArray ||
            !this.textureMaterials ||
            !this.terrainProgram
        ) {
            return;
        }

        this.mapManager.addMap(
            mapX,
            mapY,
            EditorMapSquare.create(
                this.app,
                mapData,
                this.sceneUniformBuffer,
                this.textureArray,
                this.textureMaterials,
                this.terrainProgram,
            ),
        );
    }

    override handleMouseInput(): void {
        super.handleMouseInput();

        const inputManager = this.mapEditor.inputManager;

        if (inputManager.scrollY !== 0) {
            const newBrushSize = this.brushSize - Math.sign(inputManager.scrollY);
            this.brushSize = clamp(newBrushSize, 0, 8);
        }
    }

    override onResize(width: number, height: number): void {
        this.app.resize(width, height);
        this.pickFramebuffer?.resize(width, height);
    }

    render(time: number, deltaTime: number, resized: boolean): void {
        const frameCount = this.stats.frameCount;

        if (!this.sceneUniformBuffer) {
            return;
        }

        const inputManager = this.mapEditor.inputManager;
        const camera = this.mapEditor.camera;

        this.handleInput(deltaTime);

        camera.update(this.canvas.width, this.canvas.height);

        const renderDistance = this.mapEditor.renderDistance;

        this.mapManager.update(camera, frameCount, renderDistance, this.mapEditor.unloadDistance);

        this.cameraPosUni[0] = camera.getPosX();
        this.cameraPosUni[1] = camera.getPosZ();

        this.sceneUniformBuffer
            .set(0, camera.viewProjMatrix as Float32Array)
            .set(1, camera.viewMatrix as Float32Array)
            .set(2, camera.projectionMatrix as Float32Array)
            .update();

        this.app.defaultDrawFramebuffer();
        this.app.defaultReadFramebuffer();

        this.app.clearColor(0.0, 0.0, 0.0, 1.0);
        this.app.clear();

        this.renderTerrain();

        this.renderTilePicking();
    }

    renderTerrain(): void {
        this.app.enable(PicoGL.DEPTH_TEST);
        this.app.enable(PicoGL.BLEND);

        for (let i = 0; i < this.mapManager.visibleMapCount; i++) {
            const map = this.mapManager.visibleMaps[i];

            map.terrainDrawCall.drawRanges(map.terrainDrawRanges[0]);
            map.terrainDrawCall.draw();
        }

        if (this.hoverWorldX !== -1 && this.hoverWorldY !== -1) {
            this.app.disable(PicoGL.DEPTH_TEST);
            const hoveredMapIds = new Set<number>();
            const hoveredTilesMap = new Map<number, number[]>();
            for (let x = -this.brushSize; x <= this.brushSize; x++) {
                for (let y = -this.brushSize; y <= this.brushSize; y++) {
                    const worldX = this.hoverWorldX + x;
                    const worldY = this.hoverWorldY + y;
                    const mapX = Math.floor(worldX / 64);
                    const mapY = Math.floor(worldY / 64);
                    const tileX = worldX % 64;
                    const tileY = worldY % 64;
                    const tileId = (tileX << 8) | tileY;

                    const mapId = getMapSquareId(mapX, mapY);
                    hoveredMapIds.add(mapId);
                    const hoveredTiles = hoveredTilesMap.get(mapId);
                    if (hoveredTiles) {
                        hoveredTiles.push(tileId);
                    } else {
                        hoveredTilesMap.set(mapId, [tileId]);
                    }
                }
            }

            for (let i = 0; i < this.mapManager.visibleMapCount; i++) {
                const map = this.mapManager.visibleMaps[i];
                const mapId = getMapSquareId(map.mapX, map.mapY);
                const hoveredTiles = hoveredTilesMap.get(mapId);
                if (!hoveredTiles) {
                    continue;
                }
                this.highlightTileDrawCall.uniform("u_mapX", map.mapX);
                this.highlightTileDrawCall.uniform("u_mapY", map.mapY);
                this.highlightTileDrawCall.texture("u_heightMap", map.heightMapTexture);
                for (const tileId of hoveredTiles) {
                    const tileX = tileId >> 8;
                    const tileY = tileId & 0xff;
                    this.highlightTileDrawCall.uniform("u_tileX", tileX);
                    this.highlightTileDrawCall.uniform("u_tileY", tileY);
                    this.highlightTileDrawCall.draw();
                }
            }
        }
    }

    renderTilePicking(): void {
        if (!this.pickFramebuffer) {
            return;
        }
        this.app.enable(PicoGL.DEPTH_TEST);

        this.app.drawFramebuffer(this.pickFramebuffer);
        this.app.readFramebuffer(this.pickFramebuffer);

        this.app.clearMask(PicoGL.COLOR_BUFFER_BIT | PicoGL.DEPTH_BUFFER_BIT);
        this.app.clearColor(1.0, 0.0, 0.0, 1.0);
        // this.gl.clearBufferfv(PicoGL.COLOR, 0, [1.0, 0.0, 0.0, 1.0]);
        this.app.clear();

        // this.app.disable(PicoGL.CULL_FACE);
        this.app.disable(PicoGL.BLEND);

        for (let i = 0; i < this.mapManager.visibleMapCount; i++) {
            const map = this.mapManager.visibleMaps[i];

            this.tilePickingDrawCall.uniform("u_mapX", map.mapX);
            this.tilePickingDrawCall.uniform("u_mapY", map.mapY);
            this.tilePickingDrawCall.texture("u_heightMap", map.heightMapTexture);
            this.tilePickingDrawCall.draw();
        }

        const inputManager = this.mapEditor.inputManager;
        const picked = inputManager.pickX !== -1 && inputManager.pickY !== -1;
        if (inputManager.mouseX !== -1 && inputManager.mouseY !== -1) {
            this.gl.readPixels(
                inputManager.mouseX,
                this.app.height - inputManager.mouseY,
                1,
                1,
                PicoGL.RGBA,
                PicoGL.UNSIGNED_BYTE,
                this.tilePickingBuffer,
            );

            const tileX = this.tilePickingBuffer[0];
            const tileY = this.tilePickingBuffer[1];

            const mapX = this.tilePickingBuffer[2];
            const mapY = this.tilePickingBuffer[3];

            const worldX = mapX * 64 + tileX;
            const worldY = mapY * 64 + tileY;

            const isValid = tileX !== 0xff;

            if (isValid) {
                this.hoverWorldX = worldX;
                this.hoverWorldY = worldY;
                this.mapEditor.debugText = `Map: ${mapX}, ${mapY} Tile: ${tileX}, ${tileY} World: ${worldX}, ${worldY}`;
            } else {
                this.hoverWorldX = -1;
                this.hoverWorldY = -1;
                this.mapEditor.debugText = "No tile selected";
            }
        }
    }

    clearMaps(): void {
        this.mapManager.cleanUp();
        // this.mapsToLoad.clear();
    }

    override async cleanUp(): Promise<void> {
        super.cleanUp();

        // Uniforms
        this.sceneUniformBuffer?.delete();
        this.sceneUniformBuffer = undefined;

        // Framebuffers
        this.pickFramebuffer?.delete();
        this.pickFramebuffer = undefined;
        this.pickColorTarget?.delete();
        this.pickColorTarget = undefined;
        this.pickDepthTarget?.delete();
        this.pickDepthTarget = undefined;

        // Textures
        this.textureArray?.delete();
        this.textureArray = undefined;
        this.textureMaterials?.delete();
        this.textureMaterials = undefined;

        this.clearMaps();

        if (this.shadersPromise) {
            for (const shader of await this.shadersPromise) {
                shader.delete();
            }
            this.shadersPromise = undefined;
        }
    }
}
