import { DrawRange } from "../../../renderer/webgl/DrawRange";

export interface EditorMapTerrainData {
    mapX: number;
    mapY: number;
    borderSize: number;

    terrainVertices: Uint8Array;
    terrainDrawRanges: DrawRange[];
}
