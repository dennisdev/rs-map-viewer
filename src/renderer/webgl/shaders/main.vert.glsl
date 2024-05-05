#version 300 es

#include "./includes/multi-draw.glsl";

#define TEXTURE_ANIM_UNIT (1.0f / 128.0f)

#define CONTOUR_GROUND_CENTER_TILE 0.0
#define CONTOUR_GROUND_VERTEX 1.0
#define CONTOUR_GROUND_NONE 2.0

#define FOG_CORNER_ROUNDING 8.0

precision highp float;

layout(std140, column_major) uniform;

uniform highp isampler2D u_textureMaterials;

#include "./includes/scene-uniforms.glsl";

// Per map square
uniform int u_drawIdOffset;

uniform vec2 u_mapPos;
uniform float u_timeLoaded;


uniform highp usampler2D u_modelInfoTexture;
uniform mediump isampler2DArray u_heightMap;

layout(location = 0) in uvec3 a_vertex;

out vec4 v_color;
out vec2 v_texCoord;
flat out uint v_texId;
flat out float v_alphaCutOff;
out float v_fogAmount;
flat out vec4 v_interactId;

#include "./includes/branchless-logic.glsl";
#include "./includes/hsl-to-rgb.glsl";
#include "./includes/unpack-float.glsl";
#include "./includes/fog.glsl";

#include "./includes/material.glsl";
#include "./includes/height-map.glsl";

#include "./includes/vertex.glsl";

struct ModelInfo {
    vec2 tilePos;
    uint height;
    uint plane;
    uint priority;
    float contourGround;
    uint interactType;
    uint interactId;
};

ivec2 getDataTexCoordFromIndex(int index) {
    return ivec2(index % 16, index / 16);
}

ModelInfo decodeModelInfo(int offset) {
    uvec4 data = texelFetch(u_modelInfoTexture, getDataTexCoordFromIndex(offset + gl_InstanceID), 0);

    ModelInfo info;

    info.tilePos = vec2(float(data.r & 0x3FFFu), float(data.g & 0x3FFFu));
    info.height = (data.b >> 6) * 8u;
    info.plane = data.r >> 14;
    info.priority = data.b & 0x7u;
    info.contourGround = float((data.g >> 14) & 0x3u);
    info.interactType = (data.b >> 4) & 0x3u;
    info.interactId = data.a | (((data.b >> 3u) & 0x1u) << 16u);

    return info;
}

void main() {
    int offset = int(texelFetch(u_modelInfoTexture, getDataTexCoordFromIndex(DRAW_ID + u_drawIdOffset), 0).r);

    Vertex vertex = decodeVertex(a_vertex.x, a_vertex.y, a_vertex.z, u_brightness);

    v_color = vertex.color;

    Material material = getMaterial(vertex.textureId);
    vec2 textureAnimation = vec2(material.animU, material.animV);

    if (u_isNewTextureAnim > 0.5) {
        v_texCoord = vertex.texCoord + mod(mod(u_currentTime, 128.0) * textureAnimation / 64.0, 1.0);
    } else {
        v_texCoord = vertex.texCoord + (u_currentTime / 0.02) * textureAnimation * TEXTURE_ANIM_UNIT;
    }
    v_texId = vertex.textureId;
    v_alphaCutOff = material.alphaCutOff;

    ModelInfo modelInfo = decodeModelInfo(offset);

    vec3 localPos = vertex.pos + vec3(modelInfo.tilePos.x, 0, modelInfo.tilePos.y);

    vec2 interpPos = modelInfo.tilePos * vec2(when_eq(modelInfo.contourGround, CONTOUR_GROUND_CENTER_TILE))
            + localPos.xz * vec2(when_eq(modelInfo.contourGround, CONTOUR_GROUND_VERTEX));
    localPos.y -= float(modelInfo.height);
    localPos.y -= getHeightInterp(interpPos, modelInfo.plane) * when_neq(modelInfo.contourGround, CONTOUR_GROUND_NONE);

    localPos /= 128.0;

    localPos += vec3(u_mapPos.x, 0, u_mapPos.y) * vec3(64);

    float loadAlpha = smoothstep(0.0, 1.0, min((u_currentTime - u_timeLoaded), 1.0));
    float isLoading = when_neq(loadAlpha, 1.0);

    float dist = -sdRoundedBox(
        vec2(localPos.x - u_cameraPos.x, localPos.z - u_cameraPos.y),
        vec2(u_renderDistance),
        FOG_CORNER_ROUNDING
    );

    float fogDepth = min(u_fogDepth, u_renderDistance);

    v_fogAmount = fogFactorLinear(dist, 0.0, fogDepth);
    v_fogAmount = isLoading * max(1.0 - loadAlpha, v_fogAmount) +
        (1.0 - isLoading) * v_fogAmount;

    float interactType = when_neq(v_fogAmount, 1.0) * float(modelInfo.interactType);

    v_interactId = vec4(
        float(modelInfo.interactId),
        float(uint(u_mapPos.x) << 8u | uint(u_mapPos.y)),
        interactType,
        1.0
    );

    gl_Position = u_viewMatrix * vec4(localPos, 1.0);
    // gl_Position.z += (float(vertex.priority)) * 0.0007;
    gl_Position.z += float(modelInfo.plane) * 0.005 + (float(vertex.priority) + float(modelInfo.priority)) * 0.0007;
    gl_Position = u_projectionMatrix * gl_Position;
}
