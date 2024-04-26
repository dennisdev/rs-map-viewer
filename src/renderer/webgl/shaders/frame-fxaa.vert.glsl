#version 300 es

layout(location = 0) in vec4 a_pos;

uniform vec2 u_resolution;

out mediump vec2 v_rgbNW;
out mediump vec2 v_rgbNE;
out mediump vec2 v_rgbSW;
out mediump vec2 v_rgbSE;
out mediump vec2 v_rgbM;

#include "./includes/fxaa/texcoords.glsl";

void main() {
    gl_Position = a_pos;
    vec2 texCoord = 0.5 * gl_Position.xy + vec2(0.5);
    texcoords(texCoord * u_resolution, u_resolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);
}
