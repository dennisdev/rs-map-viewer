import { DrawRange } from "../../../renderer/DrawRange";

export interface SceneData {
    levels: number;
    sizeX: number;
    sizeY: number;

    // Terrain
    tileHeights: Int32Array[][];

    tileRenderFlags: Uint8Array[][];
    tileUnderlays: Uint16Array[][];
    tileOverlays: Int16Array[][];
    tileShapes: Uint8Array[][];
    tileRotations: Uint8Array[][];

    // Terrain light
    tileLightOcclusions: Uint8Array[][];

    tileLights: Int32Array[][];

    // Underlays
    tileBlendedColors: Int32Array[][];
}

export interface EditorMapData {
    mapX: number;
    mapY: number;
    borderSize: number;

    scene: SceneData;

    terrainVertices: Uint8Array;
    terrainDrawRanges: DrawRange[];

    heightMapTextureData: Float32Array;
}
