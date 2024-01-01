import PicoGL, {
    DrawCall,
    App as PicoApp,
    Program,
    Texture,
    UniformBuffer,
    VertexArray,
    VertexBuffer,
} from "picogl";

import { MapSquare } from "../../mapviewer/MapManager";
import { DrawRange } from "../../mapviewer/webgl/DrawRange";
import { Scene } from "../../rs/scene/Scene";
import { EditorMapData } from "./loader/EditorMapData";

export class EditorMapSquare implements MapSquare {
    static create(
        app: PicoApp,
        mapData: EditorMapData,
        sceneUniformBuffer: UniformBuffer,
        textures: Texture,
        materialsTexture: Texture,
        terrainProgram: Program,
    ): EditorMapSquare {
        const { mapX, mapY, borderSize } = mapData;

        const terrainVertexBuffer = app.createInterleavedBuffer(8, mapData.terrainVertices);
        const terrainVertexArray = app
            .createVertexArray()
            .vertexAttributeBuffer(0, terrainVertexBuffer, {
                type: PicoGL.UNSIGNED_SHORT,
                size: 4,
                stride: 8,
                integer: true as any,
            });

        const heightMapSize = Scene.MAP_SQUARE_SIZE + borderSize * 2;
        const heightMapTexture = app.createTextureArray(
            mapData.heightMapTextureData,
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
            terrainVertexBuffer,
            terrainVertexArray,
            terrainDrawCall,
            mapData.terrainDrawRanges,
            heightMapTexture,
        );
    }

    constructor(
        readonly mapX: number,
        readonly mapY: number,
        readonly terrainVertexBuffer: VertexBuffer,
        readonly terrainVertexArray: VertexArray,
        readonly terrainDrawCall: DrawCall,
        readonly terrainDrawRanges: DrawRange[],
        readonly heightMapTexture: Texture,
    ) {}

    canRender(frameCount: number): boolean {
        return true;
    }

    delete(): void {
        this.terrainVertexBuffer.delete();
        this.terrainVertexArray.delete();
        this.heightMapTexture.delete();
    }
}
