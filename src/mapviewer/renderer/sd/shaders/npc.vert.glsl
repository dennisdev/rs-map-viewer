#version 300 es

#ifdef MULTI_DRAW

    #extension GL_ANGLE_multi_draw : require
    #define DRAW_ID gl_DrawID

#else

    #define DRAW_ID u_drawId

    uniform int u_drawId;

#endif

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

// Per frame
uniform SceneUniforms {
    mat4 u_viewProjMatrix;
    mat4 u_viewMatrix;
    mat4 u_projectionMatrix;
    vec4 u_skyColor;
    vec2 u_cameraPos;
    float u_renderDistance;
    float u_fogDepth;
    float u_currentTime;
    float u_brightness;
    float u_colorBanding;
};

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

#include "../../shared/shaders/includes/hsl-to-rgb.glsl";
#include "../../shared/shaders/includes/branchless-logic.glsl";
#include "../../shared/shaders/includes/unpack-float.glsl";
#include "../../shared/shaders/includes/fog.glsl";

int toSignedByte(uint byteValue) {
    return int(byteValue << 24) >> 24;
}

struct Material {
    int animU;
    int animV;
    float alphaCutOff;
};

Material getMaterial(uint textureId) {
    ivec4 data = texelFetch(u_textureMaterials, ivec2(textureId, 0), 0);

    Material material;
    material.animU = data.r;
    material.animV = data.g;
    material.alphaCutOff = float(data.b & 0xFF) / 255.0;

    return material;
}

float getHeightInterp(vec2 pos, uint plane) {
    vec2 uv = (pos + vec2(SCENE_BORDER_SIZE + 0.5)) / vec2(64.0 + SCENE_BORDER_SIZE * 2.0);

    return texture(u_heightMap, vec3(uv, plane)).r * 8.0;
}

struct VertexData {
    vec4 pos;
    vec4 color;
    vec2 texCoord;
    uint textureId;
    uint priority;
};

VertexData decodeVertex(uint v0, uint v1, uint v2, float brightness) {
    float x = float(int((v0 >> 17u) & 0x7FFFu) - 0x4000);
    float u = unpackFloat11(((v0 >> 11u) & 0x3Fu) | ((v2 & 0x1Fu) << 6u));
    float v = unpackFloat11(v0 & 0x7FFu);

    float y = -float(int((v1) & 0x7FFFu) - 0x4000);
    int hsl = int((v1 >> 15u) & 0xFFFFu);
    float isTextured = float((v1 >> 31) & 0x1u);
    float textureId = float((hsl >> 7) + 1) * isTextured;

    float z = float(int((v2 >> 17u) & 0x7FFFu) - 0x4000);
    float alpha = float((v2 >> 9u) & 0xFFu) / 255.0;
    uint priority = ((v2 >> 5u) & 0xFu);

    vec4 color = when_eq(textureId, 0.0) * vec4(hslToRgb(hsl, brightness), alpha)
        + when_neq(textureId, 0.0) * vec4(vec3(float(hsl & 0x7F) / 127.0), alpha);

    return VertexData(vec4(x, y, z, 1.0), color, vec2(u, v), uint(textureId), uint(priority));
}

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
    VertexData vertex = decodeVertex(a_vertex.x, a_vertex.y, a_vertex.z, u_brightness);
    
    v_color = vertex.color;

    Material material = getMaterial(vertex.textureId);
    vec2 textureAnimation = vec2(material.animU, material.animV);

    v_texCoord = vertex.texCoord + (u_currentTime / 0.02) * textureAnimation * TEXTURE_ANIM_UNIT;
    v_texId = vertex.textureId;
    v_alphaCutOff = material.alphaCutOff;

    NpcInfo npcInfo = decodeNpcInfo(DRAW_ID + u_npcDataOffset);

    vec4 localPos = vertex.pos / vec4(vec3(128.0), 1.0) * rotationY(float(npcInfo.rotation) * RS_TO_RADIANS) + vec4(npcInfo.tilePos.x, 0, npcInfo.tilePos.y, 0.0);

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
