#version 300 es

layout(location = 0) in vec4 a_pos;

void main() {
    gl_Position = a_pos;
}
