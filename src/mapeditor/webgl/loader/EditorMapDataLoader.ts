import { DrawRange, newDrawRange } from "../../../mapviewer/webgl/DrawRange";
import {
    Scene,
    applyHeightMapTextureData,
    loadHeightMapTextureData,
} from "../../../rs/scene/Scene";
import { LandscapeLoadType } from "../../../rs/scene/SceneBuilder";
import { SceneTile } from "../../../rs/scene/SceneTile";
import { WorkerState } from "../../../worker/RenderDataWorker";
import { VertexBuffer } from "../buffer/VertexBuffer";
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

    const vertexBuffer = new VertexBuffer(100000);

    const terrainDrawRanges = addTerrain(textureIndexMap, vertexBuffer, scene, borderSize, 3);

    const heightMapTextureData = loadHeightMapTextureData(scene);

    return {
        mapX,
        mapY,
        borderSize,

        terrainVertices: vertexBuffer.byteArray(),
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

    const vertexBuffer = new VertexBuffer(100000);

    const terrainDrawRanges = addTerrain(textureIndexMap, vertexBuffer, scene, borderSize, 3);

    return {
        mapX,
        mapY,
        borderSize,

        terrainVertices: vertexBuffer.byteArray(),
        terrainDrawRanges,
    };
}

export function addTerrain(
    textureIndexMap: Map<number, number>,
    vertexBuf: VertexBuffer,
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
        const startOffset = vertexBuf.offset;
        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                const tile = scene.tiles[level][x][y];
                if (!tile || tile.minLevel > maxLevel) {
                    continue;
                }
                addTerrainTile(textureIndexMap, vertexBuf, tile, vertexOffset, vertexOffset);
            }
        }

        const levelVertexCount = vertexBuf.offset - startOffset;

        drawRanges.push(newDrawRange(startOffset, levelVertexCount));

        // if (levelVertexCount > 0) {
        // }
    }

    return drawRanges;
}

export function addTerrainTile(
    textureIndexMap: Map<number, number>,
    vertexBuf: VertexBuffer,
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
