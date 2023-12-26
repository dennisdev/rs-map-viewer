#version 300 es

#include "./includes/multi-draw.glsl";

#define TEXTURE_ANIM_UNIT (1.0f / 128.0f)

#define PI  3.141592653589793238462643383279
#define TAU 6.283185307179586476925286766559
// TAU / 2048.0
#define RS_TO_RADIANS 0.00306796157

#define FOG_CORNER_ROUNDING 8.0

#define SCENE_BORDER_SIZE 6.0

#define NPC_INTERACT_TYPE 3.0

precision highp float;

layout(std140, column_major) uniform;

uniform highp isampler2D u_textureMaterials;

#include "./includes/scene-uniforms.glsl";

// Per map square
uniform vec2 u_mapPos;
uniform float u_timeLoaded;

uniform int u_npcDataOffset;

uniform highp usampler2D u_npcDataTexture;
uniform mediump sampler2DArray u_heightMap;

layout(location = 0) in uvec3 a_vertex;

out vec4 v_color;
out vec2 v_texCoord;
flat out uint v_texId;
flat out float v_alphaCutOff;
out float v_fogAmount;
flat out vec4 v_interactId;

#include "./includes/hsl-to-rgb.glsl";
#include "./includes/branchless-logic.glsl";
#include "./includes/unpack-float.glsl";
#include "./includes/fog.glsl";

#include "./includes/material.glsl";
#include "./includes/height-map.glsl";

#include "./includes/vertex.glsl";

struct NpcInfo {
    vec2 tilePos;
    uint plane;
    uint rotation;
    uint interactId;
};

ivec2 getDataTexCoordFromIndex(int index) {
    return ivec2(index % 16, index / 16);
}

NpcInfo decodeNpcInfo(int offset) {
    uvec4 data = texelFetch(u_npcDataTexture, getDataTexCoordFromIndex(offset + gl_InstanceID), 0);

    NpcInfo info;

    info.tilePos = vec2(float(data.r), float(data.g)) / vec2(128);
    info.plane = data.b & 0x3u;
    info.rotation = data.b >> 2;
    info.interactId = data.a;

    return info;
}

mat4 rotationY( in float angle ) {
    return mat4(cos(angle),		0,		sin(angle),	0,
                         0,		1.0,			 0,	0,
                -sin(angle),	0,		cos(angle),	0,
                        0, 		0,				0,	1);
}

void main() {
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

    NpcInfo npcInfo = decodeNpcInfo(DRAW_ID + u_npcDataOffset);

    vec4 localPos = vec4(vertex.pos / vec3(128.0), 1.0) * rotationY(float(npcInfo.rotation) * RS_TO_RADIANS) + vec4(npcInfo.tilePos.x, 0, npcInfo.tilePos.y, 0.0);

    localPos.y -= getHeightInterp(npcInfo.tilePos, npcInfo.plane) / 128.0;

    localPos += vec4(vec3(u_mapPos.x, 0, u_mapPos.y) * vec3(64), 0);

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

    float interactType = NPC_INTERACT_TYPE * when_neq(v_fogAmount, 1.0);

    v_interactId = vec4(
        float(npcInfo.interactId),
        float(uint(u_mapPos.x) << 8u | uint(u_mapPos.y)),
        interactType,
        1.0
    );
    
    gl_Position = u_viewMatrix * localPos;
    gl_Position.z += float(npcInfo.plane) * 0.005 + (float(vertex.priority) + 20.0) * 0.0007;
    gl_Position = u_projectionMatrix * gl_Position;
    // gl_Position.z -= float(modelInfo.plane) * 0.0005 + (float(vertex.priority) + float(modelInfo.priority)) * 0.00007;
}
