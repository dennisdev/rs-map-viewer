#version 300 es

#define SCENE_BORDER_SIZE 6.0

const float TILE_X[6] = float[](0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
const float TILE_Y[6] = float[](0.0, 1.0, 1.0, 0.0, 0.0, 1.0);

// Per frame
uniform SceneUniforms {
    mat4 u_viewProjMatrix;
    mat4 u_viewMatrix;
    mat4 u_projectionMatrix;
};

// Per draw
uniform float u_mapX;
uniform float u_mapY;
uniform float u_tileX;
uniform float u_tileY;

uniform highp sampler2DArray u_heightMap;

out vec4 v_color;

float getHeightInterp(vec2 pos, uint plane) {
    vec2 uv = (pos + vec2(SCENE_BORDER_SIZE + 0.5)) / vec2(64.0 + SCENE_BORDER_SIZE * 2.0);

    return texture(u_heightMap, vec3(uv, plane)).r * 8.0;
}

void main() {
    int vertexIndex = gl_VertexID % 6;

    vec2 tilePos = vec2(TILE_X[vertexIndex] + u_tileX, TILE_Y[vertexIndex] + u_tileY);

    float height = -getHeightInterp(tilePos, 0u) / 128.0;

    v_color = vec4(1.0, 1.0, 1.0, 0.5);
    vec4 pos = vec4(tilePos.x, height - 0.01, tilePos.y, 1.0);

    pos += vec4(u_mapX, 0.0, u_mapY, 0.0) * 64.0;

    gl_Position = u_viewProjMatrix * pos;
}
