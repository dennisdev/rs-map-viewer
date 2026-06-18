#version 300 es

precision highp float;

layout(location = 0) in vec3 a_pos;

uniform mat4 u_viewProjMatrix;
uniform float u_pointSize;

void main() {
    gl_Position = u_viewProjMatrix * vec4(a_pos, 1.0);
    gl_PointSize = u_pointSize;
}
