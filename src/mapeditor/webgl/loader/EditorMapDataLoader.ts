import { DrawRange, newDrawRange } from "../../../mapviewer/webgl/DrawRange";
import {
    Scene,
    applyHeightMapTextureData,
    loadHeightMapTextureData,
} from "../../../rs/scene/Scene";
import { LandscapeLoadType } from "../../../rs/scene/SceneBuilder";
import { SceneTile } from "../../../rs/scene/SceneTile";
import { WorkerState } from "../../../worker/RenderDataWorker";
import {
    LEVEL_TILE_VERTICES,
    TerrainVertexBuffer,
    getTileOffset,
} from "../buffer/TerrainVertexBuffer";
import { EditorMapData } from "./EditorMapData";
import { EditorMapTerrainData } from "./EditorMapTerrainData";

export function loadEditorMapData(
    workerState: WorkerState,
    mapX: number,
    mapY: number,
): EditorMapData | undefined {
    const textureLoader = workerState.textureLoader;
    const textureIds = textureLoader.getTextureIds().filter((id) => textureLoader.isSd(id));
    const textureIndexMap = new Map<number, number>();
    for (let i = 0; i < textureIds.length; i++) {
        textureIndexMap.set(textureIds[i], i);
    }

    const borderSize = 6;

    const baseX = mapX * Scene.MAP_SQUARE_SIZE - borderSize;
    const baseY = mapY * Scene.MAP_SQUARE_SIZE - borderSize;
    const mapSize = Scene.MAP_SQUARE_SIZE + borderSize * 2;

    const scene = workerState.sceneBuilder.buildScene(
        baseX,
        baseY,
        mapSize,
        mapSize,
        true,
        false,
        LandscapeLoadType.NO_MODELS,
    );

    const terrainVertexBuffer = new TerrainVertexBuffer(scene.levels * LEVEL_TILE_VERTICES);

    const terrainDrawRanges = addTerrain(
        textureIndexMap,
        terrainVertexBuffer,
        scene,
        borderSize,
        3,
    );

    const heightMapTextureData = loadHeightMapTextureData(scene);

    return {
        mapX,
        mapY,
        borderSize,

        terrainVertices: terrainVertexBuffer.bytes,
        terrainDrawRanges,

        heightMapTextureData,
    };
}

export function loadEditorMapTerrainData(
    workerState: WorkerState,
    mapX: number,
    mapY: number,
    heightMapTextureData: Float32Array,
): EditorMapTerrainData | undefined {
    const sceneBuilder = workerState.sceneBuilder;

    const textureLoader = workerState.textureLoader;
    const textureIds = textureLoader.getTextureIds().filter((id) => textureLoader.isSd(id));
    const textureIndexMap = new Map<number, number>();
    for (let i = 0; i < textureIds.length; i++) {
        textureIndexMap.set(textureIds[i], i);
    }

    const borderSize = 6;

    const baseX = mapX * Scene.MAP_SQUARE_SIZE - borderSize;
    const baseY = mapY * Scene.MAP_SQUARE_SIZE - borderSize;
    const mapSize = Scene.MAP_SQUARE_SIZE + borderSize * 2;

    const scene = sceneBuilder.buildScene(
        baseX,
        baseY,
        mapSize,
        mapSize,
        false,
        false,
        LandscapeLoadType.NO_MODELS,
    );

    applyHeightMapTextureData(scene, heightMapTextureData);

    sceneBuilder.addTileModels(scene, false);

    const terrainVertexBuffer = new TerrainVertexBuffer(scene.levels * LEVEL_TILE_VERTICES);

    const terrainDrawRanges = addTerrain(
        textureIndexMap,
        terrainVertexBuffer,
        scene,
        borderSize,
        3,
    );

    return {
        mapX,
        mapY,
        borderSize,

        terrainVertices: terrainVertexBuffer.bytes,
        terrainDrawRanges,
    };
}

export function addTerrain(
    textureIndexMap: Map<number, number>,
    vertexBuf: TerrainVertexBuffer,
    scene: Scene,
    borderSize: number,
    maxLevel: number,
): DrawRange[] {
    const startX = borderSize;
    const startY = borderSize;
    const endX = borderSize + Scene.MAP_SQUARE_SIZE;
    const endY = borderSize + Scene.MAP_SQUARE_SIZE;

    const vertexOffset = borderSize * -128;

    const drawRanges: DrawRange[] = [];

    for (let level = 0; level < scene.levels; level++) {
        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                const tile = scene.tiles[level][x][y];
                if (!tile || tile.minLevel > maxLevel) {
                    continue;
                }
                const realX = x - borderSize;
                const realY = y - borderSize;
                vertexBuf.offset = getTileOffset(level, realX, realY);
                addTerrainTile(textureIndexMap, vertexBuf, tile, vertexOffset, vertexOffset);
            }
        }

        const offset = level * LEVEL_TILE_VERTICES;

        drawRanges.push(newDrawRange(offset, offset + LEVEL_TILE_VERTICES));

        // if (levelVertexCount > 0) {
        // }
    }

    return drawRanges;
}

export function addTerrainTile(
    textureIndexMap: Map<number, number>,
    vertexBuf: TerrainVertexBuffer,
    tile: SceneTile,
    offsetX: number,
    offsetY: number,
): void {
    const tileModel = tile.tileModel;
    if (!tileModel) {
        return;
    }
    for (const face of tileModel.faces) {
        for (const vertex of face.vertices) {
            const textureIndex = textureIndexMap.get(vertex.textureId) ?? -1;

            // if (textureIndex !== -1) {
            //     this.usedTextureIds.add(vertex.textureId);
            // }
            // const textureIndex = vertex.textureId;

            const index = vertexBuf.addVertex(
                vertex.x + offsetX,
                vertex.z + offsetY,
                vertex.hsl,
                textureIndex,
            );
        }
    }
}
