#version 300 es

precision highp float;

uniform highp sampler2D u_frame;

out vec4 fragColor;

void main() {
    ivec2 fragCoord = ivec2(gl_FragCoord.xy);
    fragColor = texelFetch(u_frame, fragCoord, 0);
}
