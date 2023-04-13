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

/*
    CENTER_TILE = 0,
    VERTEX_POS = 1,
    NO_CONTOUR = 2
*/

precision highp float;

layout(std140, column_major) uniform;

layout(location = 0) in int a_v0;
layout(location = 1) in int a_v1;
layout(location = 2) in int a_v2;

uniform TextureUniforms {
    vec2 textureAnimations[128];
};

uniform SceneUniforms {
    mat4 u_viewProjMatrix;
};

uniform mat4 u_modelMatrix;
uniform float u_currentTime;
uniform float u_timeLoaded;
uniform float u_deltaTime;
uniform float u_brightness;

uniform int u_drawIdOffset;

uniform highp usampler2D u_modelDataTexture;
uniform mediump sampler2DArray u_heightMap;

out vec4 v_color;
out vec2 v_texCoord;
flat out uint v_texId;
flat out float v_loadAlpha;

#include "./includes/hsl-to-rgb.glsl";
#include "./includes/branchless-logic.glsl";
#include "./includes/unpack-float.glsl";

float getHeightInterp(vec2 pos, uint plane) {
    vec2 uv = (pos + vec2(0.5)) / vec2(72.0);

    return texture(u_heightMap, vec3(uv, plane)).r * 8.0;
}

ivec2 getDataTexCoordFromIndex(int index) {
    return ivec2(index % 16, index / 16);
}

struct VertexData {
    vec3 pos;
    vec4 color;
    vec2 texCoord;
    uint textureId;
    uint priority;
};

VertexData decodeVertex(int v0, int v1, int v2, float brightness) {
    float x = float(((v0 >> 17) & 0x7FFF) - 0x4000);
    float u = unpackFloat6((v0 >> 11) & 0x3F);
    float v = unpackFloat11(v0 & 0x7FF);

    int hsl = (v1 >> 16) & 0xFFFF;
    float alpha = float((v1 >> 8) & 0xFF) / 255.0;
    int textureId = (v1 >> 1) & 0x7F;

    float z = float(((v2 >> 17) & 0x7FFF) - 0x4000);
    float y = -float(((v2 >> 3) & 0x3FFF) - 0x400);

    int priority = ((v2 & 0x7) << 1) | (v1 & 0x1);

    vec4 color = when_eq(float(textureId), 0.0) * vec4(hslToRgb(hsl, brightness), alpha)
        + when_neq(float(textureId), 0.0) * vec4(vec3(float(hsl) / 127.0), alpha);

    return VertexData(vec3(x, y, z), color, vec2(u, v), uint(textureId), uint(priority));
}

struct ModelInfo {
    vec2 tilePos;
    uint plane;
    uint priority;
    float contourGround;
};

ModelInfo decodeModelInfo(int offset) {
    uvec4 data = texelFetch(u_modelDataTexture, getDataTexCoordFromIndex(offset + gl_InstanceID), 0);

    ModelInfo info;

    info.plane = data.r >> uint(6);
    info.contourGround = float(int(data.r) >> 4 & 0x3);
    info.priority = (data.r & uint(0xF));

    uint tilePosPacked = (data.a << uint(16)) | data.b << uint(8) | data.g;

    info.tilePos = vec2(float(tilePosPacked >> uint(12)), float(tilePosPacked & uint(0xFFF))) / vec2(32);

    return info;
}

void main() {
    uvec2 offsetVec = texelFetch(u_modelDataTexture, getDataTexCoordFromIndex(DRAW_ID + u_drawIdOffset), 0).gr;
    int offset = int(offsetVec.x) << 8 | int(offsetVec.y);

    VertexData vertex = decodeVertex(a_v0, a_v1, a_v2, u_brightness);
    
    v_color = vertex.color;

    v_texCoord = vertex.texCoord + (u_currentTime / 0.02) * textureAnimations[vertex.textureId] * TEXTURE_ANIM_UNIT;
    v_texId = vertex.textureId;
    v_loadAlpha = smoothstep(0.0, 1.0, min((u_currentTime - u_timeLoaded), 1.0));

    ModelInfo modelInfo = decodeModelInfo(offset);

    vec3 localPos = vertex.pos / vec3(128.0) + vec3(modelInfo.tilePos.x, 0, modelInfo.tilePos.y);

    vec2 interpPos = modelInfo.tilePos * vec2(when_eq(modelInfo.contourGround, CONTOUR_GROUND_CENTER_TILE)) 
            + localPos.xz * vec2(when_eq(modelInfo.contourGround, CONTOUR_GROUND_VERTEX));
    localPos.y -= getHeightInterp(interpPos, modelInfo.plane) * when_neq(modelInfo.contourGround, CONTOUR_GROUND_NONE) / 128.0;
    
    gl_Position = u_viewProjMatrix * u_modelMatrix * vec4(localPos, 1.0);
    // gl_Position.z -= float(plane) * 0.0005 + float(priority) * 0.0003 + float(vertex.priority) * 0.0001;
    // TODO: Subtract z before projection
    gl_Position.z -= float(modelInfo.plane) * 0.001 + (float(vertex.priority) + float(modelInfo.priority)) * 0.0001;
}
