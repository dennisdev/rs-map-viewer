import { ProgramSource, prependDefines } from "../../../renderer/webgl/shaders/ShaderUtil";
import gridVertShader from "./grid.vert.glsl";
import highlightTileVertShader from "./highlight-tile.vert.glsl";
import simpleFragShader from "./simple.frag.glsl";
import terrainFragShader from "./terrain.frag.glsl";
import terrainVertShader from "./terrain.vert.glsl";
import tilePickingVertShader from "./tile-picking.vert.glsl";

export function createProgram(
    vertShader: string,
    fragShader: string,
    hasMultiDraw: boolean,
): ProgramSource {
    const defines: string[] = [];
    if (hasMultiDraw) {
        defines.push("MULTI_DRAW");
    }
    return [prependDefines(vertShader, defines), prependDefines(fragShader, defines)];
}

export function createTerrainProgram(hasMultiDraw: boolean): ProgramSource {
    return createProgram(terrainVertShader, terrainFragShader, hasMultiDraw);
}

export const TILE_PICKING_PROGRAM = [tilePickingVertShader, simpleFragShader];

export const HIGHLIGHT_PROGRAM = [highlightTileVertShader, simpleFragShader];

export const GRID_PROGRAM = [gridVertShader, simpleFragShader];
