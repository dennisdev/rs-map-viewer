import highlightTileVertShader from "./highlight-tile.vert.glsl";
import terrainFragShader from "./terrain.frag.glsl";
import terrainVertShader from "./terrain.vert.glsl";
import tilePickingFragShader from "./tile-picking.frag.glsl";
import tilePickingVertShader from "./tile-picking.vert.glsl";

export const TERRAIN_PROGRAM = [terrainVertShader, terrainFragShader];

export const TILE_PICKING_PROGRAM = [tilePickingVertShader, tilePickingFragShader];

export const HIGHLIGHT_PROGRAM = [highlightTileVertShader, tilePickingFragShader];
