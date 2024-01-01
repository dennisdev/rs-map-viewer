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

uniform highp isampler2D u_materials;
uniform highp sampler2DArray u_heightMap;

in uvec4 a_vert;

out vec4 v_color;
out vec2 v_texCoord;
flat out uint v_texId;

#include "./includes/hsl-to-rgb.glsl";
#include "./includes/material.glsl";

float getHeightInterp(vec2 pos, uint plane) {
    vec2 uv = (pos + vec2(SCENE_BORDER_SIZE + 0.5)) / vec2(64.0 + SCENE_BORDER_SIZE * 2.0);

    return texture(u_heightMap, vec3(uv, plane)).r * 8.0;
}

void main() {
    vec2 tilePos = vec2(a_vert.xy) / 128.0;
    float height = -getHeightInterp(tilePos, 0u) / 128.0;

    v_color = vec4(hslToRgb(int(a_vert.z), 1.0), 1.0);

    Material material = getMaterial(a_vert.w);
    vec2 textureAnimation = vec2(material.animU, material.animV);

    v_texCoord = tilePos;
    v_texId = a_vert.w;

    vec4 pos = vec4(tilePos.x, height, tilePos.y, 1.0);
    pos += vec4(u_mapX, 0.0, u_mapY, 0.0) * 64.0;

    gl_Position = u_viewProjMatrix * pos;
}
