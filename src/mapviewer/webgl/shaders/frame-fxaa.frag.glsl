#version 300 es

precision highp float;

in vec2 v_rgbNW;
in vec2 v_rgbNE;
in vec2 v_rgbSW;
in vec2 v_rgbSE;
in vec2 v_rgbM;

uniform highp sampler2D u_frame;
uniform vec2 u_resolution;

out vec4 fragColor;

#include "./includes/fxaa/fxaa.glsl";

void main() {
    fragColor = fxaa(u_frame, gl_FragCoord.xy, u_resolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);
}
