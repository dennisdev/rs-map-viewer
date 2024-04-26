import PicoGL, {
    DrawCall,
    App as PicoApp,
    Program,
    Texture,
    UniformBuffer,
    VertexArray,
    VertexBuffer,
} from "picogl";

import { MapSquare } from "../../renderer/MapManager";
import { DrawRange } from "../../renderer/DrawRange";
import { Scene } from "../../rs/scene/Scene";
import { EditorMapData } from "./loader/EditorMapData";

export function createHeightMapTexture(
    app: PicoApp,
    borderSize: number,
    heightMapTextureData: Float32Array,
): Texture {
    const heightMapSize = Scene.MAP_SQUARE_SIZE + borderSize * 2;
    return app.createTextureArray(
        heightMapTextureData,
        heightMapSize,
        heightMapSize,
        Scene.MAX_LEVELS,
        {
            internalFormat: PicoGL.R32F,
            minFilter: PicoGL.LINEAR,
            magFilter: PicoGL.LINEAR,
            type: PicoGL.FLOAT,
            wrapS: PicoGL.CLAMP_TO_EDGE,
            wrapT: PicoGL.CLAMP_TO_EDGE,
        },
    );
}

export class EditorMapSquare implements MapSquare {
    heightUpdated: boolean = false;
    underlayUpdated: boolean = false;

    constructor(
        readonly mapX: number,
        readonly mapY: number,
        readonly borderSize: number,
        readonly scene: Scene,
        readonly terrainVertexBuffer: VertexBuffer,
        readonly terrainVertexArray: VertexArray,
        readonly terrainDrawCall: DrawCall,
        readonly terrainDrawRanges: DrawRange[],
        public heightMapTexture: Texture,
        public heightMapTextureData: Float32Array,
    ) {}

    static create(
        app: PicoApp,
        mapData: EditorMapData,
        sceneUniformBuffer: UniformBuffer,
        textures: Texture,
        materialsTexture: Texture,
        terrainProgram: Program,
    ): EditorMapSquare {
        const { mapX, mapY, borderSize } = mapData;

        const scene = new Scene(mapData.scene.levels, mapData.scene.sizeX, mapData.scene.sizeY);
        scene.tileHeights = mapData.scene.tileHeights;
        scene.tileRenderFlags = mapData.scene.tileRenderFlags;
        scene.tileUnderlays = mapData.scene.tileUnderlays;
        scene.tileOverlays = mapData.scene.tileOverlays;
        scene.tileShapes = mapData.scene.tileShapes;
        scene.tileRotations = mapData.scene.tileRotations;
        scene.tileLightOcclusions = mapData.scene.tileLightOcclusions;
        scene.tileLights = mapData.scene.tileLights;
        scene.tileBlendedColors = mapData.scene.tileBlendedColors;

        const terrainVertexBuffer = app.createInterleavedBuffer(8, mapData.terrainVertices);
        const terrainVertexArray = app
            .createVertexArray()
            .vertexAttributeBuffer(0, terrainVertexBuffer, {
                type: PicoGL.UNSIGNED_SHORT,
                size: 4,
                stride: 8,
                integer: true as any,
            });

        const heightMapTexture = createHeightMapTexture(
            app,
            borderSize,
            mapData.heightMapTextureData,
        );

        const terrainDrawCall = app
            .createDrawCall(terrainProgram, terrainVertexArray)
            .uniformBlock("SceneUniforms", sceneUniformBuffer)
            .uniform("u_mapX", mapX)
            .uniform("u_mapY", mapY)
            .texture("u_textures", textures)
            .texture("u_materials", materialsTexture)
            .texture("u_heightMap", heightMapTexture);

        return new EditorMapSquare(
            mapX,
            mapY,
            borderSize,
            scene,
            terrainVertexBuffer,
            terrainVertexArray,
            terrainDrawCall,
            mapData.terrainDrawRanges,
            heightMapTexture,
            mapData.heightMapTextureData,
        );
    }

    getHeightMapIndex(x: number, y: number): number {
        const heightMapSize = Scene.MAP_SQUARE_SIZE + this.borderSize * 2;
        return x + heightMapSize * y;
    }

    getHeightMapHeight(x: number, y: number): number {
        return this.heightMapTextureData[this.getHeightMapIndex(x, y)];
    }

    setHeightMapHeight(x: number, y: number, height: number): void {
        this.heightMapTextureData[this.getHeightMapIndex(x, y)] = height;
    }

    updateHeightMapTexture(app: PicoApp): void {
        this.heightMapTexture.delete();

        this.heightMapTexture = createHeightMapTexture(
            app,
            this.borderSize,
            this.heightMapTextureData,
        );
        this.terrainDrawCall.texture("u_heightMap", this.heightMapTexture);
    }

    canRender(frameCount: number): boolean {
        return true;
    }

    delete(): void {
        this.terrainVertexBuffer.delete();
        this.terrainVertexArray.delete();
        this.heightMapTexture.delete();
    }
}
