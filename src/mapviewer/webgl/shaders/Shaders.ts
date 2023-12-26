import { ProgramSource, prependDefines } from "./ShaderUtil";
import frameFxaaFragShader from "./frame-fxaa.frag.glsl";
import frameFxaaVertShader from "./frame-fxaa.vert.glsl";
import frameFragShader from "./frame.frag.glsl";
import frameVertShader from "./frame.vert.glsl";
import mainFragShader from "./main.frag.glsl";
import mainVertShader from "./main.vert.glsl";
import npcVertShader from "./npc.vert.glsl";

export function createProgram(
    vertShader: string,
    fragShader: string,
    hasMultiDraw: boolean,
    discardAlpha: boolean,
): ProgramSource {
    const defines: string[] = [];
    if (hasMultiDraw) {
        defines.push("MULTI_DRAW");
    }
    if (discardAlpha) {
        defines.push("DISCARD_ALPHA");
    }
    return [prependDefines(vertShader, defines), prependDefines(fragShader, defines)];
}

export function createMainProgram(hasMultiDraw: boolean, discardAlpha: boolean): ProgramSource {
    return createProgram(mainVertShader, mainFragShader, hasMultiDraw, discardAlpha);
}

export function createNpcProgram(hasMultiDraw: boolean, discardAlpha: boolean): ProgramSource {
    return createProgram(npcVertShader, mainFragShader, hasMultiDraw, discardAlpha);
}

export const FRAME_PROGRAM = [frameVertShader, frameFragShader];
export const FRAME_FXAA_PROGRAM = [frameFxaaVertShader, frameFxaaFragShader];
