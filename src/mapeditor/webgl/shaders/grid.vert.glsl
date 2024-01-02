#version 300 es

#define SCENE_BORDER_SIZE 6.0

// Per frame
uniform SceneUniforms {
    mat4 u_viewProjMatrix;
    mat4 u_viewMatrix;
    mat4 u_projectionMatrix;
};

// Per draw
uniform float u_mapX;
uniform float u_mapY;

uniform vec4 u_color;

uniform highp sampler2DArray u_heightMap;

in uvec2 a_pos;

out vec4 v_color;

float getHeightInterp(vec2 pos, uint plane) {
    vec2 uv = (pos + vec2(SCENE_BORDER_SIZE + 0.5)) / vec2(64.0 + SCENE_BORDER_SIZE * 2.0);

    return texture(u_heightMap, vec3(uv, plane)).r * 8.0;
}

void main() {
    vec2 tilePos = vec2(a_pos) / 128.0;
    float height = -getHeightInterp(tilePos, 0u) / 128.0;

    v_color = u_color;

    vec4 pos = vec4(tilePos.x, height - 0.01, tilePos.y, 1.0);
    pos += vec4(u_mapX, 0.0, u_mapY, 0.0) * 64.0;

    gl_Position = u_viewProjMatrix * pos;
    gl_Position.z -= 0.001;
}
