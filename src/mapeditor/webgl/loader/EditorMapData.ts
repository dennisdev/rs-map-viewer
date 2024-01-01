import { DrawRange } from "../../../mapviewer/webgl/DrawRange";

export interface EditorMapData {
    mapX: number;
    mapY: number;
    borderSize: number;

    terrainVertices: Uint8Array;
    terrainDrawRanges: DrawRange[];

    heightMapTextureData: Float32Array;
}
