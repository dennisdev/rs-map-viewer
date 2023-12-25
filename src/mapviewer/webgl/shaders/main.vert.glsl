#version 300 es

#ifdef MULTI_DRAW

    #extension GL_ANGLE_multi_draw : require
    #define DRAW_ID gl_DrawID

#else

    #define DRAW_ID u_drawId

    uniform int u_drawId;

#endif

#define TEXTURE_ANIM_UNIT (1.0f / 128.0f)

#define CONTOUR_GROUND_CENTER_TILE 0.0
#define CONTOUR_GROUND_VERTEX 1.0
#define CONTOUR_GROUND_NONE 2.0

#define FOG_CORNER_ROUNDING 8.0

#define SCENE_BORDER_SIZE 6.0

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
    float u_isNewTextureAnim;
};

// Per map square
uniform int u_drawIdOffset;

uniform vec2 u_mapPos;
uniform float u_timeLoaded;


uniform highp usampler2D u_modelInfoTexture;
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

struct Vertex {
    vec3 pos;
    vec4 color;
    vec2 texCoord;
    uint textureId;
    uint priority;
};

Vertex decodeVertex(uint v0, uint v1, uint v2, float brightness) {
    float x = float(int((v0 >> 17u) & 0x7FFFu) - 0x4000);
    float u = unpackFloat11(((v0 >> 11u) & 0x3Fu) | ((v2 & 0x1Fu) << 6u));
    float v = unpackFloat11(v0 & 0x7FFu);

    float y = -float(int((v1) & 0x7FFFu) - 0x4000);
    int hsl = int((v1 >> 15u) & 0xFFFFu);
    float isTextured = float((v1 >> 31) & 0x1u);
    float textureId = float(((hsl >> 7) | int(((v2 >> 5u) & 0x1u) << 9u)) + 1) * isTextured;

    float z = float(int((v2 >> 17u) & 0x7FFFu) - 0x4000);
    float alpha = float((v2 >> 9u) & 0xFFu) / 255.0;
    uint priority = ((v2 >> 6u) & 0x7u);

    vec4 color = when_eq(textureId, 0.0) * vec4(hslToRgb(hsl, brightness), alpha)
        + when_neq(textureId, 0.0) * vec4(vec3(float(hsl & 0x7F) / 127.0), alpha);

    return Vertex(vec3(x, y, z), color, vec2(u, v), uint(textureId), priority);
}

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

    info.tilePos = vec2(float(data.r & 0x3FFFu), float(data.g & 0x3FFFu)) / vec2(128.0);
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

    vec3 localPos = vertex.pos / vec3(128.0) + vec3(modelInfo.tilePos.x, 0, modelInfo.tilePos.y);

    vec2 interpPos = modelInfo.tilePos * vec2(when_eq(modelInfo.contourGround, CONTOUR_GROUND_CENTER_TILE)) 
            + localPos.xz * vec2(when_eq(modelInfo.contourGround, CONTOUR_GROUND_VERTEX));
    localPos.y -= float(modelInfo.height) / 128.0;
    localPos.y -= getHeightInterp(interpPos, modelInfo.plane) * when_neq(modelInfo.contourGround, CONTOUR_GROUND_NONE) / 128.0;

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
