import gridVertShader from "./grid.vert.glsl";
import highlightTileVertShader from "./highlight-tile.vert.glsl";
import simpleFragShader from "./simple.frag.glsl";
import terrainFragShader from "./terrain.frag.glsl";
import terrainVertShader from "./terrain.vert.glsl";
import tilePickingVertShader from "./tile-picking.vert.glsl";

export const TERRAIN_PROGRAM = [terrainVertShader, terrainFragShader];

export const TILE_PICKING_PROGRAM = [tilePickingVertShader, simpleFragShader];

export const HIGHLIGHT_PROGRAM = [highlightTileVertShader, simpleFragShader];

export const GRID_PROGRAM = [gridVertShader, simpleFragShader];
