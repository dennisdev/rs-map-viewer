import frameFragShader from "./frame.frag.glsl";
import frameVertShader from "./frame.vert.glsl";
import frameFxaaFragShader from "./frame-fxaa.frag.glsl";
import frameFxaaVertShader from "./frame-fxaa.vert.glsl";

export const FRAME_PROGRAM = [frameVertShader, frameFragShader];
export const FRAME_FXAA_PROGRAM = [frameFxaaVertShader, frameFxaaFragShader];
