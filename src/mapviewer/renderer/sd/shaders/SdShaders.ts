import { ProgramSource, prependDefines } from "../../shared/shaders/ShaderUtil";
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
