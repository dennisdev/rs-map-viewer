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

uniform mediump sampler2DArray u_heightMap;

out vec4 v_color;

float getHeightInterp(vec2 pos, uint plane) {
    vec2 uv = (pos + vec2(SCENE_BORDER_SIZE + 0.5)) / vec2(64.0 + SCENE_BORDER_SIZE * 2.0);

    return texture(u_heightMap, vec3(uv, plane)).r * 8.0;
}

void main() {
    int tileId = gl_VertexID / 6;
    float tileX = float(tileId % 64);
    float tileY = float(tileId / 64);

    int vertexIndex = gl_VertexID % 6;

    vec2 tilePos = vec2(TILE_X[vertexIndex] + tileX, TILE_Y[vertexIndex] + tileY);

    float height = -getHeightInterp(tilePos, 0u) / 128.0;

    v_color = vec4(tileX / 255.0, tileY / 255.0, u_mapX / 255.0, u_mapY / 255.0);
    vec4 pos = vec4(tilePos.x, height, tilePos.y, 1.0);

    pos += vec4(u_mapX, 0.0, u_mapY, 0.0) * 64.0;

    gl_Position = u_viewProjMatrix * pos;
}
