import { useState, useEffect } from 'react';
import './App.css';
import WebGLCanvas from './Canvas';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { PicoGL, App as PicoApp, Timer, Program, UniformBuffer, VertexArray, Texture, DrawCall } from 'picogl';
import { MemoryFileSystem, openFromUrl } from './client/fs/FileSystem';
import { IndexType } from './client/fs/IndexType';
import { ConfigType } from './client/fs/ConfigType';
import { UnderlayDefinition } from './client/fs/definition/UnderlayDefinition';
import { ObjectSpawn, Scene } from './client/Scene';
import { OverlayDefinition } from './client/fs/definition/OverlayDefinition';
import { IndexSync } from './client/fs/Index';
import { StoreSync } from './client/fs/Store';
import { TextureDefinition } from './client/fs/definition/TextureDefinition';
import { } from './client/Client';
import { Archive } from './client/fs/Archive';
import { SpriteLoader } from './client/sprite/SpriteLoader';
import { TextureLoader } from './client/fs/loader/TextureLoader';
import { ByteBuffer } from './client/util/ByteBuffer';
import { ObjectDefinition } from './client/fs/definition/ObjectDefinition';
import { ModelData } from './client/model/ModelData';
import { Model } from './client/model/Model';
import { spawn, Pool, Worker, Transfer, TransferDescriptor, ModuleThread } from "threads";
import { RegionLoader } from './client/RegionLoader';
import { HSL_RGB_MAP, brightenRgb, packHsl } from './client/util/ColorUtil';
import { CachedUnderlayLoader } from './client/fs/loader/UnderlayLoader';
import { CachedOverlayLoader, OverlayLoader } from './client/fs/loader/OverlayLoader';
import { CachedObjectLoader } from './client/fs/loader/ObjectLoader';
import { ChunkData, ChunkDataLoader } from './ChunkDataLoader';
import { MemoryStore } from './client/fs/MemoryStore';

const DEFAULT_ZOOM: number = 25.0 / 256.0;

const TAU = Math.PI * 2;
const RS_TO_RADIANS = TAU / 2048.0;

const TILE_SIZE = 128;
const HALF_TILE_SIZE = TILE_SIZE / 2;
const QUARTER_TILE_SIZE = TILE_SIZE / 4;
const THREE_QTR_TILE_SIZE = TILE_SIZE * 3 / 4;

const tileShapeVertexIndices = [
    [1, 3, 5, 7],
    [1, 3, 5, 7],
    [1, 3, 5, 7],
    [1, 3, 5, 7, 6],
    [1, 3, 5, 7, 6],
    [1, 3, 5, 7, 6],
    [1, 3, 5, 7, 6],
    [1, 3, 5, 7, 2, 6],
    [1, 3, 5, 7, 2, 8],
    [1, 3, 5, 7, 2, 8],
    [1, 3, 5, 7, 11, 12],
    [1, 3, 5, 7, 11, 12],
    [1, 3, 5, 7, 13, 14]
];

const tileShapeFaces = [
    [0, 1, 2, 3, 0, 0, 1, 3],
    [1, 1, 2, 3, 1, 0, 1, 3],
    [0, 1, 2, 3, 1, 0, 1, 3],
    [0, 0, 1, 2, 0, 0, 2, 4, 1, 0, 4, 3],
    [0, 0, 1, 4, 0, 0, 4, 3, 1, 1, 2, 4],
    [0, 0, 4, 3, 1, 0, 1, 2, 1, 0, 2, 4],
    [0, 1, 2, 4, 1, 0, 1, 4, 1, 0, 4, 3],
    [0, 4, 1, 2, 0, 4, 2, 5, 1, 0, 4, 5, 1, 0, 5, 3],
    [0, 4, 1, 2, 0, 4, 2, 3, 0, 4, 3, 5, 1, 0, 4, 5],
    [0, 0, 4, 5, 1, 4, 1, 2, 1, 4, 2, 3, 1, 4, 3, 5],
    [0, 0, 1, 5, 0, 1, 4, 5, 0, 1, 2, 4, 1, 0, 5, 3, 1, 5, 4, 3, 1, 4, 2, 3],
    [1, 0, 1, 5, 1, 1, 4, 5, 1, 1, 2, 4, 0, 0, 5, 3, 0, 5, 4, 3, 0, 4, 2, 3],
    [1, 0, 5, 4, 1, 0, 1, 5, 0, 0, 4, 3, 0, 4, 5, 3, 0, 5, 2, 3, 0, 1, 2, 5]
];


function addTileModel(shape: number, rotation: number, textureId: number, x: number, y: number,
    heightSw: number, heightSe: number, heightNe: number, heightNw: number,
    underlayHslSw: number, underlayHslSe: number, underlayHslNe: number, underlayHslNw: number,
    overlayHslSw: number, overlayHslSe: number, overlayHslNe: number, overlayHslNw: number,
    vertices: number[], colors: number[], texCoords: number[], textureIds: number[]) {
    const tileSize = TILE_SIZE;
    const halfTileSize = HALF_TILE_SIZE;
    const quarterTileSize = QUARTER_TILE_SIZE;
    const threeQuarterTileSize = THREE_QTR_TILE_SIZE;
    const vertexIndices = tileShapeVertexIndices[shape];
    const vertexCount = vertexIndices.length;
    const vertexX: number[] = new Array(vertexCount);
    const vertexY: number[] = new Array(vertexCount);
    const vertexZ: number[] = new Array(vertexCount);
    const underlayHsls: number[] = new Array(vertexCount);
    const overlayHsls: number[] = new Array(vertexCount);
    const tileX = x * tileSize;
    const tileY = y * tileSize;

    for (let i = 0; i < vertexCount; i++) {
        let vertexIndex = vertexIndices[i];
        if ((vertexIndex & 1) == 0 && vertexIndex <= 8) {
            vertexIndex = (vertexIndex - rotation - rotation - 1 & 7) + 1;
        }

        if (vertexIndex > 8 && vertexIndex <= 12) {
            vertexIndex = (vertexIndex - 9 - rotation & 3) + 9;
        }

        if (vertexIndex > 12 && vertexIndex <= 16) {
            vertexIndex = (vertexIndex - 13 - rotation & 3) + 13;
        }

        let vertX = 0;
        let vertZ = 0;
        let vertY = 0;
        let underlayHsl = 0;
        let overlayHsl = 0;

        if (vertexIndex == 1) {
            vertX = tileX;
            vertZ = tileY;
            vertY = heightSw;
            underlayHsl = underlayHslSw;
            overlayHsl = overlayHslSw;
        } else if (vertexIndex == 2) {
            vertX = tileX + halfTileSize;
            vertZ = tileY;
            vertY = heightSe + heightSw >> 1;
            underlayHsl = underlayHslSe + underlayHslSw >> 1;
            overlayHsl = overlayHslSe + overlayHslSw >> 1;
        } else if (vertexIndex == 3) {
            vertX = tileX + tileSize;
            vertZ = tileY;
            vertY = heightSe;
            underlayHsl = underlayHslSe;
            overlayHsl = overlayHslSe;
        } else if (vertexIndex == 4) {
            vertX = tileX + tileSize;
            vertZ = tileY + halfTileSize;
            vertY = heightNe + heightSe >> 1;
            underlayHsl = underlayHslSe + underlayHslNe >> 1;
            overlayHsl = overlayHslSe + overlayHslNe >> 1;
        } else if (vertexIndex == 5) {
            vertX = tileX + tileSize;
            vertZ = tileY + tileSize;
            vertY = heightNe;
            underlayHsl = underlayHslNe;
            overlayHsl = overlayHslNe;
        } else if (vertexIndex == 6) {
            vertX = tileX + halfTileSize;
            vertZ = tileY + tileSize;
            vertY = heightNe + heightNw >> 1;
            underlayHsl = underlayHslNw + underlayHslNe >> 1;
            overlayHsl = overlayHslNw + overlayHslNe >> 1;
        } else if (vertexIndex == 7) {
            vertX = tileX;
            vertZ = tileY + tileSize;
            vertY = heightNw;
            underlayHsl = underlayHslNw;
            overlayHsl = overlayHslNw;
        } else if (vertexIndex == 8) {
            vertX = tileX;
            vertZ = tileY + halfTileSize;
            vertY = heightNw + heightSw >> 1;
            underlayHsl = underlayHslNw + underlayHslSw >> 1;
            overlayHsl = overlayHslNw + overlayHslSw >> 1;
        } else if (vertexIndex == 9) {
            vertX = tileX + halfTileSize;
            vertZ = tileY + quarterTileSize;
            vertY = heightSe + heightSw >> 1;
            underlayHsl = underlayHslSe + underlayHslSw >> 1;
            overlayHsl = overlayHslSe + overlayHslSw >> 1;
        } else if (vertexIndex == 10) {
            vertX = tileX + threeQuarterTileSize;
            vertZ = tileY + halfTileSize;
            vertY = heightNe + heightSe >> 1;
            underlayHsl = underlayHslSe + underlayHslNe >> 1;
            overlayHsl = overlayHslSe + overlayHslNe >> 1;
        } else if (vertexIndex == 11) {
            vertX = tileX + halfTileSize;
            vertZ = tileY + threeQuarterTileSize;
            vertY = heightNe + heightNw >> 1;
            underlayHsl = underlayHslNw + underlayHslNe >> 1;
            overlayHsl = overlayHslNw + overlayHslNe >> 1;
        } else if (vertexIndex == 12) {
            vertX = tileX + quarterTileSize;
            vertZ = tileY + halfTileSize;
            vertY = heightNw + heightSw >> 1;
            underlayHsl = underlayHslNw + underlayHslSw >> 1;
            overlayHsl = overlayHslNw + overlayHslSw >> 1;
        } else if (vertexIndex == 13) {
            vertX = tileX + quarterTileSize;
            vertZ = tileY + quarterTileSize;
            vertY = heightSw;
            underlayHsl = underlayHslSw;
            overlayHsl = overlayHslSw;
        } else if (vertexIndex == 14) {
            vertX = tileX + threeQuarterTileSize;
            vertZ = tileY + quarterTileSize;
            vertY = heightSe;
            underlayHsl = underlayHslSe;
            overlayHsl = overlayHslSe;
        } else if (vertexIndex == 15) {
            vertX = tileX + threeQuarterTileSize;
            vertZ = tileY + threeQuarterTileSize;
            vertY = heightNe;
            underlayHsl = underlayHslNe;
            overlayHsl = overlayHslNe;
        } else {
            vertX = tileX + quarterTileSize;
            vertZ = tileY + threeQuarterTileSize;
            vertY = heightNw;
            underlayHsl = underlayHslNw;
            overlayHsl = overlayHslNw;
        }


        vertexX[i] = vertX;
        vertexY[i] = vertY;
        vertexZ[i] = vertZ;
        underlayHsls[i] = underlayHsl;
        overlayHsls[i] = overlayHsl;
    }

    const tileFaces = tileShapeFaces[shape];
    const faceCount = tileFaces.length / 4;


    let tileFaceIndex = 0;

    // const vertices = [];
    // const colors = [];
    // const texCoords = [];
    // const textureIds = [];

    for (let i = 0; i < faceCount; i++) {
        const isOverlay = tileFaces[tileFaceIndex++] == 1;
        let a = tileFaces[tileFaceIndex++];
        let b = tileFaces[tileFaceIndex++];
        let c = tileFaces[tileFaceIndex++];

        if (a < 4) {
            a = a - rotation & 3;
        }

        if (b < 4) {
            b = b - rotation & 3;
        }

        if (c < 4) {
            c = c - rotation & 3;
        }

        let faceTextureId = -1;
        let hslA = 0;
        let hslB = 0;
        let hslC = 0;
        if (isOverlay) {
            hslA = overlayHsls[a];
            hslB = overlayHsls[b];
            hslC = overlayHsls[c];
            faceTextureId = textureId;
        } else {
            hslA = underlayHsls[a];
            hslB = underlayHsls[b];
            hslC = underlayHsls[c];
        }

        if (hslA === 12345678 && faceTextureId == -1) {
            continue;
        }

        vertices.push(
            vertexX[a] / TILE_SIZE, vertexY[a] / TILE_SIZE, vertexZ[a] / TILE_SIZE,
            vertexX[b] / TILE_SIZE, vertexY[b] / TILE_SIZE, vertexZ[b] / TILE_SIZE,
            vertexX[c] / TILE_SIZE, vertexY[c] / TILE_SIZE, vertexZ[c] / TILE_SIZE,
        );

        let rgbA = HSL_RGB_MAP[hslA];
        let rgbB = HSL_RGB_MAP[hslB];
        let rgbC = HSL_RGB_MAP[hslC];

        if (faceTextureId !== -1) {
            const lightA = (hslA & 127) / 127 * 255;
            const lightB = (hslB & 127) / 127 * 255;
            const lightC = (hslC & 127) / 127 * 255;
            // console.log(lightA, lightB, lightC, overlayHslNe, overlayHslNw, overlayHslSe, overlayHslSw);
            colors.push(
                lightA, lightA, lightA, 255,
                lightB, lightB, lightB, 255,
                lightC, lightC, lightC, 255,
            );
        } else {
            colors.push(
                (rgbA >> 16) & 0xFF, (rgbA >> 8) & 0xFF, rgbA & 0xFF, 255,
                (rgbB >> 16) & 0xFF, (rgbB >> 8) & 0xFF, rgbB & 0xFF, 255,
                (rgbC >> 16) & 0xFF, (rgbC >> 8) & 0xFF, rgbC & 0xFF, 255,
            );
        }

        // if (faceTextureId !== -1) {
        //     console.log(rgbA, rgbB, rgbC);
        // }

        // colors.push(
        //     (rgbA >> 16) & 0xFF, (rgbA >> 8) & 0xFF, rgbA & 0xFF, 1.0,
        //     (rgbB >> 16) & 0xFF, (rgbB >> 8) & 0xFF, rgbB & 0xFF, 1.0,
        //     (rgbC >> 16) & 0xFF, (rgbC >> 8) & 0xFF, rgbC & 0xFF, 1.0,
        // );

        texCoords.push(
            (vertexX[a] - tileX) / TILE_SIZE, (vertexZ[a] - tileY) / TILE_SIZE,
            (vertexX[b] - tileX) / TILE_SIZE, (vertexZ[b] - tileY) / TILE_SIZE,
            (vertexX[c] - tileX) / TILE_SIZE, (vertexZ[c] - tileY) / TILE_SIZE,
        );

        faceTextureId++;

        textureIds.push(
            faceTextureId,
            faceTextureId,
            faceTextureId
        );
    }

}

const SCALE = TILE_SIZE;

const vertexShader = `
#version 300 es
//#extension GL_ANGLE_multi_draw : require

precision highp float;

layout(std140, column_major) uniform;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec4 a_color;
layout(location = 2) in vec2 a_texCoord;
layout(location = 3) in uint a_texId;
layout(location = 4) in mat4 a_modelMatrix;
layout(location = 8) in float a_timeLoaded;

uniform SceneUniforms {
    mat4 u_viewProjMatrix;
};

uniform mat4 u_modelMatrix;
uniform float u_currentTime;

out vec4 v_color;
out vec2 v_texCoord;
flat out int v_texId;
flat out float v_loadAlpha;

void main() {
    v_color = a_color;
    v_texCoord = a_texCoord;
    v_texId = int(a_texId);
    v_loadAlpha = min(u_currentTime - a_timeLoaded, 1.0);
    gl_Position = u_viewProjMatrix * a_modelMatrix * vec4(a_position, 1.0);
}
`.trim();

const fragmentShader = `
#version 300 es
//#extension GL_ANGLE_multi_draw : require

precision highp float;

layout(std140, column_major) uniform;

in vec4 v_color;
in vec2 v_texCoord;
flat in int v_texId;
flat in float v_loadAlpha;

uniform highp sampler2DArray u_textures;

out vec4 fragColor;

void main() {
    fragColor = v_color * vec4(v_loadAlpha);
    //fragColor = texture(u_textures, vec3(v_texCoord, 1));
    if (v_texId > 0) {
        vec4 res = texture(u_textures, vec3(v_texCoord, v_texId - 1));
        fragColor = vec4(res.bgr, res.a) * v_color * vec4(v_loadAlpha);;
        //fragColor = vec4(fragColor.rgb, 1.0);
        //fragColor = v_color;
    }
}
`.trim();

const vertexShader2 = `
#version 300 es
#extension GL_ANGLE_multi_draw : require

precision highp float;

layout(std140, column_major) uniform;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec4 a_color;
layout(location = 2) in vec2 a_texCoord;
layout(location = 3) in uint a_texId;

uniform SceneUniforms {
    mat4 u_viewProjMatrix;
};

uniform mat4 u_modelMatrix;
uniform float u_currentTime;
uniform float u_timeLoaded;

uniform highp usampler2D u_perModelPosTexture;
uniform highp usampler2DArray u_heightMap;

out vec4 v_color;
out vec2 v_texCoord;
flat out int v_texId;
flat out float v_loadAlpha;

float getHeight(int x, int y, uint plane) {
    uvec2 heightPacked = texelFetch(u_heightMap, ivec3(x, y, plane), 0).gr;

    int height = int(heightPacked.x) << 8 | int(heightPacked.y);

    return float(height * 8);
}

float getHeightInterp(float x, float y, uint plane) {
    int ix = int(x);
    int iy = int(y);

    float h00 = getHeight(ix, iy, plane);
    float h10 = getHeight(ix + 1, iy, plane);
    float h01 = getHeight(ix, iy + 1, plane);
    float h11 = getHeight(ix + 1, iy + 1, plane);
    
    // bilinear interpolation
    return h00 * (1.0 - mod(x, 1.0)) * (1.0 - mod(y, 1.0)) +
        h10 * mod(x, 1.0) * (1.0 - mod(y, 1.0)) +
        h01 * (1.0 - mod(x, 1.0)) * mod(y, 1.0) +
        h11 * mod(x, 1.0) * mod(y, 1.0);
}

void main() {
    v_color = a_color;
    v_texCoord = a_texCoord;
    v_texId = int(a_texId);
    v_loadAlpha = min(u_currentTime - u_timeLoaded, 1.0);
    
    uvec2 offsetVec = texelFetch(u_perModelPosTexture, ivec2(gl_DrawID, 0), 0).gr;
    int offset = int(offsetVec.x) << 8 | int(offsetVec.y);

    uvec4 modelData = texelFetch(u_perModelPosTexture, ivec2(offset + gl_InstanceID, 0), 0);

    uint plane = modelData.g;

    int contourGround = int(modelData.r);

    vec2 tilePos = vec2(modelData.ab) / vec2(2);

    vec3 localPos = a_position + vec3(tilePos.x, 0, tilePos.y);
    
    if (contourGround == 0) {
        localPos.y -= getHeightInterp(tilePos.x, tilePos.y, plane) / 128.0;
        // localPos.y -= 5.0;
    } else {
        localPos.y -= getHeightInterp(localPos.x, localPos.z, plane) / 128.0;
        // localPos.y -= 5.0;
    }
    
    gl_Position = u_viewProjMatrix * u_modelMatrix * vec4(localPos, 1.0);
}
`.trim();

const fragmentShader2 = `
#version 300 es
#extension GL_ANGLE_multi_draw : require

precision highp float;

layout(std140, column_major) uniform;

in vec4 v_color;
in vec2 v_texCoord;
flat in int v_texId;
flat in float v_loadAlpha;

uniform highp sampler2DArray u_textures;

out vec4 fragColor;

void main() {
    fragColor = v_color * vec4(v_loadAlpha);
    //fragColor = texture(u_textures, vec3(v_texCoord, 1));
    if (v_texId > 0) {
        vec4 res = texture(u_textures, vec3(v_texCoord, v_texId - 1));
        fragColor = vec4(res.bgr, res.a) * v_color * vec4(v_loadAlpha);;
        //fragColor = vec4(fragColor.rgb, 1.0);
        //fragColor = v_color;
    }
}
`.trim();

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

function method5679(var0: number, var1: number) {
    if (var0 == -1) {
        return 12345678;
    } else {
        var1 = (var0 & 127) * var1 >> 7;
        if (var1 < 2) {
            var1 = 2;
        } else if (var1 > 126) {
            var1 = 126;
        }

        return (var0 & 0xFF80) + var1;
    }
}

function method3516(var0: number, var1: number) {
    if (var0 == -2) {
        return 12345678;
    } else if (var0 == -1) {
        if (var1 < 2) {
            var1 = 2;
        } else if (var1 > 126) {
            var1 = 126;
        }

        return var1;
    } else {
        var1 = (var0 & 127) * var1 >> 7;
        if (var1 < 2) {
            var1 = 2;
        } else if (var1 > 126) {
            var1 = 126;
        }

        return (var0 & 0xFF80) + var1;
    }
}

function getSpiralDeltas(radius: number): number[][] {
    let x = 0;
    let y = 0;
    let delta = [0, -1];

    const deltas: number[][] = [];

    for (let i = Math.pow(Math.max(radius, radius), 2); i > 0; i--) {
        if ((-radius / 2 < x && x <= radius / 2)
            && (-radius / 2 < y && y <= radius / 2)) {
            deltas.push([x, y]);
        }

        if (x === y
            || (x < 0 && x === -y)
            || (x > 0 && x === 1 - y)) {
            // change direction
            delta = [-delta[1], delta[0]]
        }

        x += delta[0];
        y += delta[1];
    }

    return deltas;
}

function computeTextureCoords(model: Model): number[] | undefined {
    const faceTextures = model.faceTextures;

    if (!faceTextures) {
        return undefined;
    }

    const vertexPositionsX = model.verticesX;
    const vertexPositionsY = model.verticesY;
    const vertexPositionsZ = model.verticesZ;

    const trianglePointsX = model.indices1;
    const trianglePointsY = model.indices2;
    const trianglePointsZ = model.indices3;

    const texTriangleX = model.texTriangleX;
    const texTriangleY = model.texTriangleY;
    const texTriangleZ = model.texTriangleZ;

    const textureCoords = model.textureCoords;

    const faceCount = model.faceCount;
    const faceTextureUCoordinates: number[] = new Array(faceCount * 6);

    for (let i = 0; i < faceCount; i++) {
        const trianglePointX = trianglePointsX[i];
        const trianglePointY = trianglePointsY[i];
        const trianglePointZ = trianglePointsZ[i];

        const textureIdx = faceTextures[i];

        if (textureIdx != -1) {
            let triangleVertexIdx1: number;
            let triangleVertexIdx2: number;
            let triangleVertexIdx3: number;

            if (textureCoords && textureCoords[i] != -1) {
                const textureCoordinate = textureCoords[i] & 255;
                triangleVertexIdx1 = texTriangleX[textureCoordinate];
                triangleVertexIdx2 = texTriangleY[textureCoordinate];
                triangleVertexIdx3 = texTriangleZ[textureCoordinate];
            }
            else {
                triangleVertexIdx1 = trianglePointX;
                triangleVertexIdx2 = trianglePointY;
                triangleVertexIdx3 = trianglePointZ;
            }

            const triangleX = vertexPositionsX[triangleVertexIdx1];
            const triangleY = vertexPositionsY[triangleVertexIdx1];
            const triangleZ = vertexPositionsZ[triangleVertexIdx1];

            const f_882_ = vertexPositionsX[triangleVertexIdx2] - triangleX;
            const f_883_ = vertexPositionsY[triangleVertexIdx2] - triangleY;
            const f_884_ = vertexPositionsZ[triangleVertexIdx2] - triangleZ;
            const f_885_ = vertexPositionsX[triangleVertexIdx3] - triangleX;
            const f_886_ = vertexPositionsY[triangleVertexIdx3] - triangleY;
            const f_887_ = vertexPositionsZ[triangleVertexIdx3] - triangleZ;
            const f_888_ = vertexPositionsX[trianglePointX] - triangleX;
            const f_889_ = vertexPositionsY[trianglePointX] - triangleY;
            const f_890_ = vertexPositionsZ[trianglePointX] - triangleZ;
            const f_891_ = vertexPositionsX[trianglePointY] - triangleX;
            const f_892_ = vertexPositionsY[trianglePointY] - triangleY;
            const f_893_ = vertexPositionsZ[trianglePointY] - triangleZ;
            const f_894_ = vertexPositionsX[trianglePointZ] - triangleX;
            const f_895_ = vertexPositionsY[trianglePointZ] - triangleY;
            const f_896_ = vertexPositionsZ[trianglePointZ] - triangleZ;

            const f_897_ = f_883_ * f_887_ - f_884_ * f_886_;
            const f_898_ = f_884_ * f_885_ - f_882_ * f_887_;
            const f_899_ = f_882_ * f_886_ - f_883_ * f_885_;
            let f_900_ = f_886_ * f_899_ - f_887_ * f_898_;
            let f_901_ = f_887_ * f_897_ - f_885_ * f_899_;
            let f_902_ = f_885_ * f_898_ - f_886_ * f_897_;
            let f_903_ = 1.0 / (f_900_ * f_882_ + f_901_ * f_883_ + f_902_ * f_884_);

            const u0 = (f_900_ * f_888_ + f_901_ * f_889_ + f_902_ * f_890_) * f_903_;
            const u1 = (f_900_ * f_891_ + f_901_ * f_892_ + f_902_ * f_893_) * f_903_;
            const u2 = (f_900_ * f_894_ + f_901_ * f_895_ + f_902_ * f_896_) * f_903_;

            f_900_ = f_883_ * f_899_ - f_884_ * f_898_;
            f_901_ = f_884_ * f_897_ - f_882_ * f_899_;
            f_902_ = f_882_ * f_898_ - f_883_ * f_897_;
            f_903_ = 1.0 / (f_900_ * f_885_ + f_901_ * f_886_ + f_902_ * f_887_);

            const v0 = (f_900_ * f_888_ + f_901_ * f_889_ + f_902_ * f_890_) * f_903_;
            const v1 = (f_900_ * f_891_ + f_901_ * f_892_ + f_902_ * f_893_) * f_903_;
            const v2 = (f_900_ * f_894_ + f_901_ * f_895_ + f_902_ * f_896_) * f_903_;

            const idx = i * 6;
            faceTextureUCoordinates[idx] = u0;
            faceTextureUCoordinates[idx + 1] = v0;
            faceTextureUCoordinates[idx + 2] = u1;
            faceTextureUCoordinates[idx + 3] = v1;
            faceTextureUCoordinates[idx + 4] = u2;
            faceTextureUCoordinates[idx + 5] = v2;
        }
    }

    return faceTextureUCoordinates;
}

const TEXTURE_SIZE = 128;
const TEXTURE_PIXEL_COUNT = TEXTURE_SIZE * TEXTURE_SIZE;

type Terrain = {
    regionX: number,
    regionY: number,
    modelMatrix: mat4,
    vertexArray: VertexArray,
    triangleCount: number,
    drawRanges: number[][],
    drawRangesLowDetail: number[][],
    timeLoaded: number,
    perModelPosTexture: Texture,
    heightMapTexture: Texture,
    drawCall: DrawCall,
    drawCallLowDetail: DrawCall,
}

function loadTerrain(app: PicoApp, regionLoader: RegionLoader, textureProvider: TextureLoader, regionX: number, regionY: number,
    modelIndex: IndexSync<StoreSync>): Terrain {

    const baseX = regionX * 64;
    const baseY = regionY * 64;

    const vertices: number[] = [];

    const colors: number[] = [];

    const texCoords: number[] = [];

    const textureIds: number[] = [];

    const region = regionLoader.getRegion(regionX, regionY);

    let terrainVertexOffset = 0;

    if (region) {
        const heights = region.tileHeights;
        const underlayIds = region.tileUnderlays;
        const overlayIds = region.tileOverlays;
        const tileShapes = region.tileShapes;
        const tileRotations = region.tileRotations;
        const renderFlags = region.tileRenderFlags;

        const blendedColors = regionLoader.getBlendedUnderlayColors(regionX, regionY);

        const lightLevels = regionLoader.getLightLevels(regionX, regionY);


        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            for (let x = 0; x < Scene.MAP_SIZE; x++) {
                for (let y = 0; y < Scene.MAP_SIZE; y++) {
                    const underlayId = underlayIds[plane][x][y] - 1;

                    const overlayId = overlayIds[plane][x][y] - 1;

                    if (underlayId == -1 && overlayId == -1) {
                        continue;
                    }

                    const heightSw = heights[plane][x][y];
                    let heightSe: number;
                    let heightNe: number;
                    let heightNw: number;


                    const lightSw = lightLevels[plane][x][y];
                    let lightSe: number;
                    let lightNe: number;
                    let lightNw: number;

                    if (x === Scene.MAP_SIZE - 1 || y === Scene.MAP_SIZE - 1) {
                        heightSe = regionLoader.getHeight(baseX + x + 1, baseY + y, plane);
                        heightNe = regionLoader.getHeight(baseX + x + 1, baseY + y + 1, plane);
                        heightNw = regionLoader.getHeight(baseX + x, baseY + y + 1, plane);

                        lightSe = regionLoader.getLightLevel(baseX + x + 1, baseY + y, plane);
                        lightNe = regionLoader.getLightLevel(baseX + x + 1, baseY + y + 1, plane);
                        lightNw = regionLoader.getLightLevel(baseX + x, baseY + y + 1, plane);
                    } else {
                        heightSe = heights[plane][x + 1][y];
                        heightNe = heights[plane][x + 1][y + 1];
                        heightNw = heights[plane][x][y + 1];

                        lightSe = lightLevels[plane][x + 1][y];
                        lightNe = lightLevels[plane][x + 1][y + 1];
                        lightNw = lightLevels[plane][x][y + 1];
                    }

                    let underlayHsl = -1;
                    if (underlayId !== -1) {
                        underlayHsl = blendedColors[plane][x][y];
                    }

                    if (overlayId == -1) {
                        addTileModel(0, 0, -1, x, y, heightSw, heightSe, heightNe, heightNw,
                            method5679(underlayHsl, lightSw), method5679(underlayHsl, lightSe), method5679(underlayHsl, lightNe), method5679(underlayHsl, lightNw),
                            0, 0, 0, 0,
                            vertices, colors, texCoords, textureIds);
                    } else {
                        const shape = tileShapes[plane][x][y] + 1;
                        const rotation = tileRotations[plane][x][y];

                        const overlay = regionLoader.getOverlayDef(overlayId);

                        const textureId = textureProvider.getTextureIndex(overlay.textureId) || -1;
                        let overlayHsl: number;
                        if (textureId !== -1) {
                            overlayHsl = -1;
                        } else if (overlay.primaryRgb == 0xFF00FF) {
                            overlayHsl = -2;
                        } else {
                            overlayHsl = packHsl(overlay.hue, overlay.saturation, overlay.lightness);
                        }

                        addTileModel(shape, rotation, textureId, x, y, heightSw, heightSe, heightNe, heightNw,
                            method5679(underlayHsl, lightSw), method5679(underlayHsl, lightSe), method5679(underlayHsl, lightNe), method5679(underlayHsl, lightNw),
                            method3516(overlayHsl, lightSw), method3516(overlayHsl, lightSe), method3516(overlayHsl, lightNe), method3516(overlayHsl, lightNw),
                            vertices, colors, texCoords, textureIds);
                    }
                }
            }
        }

        terrainVertexOffset = vertices.length;

        const landscapeData = regionLoader.getLandscapeData(regionX, regionY);
        if (landscapeData) {
            const uniqueSpawns = new Set<number>();

            const spawns = region.decodeLandscape(new ByteBuffer(landscapeData));
            // const hmm = spawns.map((spawn) => regionLoader.getObjectDef(spawn.id))
            // .filter(def => def.contouredGround >= 0);
            // console.log(hmm);

            const models: Map<number, ModelData> = new Map();

            const getModel = (id: number) => {
                let model = models.get(id);
                if (!model) {
                    const file = modelIndex.getFile(id, 0);
                    if (file) {
                        model = ModelData.decode(file.data);
                        // models.set(id, model);
                    }
                }
                return model;
            }

            const objectTriangleCounts: Map<number, [number, number]> = new Map();

            const spawnTriangleCounts: Map<number, number> = new Map();

            const uniqModels: Map<string, Model> = new Map();

            spawns.forEach(({ id, type, rotation, localX, localY, plane }) => {
                const def = regionLoader.getObjectDef(id);

                // if (def.name && def.name.toLowerCase().includes('scoreboard')) {
                //     console.log('stall', id, type, rotation);
                // }

                const modelIds = [];

                if (type === 22) {
                    // return;
                }

                if (def.objectTypes) {
                    for (let i = 0; i < def.objectTypes.length; i++) {
                        if (def.objectTypes[i] === type) {
                            modelIds.push(def.objectModels[i]);
                            break;
                        }
                    }
                }
                if (!modelIds.length && def.objectModels) {
                    modelIds.push(...def.objectModels);
                }

                if (!modelIds.length) {
                    return;
                }


                // if ((renderFlags[plane][localX][localY] & 0x2) != 0) {
                //     plane--; // bridge, shift down
                // }

                // if ((renderFlags[plane][localX][localY] & 0x8) != 0) {
                //     plane = 0; // arch, always render (at the ge for example)
                // }

                if (localX == 62) {
                    // console.log(def, type, rotation, localX, localY);
                }

                let sizeX = def.sizeX;
                let sizeY = def.sizeY;

                if (rotation == 1 || rotation == 3) {
                    sizeX = def.sizeY;
                    sizeY = def.sizeX;
                }

                const pos = vec2.fromValues(localX + sizeX / 2, localY + sizeY / 2);

                const centerHeight = regionLoader.getHeightInterp(baseX + pos[0], baseY + pos[1], plane) / SCALE;

                const adjustHeight = (x: number, y: number, height: number) => {
                    if (x > 70 || y > 70) {
                        console.log(x, y, def);
                    }
                    if (def.contouredGround == -1) {
                        return centerHeight + height;
                    }
                    return regionLoader.getHeightInterp(baseX + x, baseY + y, plane) / SCALE + height;
                };

                let [count, triangleCount] = objectTriangleCounts.get(id) || [1, 0];

                // def.isRotated ^ rotation > 3;
                const mirrored = def.isRotated != rotation > 3;

                // if (mirrored) {
                //     return;
                // }

                const hasResize = def.modelSizeX !== 128 || def.modelSizeHeight !== 128 || def.modelSizeY !== 128;

                const hasOffset = def.offsetX !== 0 || def.offsetHeight !== 0 || def.offsetY !== 0;

                const models: ModelData[] = [];

                for (let i = 0; i < modelIds.length; i++) {
                    const model = getModel(modelIds[i]);
                    if (!model) {
                        continue;
                    }

                    if (mirrored) {
                        model.mirror();
                    }

                    models.push(model);
                }

                if (!models.length) {
                    return;
                }

                if (models.length > 1 && mirrored) {
                    console.log(id, def);
                }

                const model = models.length === 1 ? models[0] : ModelData.merge(models, models.length);

                if (model.faceCount === 0) {
                    return;
                }

                uniqueSpawns.add(rotation << 24 | type << 16 | id);
                spawnTriangleCounts.set(type << 16 | id, model.faceCount);

                const copy = ModelData.copyFrom(model, true, rotation === 0 && !hasResize && !hasOffset, !def.recolorFrom, !def.retextureFrom);

                // copy.translate(HALF_TILE_SIZE, HALF_TILE_SIZE, 0);

                // if (mirrored) {
                //     copy.mirror();
                // }

                if (type == 4 && rotation > 3) {
                    copy.rotate(256);
                    copy.translate(45, 0, -45);
                }

                rotation &= 3;
                if (rotation == 1) {
                    copy.rotate90();
                } else if (rotation == 2) {
                    copy.rotate180();
                } else if (rotation == 3) {
                    copy.rotate270();
                }

                if (def.recolorFrom) {
                    for (let var7 = 0; var7 < def.recolorFrom.length; ++var7) {
                        copy.recolor(def.recolorFrom[var7], def.recolorTo[var7]);
                    }
                }

                if (def.retextureFrom) {
                    for (let var7 = 0; var7 < def.retextureFrom.length; ++var7) {
                        copy.retexture(def.retextureFrom[var7], def.retextureTo[var7]);
                    }
                }


                if (hasResize) {
                    copy.resize(def.modelSizeX, def.modelSizeHeight, def.modelSizeY);
                }


                // copy.calculateBounds();

                // if (type >= 0 && type <= 4 || type == 9 || copy.height === 240) {
                //     copy.resize(128, 127, 128);
                // }

                // if (copy.maxX === 128 || copy.minX === -128 || copy.maxZ === 128 || copy.minZ === -128) {
                //     copy.resize(50, 50, 50);
                // }

                if (hasOffset) {
                    copy.translate(def.offsetX, def.offsetHeight, def.offsetY);
                }

                // if (type === 22) {
                // copy.translate(0, -1, 0);
                // }

                copy.calculateBounds();

                const model2 = copy.light(def.ambient + 64, def.contrast + 768, -50, -10, -50);
                uniqModels.set(JSON.stringify(model2), model2);
                // if (id === 44930) {
                //     // console.log(copy.normals);
                //     // const correct = new Int32Array([6932, 6933, 6687, 6687, 6686, 6686, 6686, 6683, 6683, 6928, 6928, 6929, 6928, 6683, 6681, 6690, 6690, 6690, 6687, 6687, 6685, 6685, 6686, 6688, 6685, 6690, 6690, 6686, 6686, 6686, 6690, 6690, 6690, 6690, 6690, 6690, 6690, 6684, 6684, 6680, 6680, 6680, 6680, 6686, 6689, 6686, 6688, 6680, 6680, 6680, 6686, 6686, 6685, 6685, 6685, 6683, 6683, 6686, 6686, 6686, 6686, 6681, 6689, 6685, 6686, 6686, 6680, 6681, 6683, 6685, 6690, 6684, 6681, 6688, 6684, 6680, 6680, 6680, 6682, 6684, 6688, 6690, 6681, 6680, 6690, 6690, 6685, 6686, 6681, 6681, 6680, 7616, 7616, 7616, 7616, 7616, 7616, 7619, 8652, 8652, 8652, 7617, 7617, 7617, 8652, 8652, 8652, 8652, 8652, 7617, 7617, 7617, 8652, 8652, 7617, 7617, 7617, 7617, 7617, 7617, 8652, 8652, 7617, 7617, 7617, 8652, 8652, 7617, 7617, 7617, 8652, 7620, 7617, 7617, 7617, 7618, 7617, 7617, 7617, 7617, 7617, 7617, 8652, 8652, 8652, 8652, 8652, 8652, 8652, 8652, 8652, 7617, 7617, 7617, 7617, 7617, 7617, 7617, 7617, 7617, 7617, 7617, 7618, 7618, 7619, 7617, 7617, 7617, 7619, 7617, 7617, 7616, 7616, 7616, 7616, 7616, 7616, 7618, 7620, 7619, 7619, 7619, 7619, 7619, 7619, 7617, 7617, 6690, 6690, 6684, 6684, 6682, 6681, 6680, 6680, 6684, 6685, 6690, 6690, 6690, 6690, 6690, 6690, 6690, 6690, 6690, 6688, 6689, 6687, 6684, 6680, 6681, 6680, 6680, 6680, 6684, 6684, 6929, 6928, 6932, 6933, 6687, 6687, 6687, 6680, 6680, 6680, 6681, 6927, 6926, 6680, 6681, 6680, 6686, 6686, 6686, 6686, 6686, 6930, 6930, 6686, 6686, 6686, 6685, 6930, 6931, 6688, 6685, 6686, 6687, 6680, 6683, 6684, 6690, 6690, 6690, 6687, 6687, 6690, 6680, 6681, 6681, 6686, 6685, 6690, 6687, 6687, 6687, 6687, 6687, 6687, 6685, 6685, 6684, 6684, 6686, 7478, 7478, 7476, 7478, 7478, 7477, 7478, 7478, 7477, 7477, 7477, 7477, 7479, 7477, 7477, 7476, 7477, 7477, 7477, 7477, 7477, 7477, 7477, 7477, 7477, 7475, 7477, 7477, 7478, 7478]);
                //     // console.log(JSON.stringify(correct) === JSON.stringify(model2.faceColors1));
                //     // console.log(JSON.stringify(correct));
                //     // console.log(JSON.stringify(model2.faceColors1));
                //     // console.log(model2.faceColors1);
                //     // console.log(model2.faceColors2);
                //     // console.log(model2.faceColors3);
                // } else if (id == 980 && localX == 62) {
                //     console.log(copy.normals);
                //     const correctA = new Int32Array([6028, 6028, 6029, 6029, 6029, 6023, 6020, 6020, 6020, 6020, 6037, 6035, 6035, 6035, 6037, 6037, 6028, 6028, 6029, 6029, 6029, 6023, 6021, 6021, 6021, 6037, 6035, 6035, 6035, 6035, 6037, 6037, 6024, 6024, 6025, 6025, 6025, 6030, 6024, 6024, 6025, 6025, 6025, 6030, 6031, 6033, 6034, 6023, 6022, 6022, 6020, 6031, 6029, 6035, 6037, 6026, 6018, 6019, 6019, 6018, 6022, 6018, 6018, 6018, 6018, 6027, 6031, 6031]
                //     );
                //     const correctB = new Int32Array([6022, 6035, 6035, 6034, 6023, 6023, 6022, 6019, 6018, 6022, 6022, 6032, 6030, 6031, 6034, 6035, 6022, 6035, 6035, 6034, 6022, 6022, 6022, 6018, 6027, 6027, 6035, 6026, 6030, 6030, 6034, 6035, 6029, 6018, 6019, 6020, 6031, 6031, 6029, 6018, 6019, 6020, 6031, 6031, 6029, 6029, 6037, 6037, 6026, 6018, 6018, 6018, 6026, 6026, 6027, 6026, 6027, 6018, 6018, 6020, 6020, 6020, 6019, 6018, 6018, 6018, 6020, 6018]
                //     );
                //     const correctC = new Int32Array([6035, 6033, 6034, 6023, 6023, 6020, 6019, 6018, 6022, 6037, 6034, 6030, 6031, 6033, 6035, 6037, 6035, 6033, 6034, 6022, 6023, 6021, 6018, 6026, 6037, 6037, 6026, 6030, 6030, 6032, 6035, 6037, 6018, 6019, 6020, 6031, 6030, 6032, 6018, 6019, 6020, 6031, 6030, 6033, 6033, 6035, 6023, 6027, 6018, 6019, 6031, 6027, 6035, 6026, 6027, 6018, 6027, 6018, 6020, 6022, 6018, 6019, 6018, 6026, 6027, 6032, 6018, 6033]
                //     );
                //     const rgbsA = ([3546625, 3546625, 3809281, 3809281, 3809281, 2167296, 1248000, 1248000, 1248000, 1248000, 5911299, 5385987, 5385987, 5385987, 5911299, 5911299, 3546625, 3546625, 3809281, 3809281, 3809281, 2167296, 1576192, 1576192, 1576192, 5911299, 5385987, 5385987, 5385987, 5385987, 5911299, 5911299, 2495745, 2495745, 2692865, 2692865, 2692865, 4137473, 2495745, 2495745, 2692865, 2692865, 2692865, 4137473, 4400385, 4860163, 5123075, 2167296, 1904640, 1904640, 1248000, 4400385, 3809281, 5385987, 5911299, 2955521, 656896, 985088, 985088, 656896, 1904640, 656896, 656896, 656896, 656896, 3283969, 4400385, 4400385]
                //     );
                //     const rgbsB = ([1904640, 5385987, 5385987, 5123075, 2167296, 2167296, 1904640, 985088, 656896, 1904640, 1904640, 4663043, 4137473, 4400385, 5123075, 5385987, 1904640, 5385987, 5385987, 5123075, 1904640, 1904640, 1904640, 656896, 3283969, 3283969, 5385987, 2955521, 4137473, 4137473, 5123075, 5385987, 3809281, 656896, 985088, 1248000, 4400385, 4400385, 3809281, 656896, 985088, 1248000, 4400385, 4400385, 3809281, 3809281, 5911299, 5911299, 2955521, 656896, 656896, 656896, 2955521, 2955521, 3283969, 2955521, 3283969, 656896, 656896, 1248000, 1248000, 1248000, 985088, 656896, 656896, 656896, 1248000, 656896]
                //     );
                //     const rgbsC = ([5385987, 4860163, 5123075, 2167296, 2167296, 1248000, 985088, 656896, 1904640, 5911299, 5123075, 4137473, 4400385, 4860163, 5385987, 5911299, 5385987, 4860163, 5123075, 1904640, 2167296, 1576192, 656896, 2955521, 5911299, 5911299, 2955521, 4137473, 4137473, 4663043, 5385987, 5911299, 656896, 985088, 1248000, 4400385, 4137473, 4663043, 656896, 985088, 1248000, 4400385, 4137473, 4860163, 4860163, 5385987, 2167296, 3283969, 656896, 985088, 4400385, 3283969, 5385987, 2955521, 3283969, 656896, 3283969, 656896, 1248000, 1904640, 656896, 985088, 656896, 2955521, 3283969, 4663043, 656896, 4860163]
                //     );
                //     console.log(JSON.stringify(correctA) === JSON.stringify(model2.faceColors1));
                //     console.log(JSON.stringify(correctB) === JSON.stringify(model2.faceColors2));
                //     console.log(JSON.stringify(correctC) === JSON.stringify(model2.faceColors3));
                //     console.log(JSON.stringify(rgbsA) === JSON.stringify(Array.from(model2.faceColors1).map(i => HSL_RGB_MAP[i])));
                //     console.log(JSON.stringify(rgbsB) === JSON.stringify(Array.from(model2.faceColors2).map(i => HSL_RGB_MAP[i])));
                //     console.log(JSON.stringify(rgbsC) === JSON.stringify(Array.from(model2.faceColors3).map(i => HSL_RGB_MAP[i])));
                //     console.log(JSON.stringify(correctA));
                //     console.log(JSON.stringify(model2.faceColors1));

                //     console.log(JSON.stringify(rgbsA));
                //     console.log(JSON.stringify(Array.from(model2.faceColors1).map(i => HSL_RGB_MAP[i])));
                //     console.log(model2.faceColors1);
                //     console.log(model2.faceColors2);
                //     console.log(model2.faceColors3);
                // }

                triangleCount += model.faceCount;

                const verticesX = model2.verticesX;
                const verticesY = model2.verticesY;
                const verticesZ = model2.verticesZ;

                const facesA = model2.indices1;
                const facesB = model2.indices2;
                const facesC = model2.indices3;

                const faceAlphas = model2.faceAlphas;

                const faceColors = model.faceColors;

                const modelTexCoords = computeTextureCoords(model2);

                // console.log(model.normals)

                for (let f = 0; f < model.faceCount; f++) {
                    const fa = facesA[f];
                    const fb = facesB[f];
                    const fc = facesC[f];

                    const hsl = faceColors[f] & 0xFFFF;

                    let faceAlpha = (faceAlphas && faceAlphas[f] & 0xFF) || 255;

                    if (faceAlpha === 0 || faceAlpha == 0xfe) {
                        console.log(def, f);
                        continue;
                    }

                    // const rgb = HSL_RGB_MAP[hsl];
                    // const r = (rgb >> 16) & 0xFF;
                    // const g = (rgb >> 8) & 0xFF;
                    // const b = rgb & 0xFF;

                    let hslA = model2.faceColors1[f];
                    let hslB = model2.faceColors2[f];
                    let hslC = model2.faceColors3[f];

                    if (hslC == -1) {
                        hslC = hslB = hslA;
                    } else if (hslC == -2) {
                        continue;
                    }

                    const textureId = (model2.faceTextures && model2.faceTextures[f]) || -1;

                    const textureIndex = textureProvider.getTextureIndex(textureId) || -1;

                    let rgbA = HSL_RGB_MAP[hslA];
                    let rgbB = HSL_RGB_MAP[hslB];
                    let rgbC = HSL_RGB_MAP[hslC];

                    // const SCALE = 128;

                    const vxa = pos[0] + verticesX[fa] / SCALE;
                    const vxb = pos[0] + verticesX[fb] / SCALE;
                    const vxc = pos[0] + verticesX[fc] / SCALE;

                    const vza = pos[1] + verticesZ[fa] / SCALE;
                    const vzb = pos[1] + verticesZ[fb] / SCALE;
                    const vzc = pos[1] + verticesZ[fc] / SCALE;

                    if (mirrored) {
                        // reverse order for backface culling to work
                        vertices.push(
                            vxa, adjustHeight(vxa, vza, verticesY[fa] / SCALE), vza,
                            vxb, adjustHeight(vxb, vzb, verticesY[fb] / SCALE), vzb,
                            vxc, adjustHeight(vxc, vzc, verticesY[fc] / SCALE), vzc,
                        );
                    } else {
                        vertices.push(
                            vxa, adjustHeight(vxa, vza, verticesY[fa] / SCALE), vza,
                            vxb, adjustHeight(vxb, vzb, verticesY[fb] / SCALE), vzb,
                            vxc, adjustHeight(vxc, vzc, verticesY[fc] / SCALE), vzc,
                        );
                    }

                    // colors.push(
                    //     r, g, b, 1,
                    //     r, g, b, 1,
                    //     r, g, b, 1,
                    // );

                    if (textureIndex !== -1) {
                        const lightA = (hslA & 127) / 127 * 255;
                        const lightB = (hslB & 127) / 127 * 255;
                        const lightC = (hslC & 127) / 127 * 255;
                        // console.log(lightA, lightB, lightC, overlayHslNe, overlayHslNw, overlayHslSe, overlayHslSw);
                        colors.push(
                            lightA, lightA, lightA, 255,
                            lightB, lightB, lightB, 255,
                            lightC, lightC, lightC, 255,
                        );
                    } else {
                        colors.push(
                            (rgbA >> 16) & 0xFF, (rgbA >> 8) & 0xFF, rgbA & 0xFF, faceAlpha,
                            (rgbB >> 16) & 0xFF, (rgbB >> 8) & 0xFF, rgbB & 0xFF, faceAlpha,
                            (rgbC >> 16) & 0xFF, (rgbC >> 8) & 0xFF, rgbC & 0xFF, faceAlpha,
                        );
                    }

                    if (modelTexCoords) {
                        const texCoordIdx = f * 6;
                        texCoords.push(
                            modelTexCoords[texCoordIdx], modelTexCoords[texCoordIdx + 1],
                            modelTexCoords[texCoordIdx + 2], modelTexCoords[texCoordIdx + 3],
                            modelTexCoords[texCoordIdx + 4], modelTexCoords[texCoordIdx + 5],
                        );
                    } else {
                        texCoords.push(
                            0, 0,
                            0, 0,
                            0, 0,
                        );
                    }

                    textureIds.push(
                        textureIndex + 1,
                        textureIndex + 1,
                        textureIndex + 1,
                    );
                }

                objectTriangleCounts.set(id, [count + 1, triangleCount]);
            });

            console.log(Array.from(objectTriangleCounts.entries()).filter(([id, [count, triangleCount]]) => triangleCount > 5000));

            console.log(Array.from(spawnTriangleCounts.values()).reduce((a, b) => a + b, 0));
            console.log(uniqueSpawns);
            console.log(uniqModels.size);
            console.log(Array.from(uniqModels.values()).map(m => m.faceCount).reduce((a, b) => a + b, 0));
        }
    }


    console.log('triangles: ', vertices.length / 3);

    // addTile(-0.5, -0.5);
    // addTile(-0.5, 0);
    // addTile(-0.5, 0.5);
    // addTile(0, -0.5);
    // addTile(0, 0);
    // addTile(0, 0.5);
    // addTile(0.5, -0.5);
    // addTile(0.5, 0);
    // addTile(0.5, 0.5);

    // const matrices = new Float32Array(1 * 16);

    // for (let i = 0; i < 1; i++) {
    //     const modelMatrix = mat4.create();
    //     mat4.translate(modelMatrix, modelMatrix, [baseX, 0, baseY + i * 64]);
    //     matrices.set(modelMatrix as Float32Array, i * 16);
    // }

    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [baseX, 0, baseY]);

    console.time('convert');
    const verticesTyped = new Float32Array(vertices);
    const colorsTyped = new Uint8Array(colors);
    const texCoordsTyped = new Float32Array(texCoords);
    const textureIdsTyped = new Uint8Array(textureIds);
    console.timeEnd('convert');

    console.time('upload');
    // 3 * 4 + 4 + 2 * 4 + 1
    const positionBuffer = app.createVertexBuffer(PicoGL.FLOAT, 3, verticesTyped);
    const colorBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 4, colorsTyped);
    const texCoordBuffer = app.createVertexBuffer(PicoGL.FLOAT, 2, texCoordsTyped);
    const textureIdBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 1, textureIdsTyped);

    const modelMatrixBuffer = app.createVertexBuffer(PicoGL.FLOAT_MAT4, 1, modelMatrix as Float32Array);
    const loadedTimeBuffer = app.createVertexBuffer(PicoGL.FLOAT, 1, new Float32Array([performance.now() * 0.001]));

    const vertexArray = app.createVertexArray()
        .vertexAttributeBuffer(0, positionBuffer)
        .vertexAttributeBuffer(1, colorBuffer, { normalized: true })
        .vertexAttributeBuffer(2, texCoordBuffer)
        .vertexAttributeBuffer(3, textureIdBuffer)
        .instanceAttributeBuffer(4, modelMatrixBuffer)
        .instanceAttributeBuffer(8, loadedTimeBuffer);

    console.timeEnd('upload');

    return {
        regionX, regionY, modelMatrix, vertexArray, triangleCount: vertices.length / 3,
        heights: region && region.tileHeights, drawRanges: [[0, vertices.length / 3, 1]],
        timeLoaded: performance.now()
    } as any;
}

type ModelSpawns = {
    model: Model,
    positions: vec3[],
    mirrored: boolean,
    def: ObjectDefinition,
    type: number,
}

function loadTerrain2(app: PicoApp, regionLoader: RegionLoader, textureProvider: TextureLoader, regionX: number, regionY: number,
    modelIndex: IndexSync<StoreSync>): Terrain {

    const baseX = regionX * 64;
    const baseY = regionY * 64;

    const vertices: number[] = [];

    const colors: number[] = [];

    const texCoords: number[] = [];

    const textureIds: number[] = [];

    const region = regionLoader.getRegion(regionX, regionY);

    let terrainVertexOffset = 0;

    const baseModelMatrix = mat4.create();
    mat4.translate(baseModelMatrix, baseModelMatrix, [baseX, 0, baseY]);

    const matrices: mat4[] = [];

    const drawRanges: number[][] = [];

    const modelPosOffsets: number[] = [];

    const modelPositions: vec4[] = [];

    let floorDecorationDrawOffset: number | undefined = undefined;

    if (region) {
        const heights = region.tileHeights;
        const underlayIds = region.tileUnderlays;
        const overlayIds = region.tileOverlays;
        const tileShapes = region.tileShapes;
        const tileRotations = region.tileRotations;
        const renderFlags = region.tileRenderFlags;

        const blendedColors = regionLoader.getBlendedUnderlayColors(regionX, regionY);

        const lightLevels = regionLoader.getLightLevels(regionX, regionY);



        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            for (let x = 0; x < Scene.MAP_SIZE; x++) {
                for (let y = 0; y < Scene.MAP_SIZE; y++) {
                    const underlayId = underlayIds[plane][x][y] - 1;

                    const overlayId = overlayIds[plane][x][y] - 1;

                    if (underlayId == -1 && overlayId == -1) {
                        continue;
                    }

                    const heightSw = heights[plane][x][y];
                    let heightSe: number;
                    let heightNe: number;
                    let heightNw: number;


                    const lightSw = lightLevels[plane][x][y];
                    let lightSe: number;
                    let lightNe: number;
                    let lightNw: number;

                    if (x === Scene.MAP_SIZE - 1 || y === Scene.MAP_SIZE - 1) {
                        heightSe = regionLoader.getHeight(baseX + x + 1, baseY + y, plane);
                        heightNe = regionLoader.getHeight(baseX + x + 1, baseY + y + 1, plane);
                        heightNw = regionLoader.getHeight(baseX + x, baseY + y + 1, plane);

                        lightSe = regionLoader.getLightLevel(baseX + x + 1, baseY + y, plane);
                        lightNe = regionLoader.getLightLevel(baseX + x + 1, baseY + y + 1, plane);
                        lightNw = regionLoader.getLightLevel(baseX + x, baseY + y + 1, plane);
                    } else {
                        heightSe = heights[plane][x + 1][y];
                        heightNe = heights[plane][x + 1][y + 1];
                        heightNw = heights[plane][x][y + 1];

                        lightSe = lightLevels[plane][x + 1][y];
                        lightNe = lightLevels[plane][x + 1][y + 1];
                        lightNw = lightLevels[plane][x][y + 1];
                    }

                    let underlayHsl = -1;
                    if (underlayId !== -1) {
                        underlayHsl = blendedColors[plane][x][y];
                    }

                    if (overlayId == -1) {
                        addTileModel(0, 0, -1, x, y, heightSw, heightSe, heightNe, heightNw,
                            method5679(underlayHsl, lightSw), method5679(underlayHsl, lightSe), method5679(underlayHsl, lightNe), method5679(underlayHsl, lightNw),
                            0, 0, 0, 0,
                            vertices, colors, texCoords, textureIds);
                    } else {
                        const shape = tileShapes[plane][x][y] + 1;
                        const rotation = tileRotations[plane][x][y];

                        const overlay = regionLoader.getOverlayDef(overlayId);

                        const textureId = textureProvider.getTextureIndex(overlay.textureId) || -1;
                        let overlayHsl: number;
                        if (textureId !== -1) {
                            overlayHsl = -1;
                        } else if (overlay.primaryRgb == 0xFF00FF) {
                            overlayHsl = -2;
                        } else {
                            overlayHsl = packHsl(overlay.hue, overlay.saturation, overlay.lightness);
                        }

                        addTileModel(shape, rotation, textureId, x, y, heightSw, heightSe, heightNe, heightNw,
                            method5679(underlayHsl, lightSw), method5679(underlayHsl, lightSe), method5679(underlayHsl, lightNe), method5679(underlayHsl, lightNw),
                            method3516(overlayHsl, lightSw), method3516(overlayHsl, lightSe), method3516(overlayHsl, lightNe), method3516(overlayHsl, lightNw),
                            vertices, colors, texCoords, textureIds);
                    }
                }
            }
        }

        terrainVertexOffset = vertices.length;


        matrices.push(baseModelMatrix);

        modelPosOffsets.push(modelPositions.length);
        modelPositions.push([0, 0, 0, 0]);
        drawRanges.push([0, terrainVertexOffset / 3, 1]);

        const landscapeData = regionLoader.getLandscapeData(regionX, regionY);
        if (landscapeData) {
            const uniqueSpawns = new Set<number>();

            const spawns = region.decodeLandscape(new ByteBuffer(landscapeData));
            // const hmm = spawns.map((spawn) => regionLoader.getObjectDef(spawn.id))
            // .filter(def => def.contouredGround >= 0);
            // console.log(hmm);

            const models: Map<number, ModelData> = new Map();

            const getModel = (id: number) => {
                let model = models.get(id);
                if (!model) {
                    const file = modelIndex.getFile(id, 0);
                    if (file) {
                        model = ModelData.decode(file.data);
                        // models.set(id, model);
                    }
                }
                return model;
            }

            const objectTriangleCounts: Map<number, [number, number]> = new Map();

            const spawnTriangleCounts: Map<number, number> = new Map();

            const uniqModels: Map<string, Model> = new Map();

            const regionModelSpawns: Map<string, ModelSpawns> = new Map();

            for (const spawn of spawns) {
                let { id, type, rotation, localX, localY, plane } = spawn;
                const def = regionLoader.getObjectDef(id);

                // if (def.name && def.name.toLowerCase().includes('scoreboard')) {
                //     console.log('stall', id, type, rotation);
                // }

                const modelIds = [];

                if (type === 22) {
                    // return;
                }

                if (def.objectTypes) {
                    for (let i = 0; i < def.objectTypes.length; i++) {
                        if (def.objectTypes[i] === type) {
                            modelIds.push(def.objectModels[i]);
                            break;
                        }
                    }
                }
                if (!modelIds.length && def.objectModels) {
                    modelIds.push(...def.objectModels);
                }

                if (!modelIds.length) {
                    continue;
                }


                // if ((renderFlags[plane][localX][localY] & 0x2) != 0) {
                //     plane--; // bridge, shift down
                // }

                // if ((renderFlags[plane][localX][localY] & 0x8) != 0) {
                //     plane = 0; // arch, always render (at the ge for example)
                // }

                if (localX == 62) {
                    // console.log(def, type, rotation, localX, localY);
                }

                let sizeX = def.sizeX;
                let sizeY = def.sizeY;

                if (rotation == 1 || rotation == 3) {
                    sizeX = def.sizeY;
                    sizeY = def.sizeX;
                }

                const pos = vec2.fromValues(localX + sizeX / 2, localY + sizeY / 2);

                const centerHeight = regionLoader.getHeightInterp(baseX + pos[0], baseY + pos[1], plane) / SCALE;

                const adjustHeight = (x: number, y: number, height: number) => {
                    if (x > 70 || y > 70) {
                        console.log(x, y, def);
                    }
                    if (def.contouredGround == -1) {
                        return centerHeight + height;
                    }
                    return regionLoader.getHeightInterp(baseX + x, baseY + y, plane) / SCALE + height;
                };

                let [count, triangleCount] = objectTriangleCounts.get(id) || [1, 0];

                // def.isRotated ^ rotation > 3;
                const mirrored = def.isRotated != rotation > 3;

                // if (mirrored) {
                //     return;
                // }

                const hasResize = def.modelSizeX !== 128 || def.modelSizeHeight !== 128 || def.modelSizeY !== 128;

                const hasOffset = def.offsetX !== 0 || def.offsetHeight !== 0 || def.offsetY !== 0;

                const models: ModelData[] = [];

                for (let i = 0; i < modelIds.length; i++) {
                    const model = getModel(modelIds[i]);
                    if (!model) {
                        continue;
                    }

                    if (mirrored) {
                        model.mirror();
                    }

                    models.push(model);
                }

                if (!models.length) {
                    continue;
                }

                if (models.length > 1 && mirrored) {
                    console.log(id, def);
                }

                const model = models.length === 1 ? models[0] : ModelData.merge(models, models.length);

                if (model.faceCount === 0) {
                    continue;
                }

                uniqueSpawns.add(rotation << 24 | type << 16 | id);
                spawnTriangleCounts.set(type << 16 | id, model.faceCount);

                const copy = ModelData.copyFrom(model, true, rotation === 0 && !hasResize && !hasOffset, !def.recolorFrom, !def.retextureFrom);

                // copy.translate(HALF_TILE_SIZE, HALF_TILE_SIZE, 0);

                // if (mirrored) {
                //     copy.mirror();
                // }

                if (type == 4 && rotation > 3) {
                    copy.rotate(256);
                    copy.translate(45, 0, -45);
                }

                rotation &= 3;
                if (rotation == 1) {
                    copy.rotate90();
                } else if (rotation == 2) {
                    copy.rotate180();
                } else if (rotation == 3) {
                    copy.rotate270();
                }

                if (def.recolorFrom) {
                    for (let var7 = 0; var7 < def.recolorFrom.length; ++var7) {
                        copy.recolor(def.recolorFrom[var7], def.recolorTo[var7]);
                    }
                }

                if (def.retextureFrom) {
                    for (let var7 = 0; var7 < def.retextureFrom.length; ++var7) {
                        copy.retexture(def.retextureFrom[var7], def.retextureTo[var7]);
                    }
                }


                if (hasResize) {
                    copy.resize(def.modelSizeX, def.modelSizeHeight, def.modelSizeY);
                }


                // copy.calculateBounds();

                // if (type >= 0 && type <= 4 || type == 9 || copy.height === 240) {
                //     copy.resize(128, 127, 128);
                // }

                // if (copy.maxX === 128 || copy.minX === -128 || copy.maxZ === 128 || copy.minZ === -128) {
                //     copy.resize(50, 50, 50);
                // }

                if (hasOffset) {
                    copy.translate(def.offsetX, def.offsetHeight, def.offsetY);
                }

                // if (type === 22) {
                // copy.translate(0, -1, 0);
                // }

                copy.calculateBounds();

                const model2 = copy.light(def.ambient + 64, def.contrast + 768, -50, -10, -50);
                const modelJson = JSON.stringify(model2);
                uniqModels.set(modelJson, model2);

                const modelSpawns = regionModelSpawns.get(modelJson) || { model: model2, positions: [], mirrored, def, type };
                modelSpawns.positions.push([pos[0], pos[1], plane]);
                regionModelSpawns.set(modelJson, modelSpawns);
            }

            // let offset = terrainVertexOffset;

            console.log('diff models: ', regionModelSpawns.size);

            const allModelSpawns = Array.from(regionModelSpawns.values());

            allModelSpawns.sort((a, b) => a.type - b.type);

            for (let i = 0; i < allModelSpawns.length; i++) {
                const modelSpawns = allModelSpawns[i];

                if (floorDecorationDrawOffset === undefined && modelSpawns.type === 22) {
                    floorDecorationDrawOffset = i;
                }

                const model = modelSpawns.model;
                const mirrored = modelSpawns.mirrored;

                const verticesX = model.verticesX;
                const verticesY = model.verticesY;
                const verticesZ = model.verticesZ;

                const facesA = model.indices1;
                const facesB = model.indices2;
                const facesC = model.indices3;

                const faceAlphas = model.faceAlphas;

                const modelTexCoords = computeTextureCoords(model);

                const offset = vertices.length;


                for (let f = 0; f < model.faceCount; f++) {
                    const fa = facesA[f];
                    const fb = facesB[f];
                    const fc = facesC[f];

                    let faceAlpha = (faceAlphas && faceAlphas[f] & 0xFF) || 255;

                    if (faceAlpha === 0 || faceAlpha == 0xfe) {
                        continue;
                    }

                    let hslA = model.faceColors1[f];
                    let hslB = model.faceColors2[f];
                    let hslC = model.faceColors3[f];

                    if (hslC == -1) {
                        hslC = hslB = hslA;
                    } else if (hslC == -2) {
                        continue;
                    }

                    const textureId = (model.faceTextures && model.faceTextures[f]) || -1;

                    const textureIndex = textureProvider.getTextureIndex(textureId) || -1;

                    let rgbA = HSL_RGB_MAP[hslA];
                    let rgbB = HSL_RGB_MAP[hslB];
                    let rgbC = HSL_RGB_MAP[hslC];

                    // const SCALE = 128;

                    const vxa = verticesX[fa] / SCALE;
                    const vxb = verticesX[fb] / SCALE;
                    const vxc = verticesX[fc] / SCALE;

                    const vza = verticesZ[fa] / SCALE;
                    const vzb = verticesZ[fb] / SCALE;
                    const vzc = verticesZ[fc] / SCALE;

                    if (mirrored) {
                        // reverse order for backface culling to work
                        vertices.push(
                            vxa, verticesY[fa] / SCALE, vza,
                            vxb, verticesY[fb] / SCALE, vzb,
                            vxc, verticesY[fc] / SCALE, vzc,
                        );
                    } else {
                        vertices.push(
                            vxa, verticesY[fa] / SCALE, vza,
                            vxb, verticesY[fb] / SCALE, vzb,
                            vxc, verticesY[fc] / SCALE, vzc,
                        );
                    }

                    // colors.push(
                    //     r, g, b, 1,
                    //     r, g, b, 1,
                    //     r, g, b, 1,
                    // );

                    if (textureIndex !== -1) {
                        const lightA = (hslA & 127) / 127 * 255;
                        const lightB = (hslB & 127) / 127 * 255;
                        const lightC = (hslC & 127) / 127 * 255;
                        // console.log(lightA, lightB, lightC, overlayHslNe, overlayHslNw, overlayHslSe, overlayHslSw);
                        colors.push(
                            lightA, lightA, lightA, 255,
                            lightB, lightB, lightB, 255,
                            lightC, lightC, lightC, 255,
                        );
                    } else {
                        colors.push(
                            (rgbA >> 16) & 0xFF, (rgbA >> 8) & 0xFF, rgbA & 0xFF, faceAlpha,
                            (rgbB >> 16) & 0xFF, (rgbB >> 8) & 0xFF, rgbB & 0xFF, faceAlpha,
                            (rgbC >> 16) & 0xFF, (rgbC >> 8) & 0xFF, rgbC & 0xFF, faceAlpha,
                        );
                    }

                    if (modelTexCoords) {
                        const texCoordIdx = f * 6;
                        texCoords.push(
                            modelTexCoords[texCoordIdx], modelTexCoords[texCoordIdx + 1],
                            modelTexCoords[texCoordIdx + 2], modelTexCoords[texCoordIdx + 3],
                            modelTexCoords[texCoordIdx + 4], modelTexCoords[texCoordIdx + 5],
                        );
                    } else {
                        texCoords.push(
                            0, 0,
                            0, 0,
                            0, 0,
                        );
                    }

                    textureIds.push(
                        textureIndex + 1,
                        textureIndex + 1,
                        textureIndex + 1,
                    );
                }

                const modelVertexCount = vertices.length - offset;

                modelPosOffsets.push(modelPositions.length);

                modelSpawns.positions.forEach(pos => {
                    const modelMatrix = mat4.create();
                    mat4.translate(modelMatrix, modelMatrix, [baseX + pos[0], pos[1], baseY + pos[2]])
                    matrices.push(modelMatrix);

                    modelPositions.push([pos[0], pos[1], pos[2], modelSpawns.def.contouredGround]);
                });

                drawRanges.push([offset / 3, modelVertexCount / 3, modelSpawns.positions.length]);
            }

            console.log(Array.from(objectTriangleCounts.entries()).filter(([id, [count, triangleCount]]) => triangleCount > 5000));

            console.log(Array.from(spawnTriangleCounts.values()).reduce((a, b) => a + b, 0));
            console.log(uniqueSpawns);
            console.log(uniqModels.size);
            console.log(Array.from(uniqModels.values()).map(m => m.faceCount).reduce((a, b) => a + b, 0));
            // console.log(regionModelSpawns);
            console.log(matrices.length, spawns.length);
        }
    }

    const modelPositionsTextureData = new Int32Array(modelPosOffsets.length + modelPositions.length);
    modelPosOffsets.forEach((offset, index) => {
        modelPositionsTextureData[index] = (modelPosOffsets.length + offset);
    })

    modelPositions.forEach((pos, index) => {
        if ((pos[0] * 2 - (pos[0] * 2 | 0)) != 0 || (pos[1] * 2 - (pos[1] * 2 | 0)) != 0) {
            console.log(pos);
        }
        const xNormalized = pos[0] / 64 * 255;
        const yNormalized = pos[1] / 64 * 255;
        modelPositionsTextureData[modelPosOffsets.length + index] = pos[0] * 2 << 24 | pos[1] * 2 << 16 | pos[2] << 8 | Math.min(pos[3] + 1, 1);
    });

    const perModelPosTexture = app.createTexture2D(new Uint8Array(modelPositionsTextureData.buffer), modelPositionsTextureData.length, 1,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });


    const heightMapTextureData = new Int32Array(Scene.MAX_PLANE * 72 * 72).fill(240);

    let dataIndex = 0;
    for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
        for (let y = 0; y < 72; y++) {
            for (let x = 0; x < 72; x++) {
                heightMapTextureData[dataIndex++] = -regionLoader.getHeight(baseX + x, baseY + y, plane) / 8;
            }
        }
    }

    // const heightMapTexture = app.createTextureArray(new Uint8Array(heightMapTextureData.buffer), 72, 72, Scene.MAX_PLANE,
    //     { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    const heightMapTexture = app.createTextureArray(new Uint8Array(heightMapTextureData.buffer), 72, 72, Scene.MAX_PLANE,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });


    console.log('model draws: ', modelPositions.length);
    console.log('triangles: ', vertices.length / 3);

    // addTile(-0.5, -0.5);
    // addTile(-0.5, 0);
    // addTile(-0.5, 0.5);
    // addTile(0, -0.5);
    // addTile(0, 0);
    // addTile(0, 0.5);
    // addTile(0.5, -0.5);
    // addTile(0.5, 0);
    // addTile(0.5, 0.5);

    // const matrices = new Float32Array(1 * 16);

    // for (let i = 0; i < 1; i++) {
    //     const modelMatrix = mat4.create();
    //     mat4.translate(modelMatrix, modelMatrix, [baseX, 0, baseY + i * 64]);
    //     matrices.set(modelMatrix as Float32Array, i * 16);
    // }

    console.time('convert');
    const verticesTyped = new Float32Array(vertices);
    const colorsTyped = new Uint8Array(colors);
    const texCoordsTyped = new Float32Array(texCoords);
    const textureIdsTyped = new Uint8Array(textureIds);


    const matricesTyped = new Float32Array(matrices.length * 16);
    matrices.forEach((matrix, index) => {
        matricesTyped.set(matrix, index * 16);
    })
    console.timeEnd('convert');

    console.time('upload');
    // 3 * 4 + 4 + 2 * 4 + 1
    const positionBuffer = app.createVertexBuffer(PicoGL.FLOAT, 3, verticesTyped);
    const colorBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 4, colorsTyped);
    const texCoordBuffer = app.createVertexBuffer(PicoGL.FLOAT, 2, texCoordsTyped);
    const textureIdBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 1, textureIdsTyped);

    // const modelMatrixBuffer = app.createVertexBuffer(PicoGL.FLOAT_MAT4, 1, matricesTyped);
    // const loadedTimeBuffer = app.createVertexBuffer(PicoGL.FLOAT, 1, new Float32Array(matrices.length).fill(performance.now() * 0.001));

    const vertexArray = app.createVertexArray()
        .vertexAttributeBuffer(0, positionBuffer)
        .vertexAttributeBuffer(1, colorBuffer, { normalized: true })
        .vertexAttributeBuffer(2, texCoordBuffer)
        .vertexAttributeBuffer(3, textureIdBuffer)
    // .instanceAttributeBuffer(4, modelMatrixBuffer)
    // .instanceAttributeBuffer(8, loadedTimeBuffer);

    console.timeEnd('upload');

    const drawRangesLowDetail = drawRanges.slice(0, floorDecorationDrawOffset || drawRanges.length);

    return {
        regionX, regionY, modelMatrix: baseModelMatrix, vertexArray, triangleCount: vertices.length / 3,
        drawRanges, drawRangesLowDetail, timeLoaded: performance.now(), perModelPosTexture, heightMapTexture
    } as any;
}

function loadTerrain3(app: PicoApp, chunkDataLoader: ChunkDataLoader, regionX: number, regionY: number): Terrain {
    const baseX = regionX * 64;
    const baseY = regionY * 64;

    const baseModelMatrix = mat4.create();
    mat4.translate(baseModelMatrix, baseModelMatrix, [baseX, 0, baseY]);

    const chunkData = chunkDataLoader.load(regionX, regionY);

    const positionBuffer = app.createVertexBuffer(PicoGL.FLOAT, 3, chunkData.vertices);
    const colorBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 4, chunkData.colors);
    const texCoordBuffer = app.createVertexBuffer(PicoGL.FLOAT, 2, chunkData.texCoords);
    const textureIdBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 1, chunkData.textureIds);

    const vertexArray = app.createVertexArray()
        .vertexAttributeBuffer(0, positionBuffer)
        .vertexAttributeBuffer(1, colorBuffer, { normalized: true })
        .vertexAttributeBuffer(2, texCoordBuffer)
        .vertexAttributeBuffer(3, textureIdBuffer);

    const perModelPosTexture = app.createTexture2D(new Uint8Array(chunkData.perModelTextureData.buffer), chunkData.perModelTextureData.length, 1,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    const heightMapTexture = app.createTextureArray(new Uint8Array(chunkData.heightMapTextureData.buffer), 72, 72, Scene.MAX_PLANE,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    return {
        regionX,
        regionY,
        modelMatrix: baseModelMatrix,
        vertexArray,
        triangleCount: chunkData.vertices.length / 3,
        drawRanges: chunkData.drawRanges,
        drawRangesLowDetail: chunkData.drawRanges,
        timeLoaded: performance.now(),
        perModelPosTexture,
        heightMapTexture
    } as any;
}


async function loadTerrain4(app: PicoApp, chunkLoaderWorker: Pool<ModuleThread<ChunkLoaderWorker>>, regionX: number, regionY: number): Promise<Terrain> {
    const baseX = regionX * 64;
    const baseY = regionY * 64;

    const baseModelMatrix = mat4.create();
    mat4.translate(baseModelMatrix, baseModelMatrix, [baseX, 0, baseY]);

    const chunkData = await chunkLoaderWorker.queue(worker => worker.load(regionX, regionY));

    const positionBuffer = app.createVertexBuffer(PicoGL.FLOAT, 3, chunkData.vertices);
    const colorBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 4, chunkData.colors);
    const texCoordBuffer = app.createVertexBuffer(PicoGL.FLOAT, 2, chunkData.texCoords);
    const textureIdBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 1, chunkData.textureIds);

    const vertexArray = app.createVertexArray()
        .vertexAttributeBuffer(0, positionBuffer)
        .vertexAttributeBuffer(1, colorBuffer, { normalized: true })
        .vertexAttributeBuffer(2, texCoordBuffer)
        .vertexAttributeBuffer(3, textureIdBuffer);

    

    const perModelPosTexture = app.createTexture2D(new Uint8Array(chunkData.perModelTextureData.buffer), chunkData.perModelTextureData.length, 1,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    const heightMapTexture = app.createTextureArray(new Uint8Array(chunkData.heightMapTextureData.buffer), 72, 72, Scene.MAX_PLANE,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    return {
        regionX,
        regionY,
        modelMatrix: baseModelMatrix,
        vertexArray,
        triangleCount: chunkData.vertices.length / 3,
        drawRanges: chunkData.drawRanges,
        drawRangesLowDetail: chunkData.drawRangesLowDetail,
        timeLoaded: performance.now(),
        perModelPosTexture,
        heightMapTexture
    } as any;
}

function loadTerrain5(app: PicoApp, chunkData: ChunkData, program: Program, textureArray: Texture, sceneUniformBuffer: UniformBuffer): Terrain {
    const regionX = chunkData.regionX;
    const regionY = chunkData.regionY;

    const baseX = regionX * 64;
    const baseY = regionY * 64;

    const baseModelMatrix = mat4.create();
    mat4.translate(baseModelMatrix, baseModelMatrix, [baseX, 0, baseY]);

    const positionBuffer = app.createVertexBuffer(PicoGL.FLOAT, 3, chunkData.vertices);
    const colorBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 4, chunkData.colors);
    const texCoordBuffer = app.createVertexBuffer(PicoGL.FLOAT, 2, chunkData.texCoords);
    const textureIdBuffer = app.createVertexBuffer(PicoGL.UNSIGNED_BYTE, 1, chunkData.textureIds);

    const vertexArray = app.createVertexArray()
        .vertexAttributeBuffer(0, positionBuffer)
        .vertexAttributeBuffer(1, colorBuffer, { normalized: true })
        .vertexAttributeBuffer(2, texCoordBuffer)
        .vertexAttributeBuffer(3, textureIdBuffer);

    const perModelPosTexture = app.createTexture2D(new Uint8Array(chunkData.perModelTextureData.buffer), chunkData.perModelTextureData.length, 1,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    const heightMapTexture = app.createTextureArray(new Uint8Array(chunkData.heightMapTextureData.buffer), 72, 72, Scene.MAX_PLANE,
        { internalFormat: PicoGL.RGBA8UI, minFilter: PicoGL.NEAREST, magFilter: PicoGL.NEAREST });

    const time = performance.now();

    let drawCall = app.createDrawCall(program, vertexArray)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time * 0.001)
        .uniform('u_modelMatrix', baseModelMatrix)
        .texture('u_textures', textureArray)
        .texture('u_perModelPosTexture', perModelPosTexture)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRanges);

    let drawCallLowDetail = app.createDrawCall(program, vertexArray)
        .uniformBlock('SceneUniforms', sceneUniformBuffer)
        .uniform('u_timeLoaded', time * 0.001)
        .uniform('u_modelMatrix', baseModelMatrix)
        .texture('u_textures', textureArray)
        .texture('u_perModelPosTexture', perModelPosTexture)
        .texture('u_heightMap', heightMapTexture)
        .drawRanges(...chunkData.drawRangesLowDetail);

    return {
        regionX,
        regionY,
        modelMatrix: baseModelMatrix,
        vertexArray,
        triangleCount: chunkData.vertices.length / 3,
        drawRanges: chunkData.drawRanges,
        drawRangesLowDetail: chunkData.drawRangesLowDetail,
        timeLoaded: time,
        perModelPosTexture,
        heightMapTexture,
        drawCall,
        drawCallLowDetail
    };
}

class Test {
    fileSystem: MemoryFileSystem;

    chunkLoaderWorker: Pool<ModuleThread<ChunkLoaderWorker>>;

    modelIndex: IndexSync<StoreSync>;

    regionLoader: RegionLoader;

    textureProvider: TextureLoader;

    chunkDataLoader: ChunkDataLoader;

    app!: PicoApp;

    keys: Map<string, boolean> = new Map();

    timer!: Timer;

    program!: Program;
    program2!: Program;

    sceneUniformBuffer!: UniformBuffer;

    textureArray!: Texture;

    terrains: Map<number, Terrain> = new Map();

    pitch: number = 244;
    yaw: number = 749;

    cameraPos: vec3 = vec3.fromValues(-60.5 - 3200, 20, -60.5 - 3200);
    // cameraPos: vec3 = vec3.fromValues(-3200, 10, -3200);
    // cameraPos: vec3 = vec3.fromValues(-2270, 10, -5342);

    projectionMatrix: mat4 = mat4.create();
    viewMatrix: mat4 = mat4.create();
    viewProjMatrix: mat4 = mat4.create();

    loadingRegionIds: Set<number> = new Set();

    chunksToLoad: ChunkData[] = [];

    constructor(fileSystem: MemoryFileSystem, xteasMap: Map<number, number[]>, chunkLoaderWorker: Pool<ModuleThread<ChunkLoaderWorker>>) {
        this.fileSystem = fileSystem;
        this.chunkLoaderWorker = chunkLoaderWorker;

        const configIndex = this.fileSystem.getIndex(IndexType.CONFIGS);
        const mapIndex = this.fileSystem.getIndex(IndexType.MAPS);
        const spriteIndex = this.fileSystem.getIndex(IndexType.SPRITES);
        const textureIndex = this.fileSystem.getIndex(IndexType.TEXTURES);
        this.modelIndex = this.fileSystem.getIndex(IndexType.MODELS);

        const underlayArchive = configIndex.getArchive(ConfigType.UNDERLAY);
        const overlayArchive = configIndex.getArchive(ConfigType.OVERLAY);
        const objectArchive = configIndex.getArchive(ConfigType.OBJECT);

        const underlayLoader = new CachedUnderlayLoader(underlayArchive);
        const overlayLoader = new CachedOverlayLoader(overlayArchive);
        const objectLoader = new CachedObjectLoader(objectArchive);

        this.regionLoader = new RegionLoader(mapIndex, underlayLoader, overlayLoader, objectLoader, xteasMap);

        this.textureProvider = TextureLoader.load(textureIndex, spriteIndex);

        this.chunkDataLoader = new ChunkDataLoader(this.regionLoader, this.modelIndex, this.textureProvider);


        this.init = this.init.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.render = this.render.bind(this);
    }

    init(gl: WebGL2RenderingContext) {
        gl.canvas.addEventListener('keydown', this.onKeyDown);
        gl.canvas.addEventListener('keyup', this.onKeyUp);
        gl.canvas.focus();

        const app = this.app = PicoGL.createApp(gl as any);

        // hack to get the right multi draw extension for picogl
        if (!PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED) {
            const state: any = app.state;
            const ext = gl.getExtension('WEBGL_multi_draw');
            PicoGL.WEBGL_INFO.MULTI_DRAW_INSTANCED = ext;
            state.extensions.multiDrawInstanced = ext;
        }

        console.log(PicoGL.WEBGL_INFO);

        console.log(gl.getParameter(gl.MAX_SAMPLES));

        app.enable(gl.CULL_FACE);
        app.enable(gl.DEPTH_TEST);
        app.depthFunc(gl.LEQUAL);
        app.enable(gl.BLEND);
        app.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        app.clearColor(0, 0, 0, 1);

        // console.log(gl.getParameter(gl.DEPTH_FUNC), gl.NEVER, gl.GREATER, gl.LESS);

        this.timer = app.createTimer();

        this.program = app.createProgram(vertexShader, fragmentShader);
        this.program2 = app.createProgram(vertexShader2, fragmentShader2);

        this.sceneUniformBuffer = app.createUniformBuffer([PicoGL.FLOAT_MAT4]);

        // const textures = textureProvider.getDefinitions();

        const textureArrayImage = this.textureProvider.createTextureArrayImage(0.9, TEXTURE_SIZE);

        this.textureArray = app.createTextureArray(new Uint8Array(textureArrayImage.buffer), TEXTURE_SIZE, TEXTURE_SIZE, this.textureProvider.getTextureCount(),
            { maxAnisotropy: PicoGL.WEBGL_INFO.MAX_TEXTURE_ANISOTROPY });

        const radius = 1;

        console.time('build');
        for (let x = 0; x < radius; x++) {
            for (let y = 0; y < radius; y++) {
                // const terrain = loadTerrain2(app, this.regionLoader, this.textureProvider, 50 + x, 50 + y, this.modelIndex);
                // const terrain = loadTerrain3(app, this.chunkDataLoader, 50 + x, 50 + y);
                // this.terrains.push(terrain);
            }
        }
        console.timeEnd('build');

        // const totalTriangles = this.terrains.map(t => t.triangleCount).reduce((a, b) => a + b, 0);
        // console.log('triangles', totalTriangles);


        console.timeEnd('first load');

        console.log(this.program);

        console.log(gl.getSupportedExtensions());

        // const program = createProgramFromSources(gl, [vertexShader, fragmentShader]);
        // console.log(program);
        // const settingsBlock = UniformBlock.create(gl, program, "Settings", 0, ["u_projViewMatrix"]);

        // gl.enable(gl.DEPTH_TEST);

        // gl.clearColor(0, 0, 0, 1);
    }

    onKeyDown(event: KeyboardEvent) {
        console.log(event.key);
        this.keys.set(event.key, true);
        event.preventDefault();
    }

    onKeyUp(event: KeyboardEvent) {
        this.keys.set(event.key, false);
        event.preventDefault();
    }

    private setProjection(offsetX: number, offsetY: number, width: number, height: number, centerX: number, centerY: number, zoom: number): mat4 {
        const left = (offsetX - centerX << 9) / zoom;
        const right = (offsetX + width - centerX << 9) / zoom;
        const top = (offsetY - centerY << 9) / zoom;
        const bottom = (offsetY + height - centerY << 9) / zoom;

        mat4.identity(this.projectionMatrix);
        mat4.frustum(this.projectionMatrix, left * DEFAULT_ZOOM, right * DEFAULT_ZOOM,
            -bottom * DEFAULT_ZOOM, -top * DEFAULT_ZOOM, 0, 500);
        mat4.rotateX(this.projectionMatrix, this.projectionMatrix, Math.PI);
        return this.projectionMatrix;
    }

    isPositionVisible(pos: vec3): boolean {
        vec3.transformMat4(pos, pos, this.viewProjMatrix);
        return pos[0] >= -1.0 && pos[0] <= 1.0
            && pos[1] >= -1.0 && pos[1] <= 1.0
            && pos[2] >= -1.0 && pos[2] <= 1.0;
    }

    isVisible(regionPos: vec2): boolean {
        const baseX = regionPos[0] * Scene.MAP_SIZE;
        const baseY = regionPos[1] * Scene.MAP_SIZE;
        for (let x = 0; x <= 8; x++) {
            for (let y = 0; y <= 8; y++) {
                if (this.isPositionVisible([baseX + x * 8, 0, baseY + y * 8])) {
                    return true;
                }
            }
        }
        return false;
    }

    render(gl: WebGL2RenderingContext, time: DOMHighResTimeStamp, resized: boolean) {
        const canvasWidth = gl.canvas.width;
        const canvasHeight = gl.canvas.height;

        if (this.keys.get('ArrowUp')) {
            this.pitch = clamp(this.pitch + 1, 0, 512);
        }
        if (this.keys.get('ArrowDown')) {
            this.pitch = clamp(this.pitch - 1, 0, 512);
        }
        if (this.keys.get('ArrowRight')) {
            this.yaw = this.yaw + 2 % 2048;
        }
        if (this.keys.get('ArrowLeft')) {
            this.yaw = this.yaw - 2;
            if (this.yaw < 0) {
                this.yaw = 2048 - this.yaw;
            }
            // console.log(this.pitch, this.yaw);
        }

        if (this.keys.get('w')) {
            const delta = vec3.fromValues(-0.5 * 3, 0, 0);
            // vec3.transformMat4(delta, delta, deltaMatrix);
            vec3.rotateY(delta, delta, [0, 0, 0], (512 * 3 - this.yaw) * RS_TO_RADIANS);

            // console.log(delta);

            // vec3.transformMat4(this.cameraPos, this.cameraPos, deltaMatrix);
            vec3.add(this.cameraPos, this.cameraPos, delta);
        }

        if (this.keys.get('t') && this.timer.ready()) {
            const totalTriangles = Array.from(this.terrains.values()).map(t => t.triangleCount).reduce((a, b) => a + b, 0);


            console.log(this.timer.cpuTime, this.timer.gpuTime, this.terrains.size, 'triangles', totalTriangles);
            console.log(time);
        }

        if (resized) {
            this.app.resize(canvasWidth, canvasHeight);

        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


        // this.setProjection(0, 0, canvasWidth, canvasHeight, canvasWidth / 2, canvasHeight / 2, 1);
        mat4.identity(this.projectionMatrix);
        mat4.perspective(this.projectionMatrix, Math.PI / 2, canvasWidth / canvasHeight, 0.1, 1024.0 * 3);
        mat4.rotateX(this.projectionMatrix, this.projectionMatrix, Math.PI);

        mat4.identity(this.viewMatrix);
        // mat4.lookAt(this.viewMatrix, vec3.fromValues(1, 1, 0), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        if (this.pitch !== 0) {
            mat4.rotateX(this.viewMatrix, this.viewMatrix, this.pitch * RS_TO_RADIANS);
        }
        if (this.yaw !== 0) {
            mat4.rotateY(this.viewMatrix, this.viewMatrix, this.yaw * RS_TO_RADIANS);
        }
        mat4.translate(this.viewMatrix, this.viewMatrix, this.cameraPos);
        // mat4.translate(this.viewMatrix, this.viewMatrix, vec3.fromValues(-50.5, 10, -20.5));
        // mat4.translate(this.viewMatrix, this.viewMatrix, vec3.fromValues(Math.random() * 256 - 128, Math.random() * 256 - 128, Math.random() * 256 - 128));

        mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);

        this.sceneUniformBuffer
            .set(0, this.viewProjMatrix as Float32Array)
            .update();

        const cameraRegionX = -this.cameraPos[0] / 64 | 0;
        const cameraRegionY = -this.cameraPos[2] / 64 | 0;

        if (this.keys.get('c')) {
            // this.isVisible(this.terrains[0]);
        }


        this.timer.start();

        this.terrains.forEach(terrain => {
            if (!this.isVisible([terrain.regionX, terrain.regionY])) {
                return;
            }
            const regionDist = Math.max(Math.abs(cameraRegionX - terrain.regionX), Math.abs(cameraRegionY - terrain.regionY));

            const drawCall = regionDist >= 3 ? terrain.drawCallLowDetail : terrain.drawCall;

            drawCall.uniform('u_currentTime', time * 0.001);
            // debugger;

            // console.log(terrain.drawRanges);

            // console.log(drawCall);

            // console.log((drawCall.numElements as any)[0], (drawCall.numInstances as any)[0], (drawCall as any).offsets[0], (drawCall as any).numDraws)

            drawCall.draw();
        });

        getSpiralDeltas(1)
            .map(delta => [cameraRegionX + delta[0], cameraRegionY + delta[1]] as vec2)
            .filter(regionPos => !this.loadingRegionIds.has(this.regionLoader.getRegionId(regionPos[0], regionPos[1])))
            .filter(regionPos => !this.terrains.has(this.regionLoader.getRegionId(regionPos[0], regionPos[1])))
            .filter(regionPos => this.isVisible(regionPos))
            .forEach((regionPos, index) => {
                if (index == 0 || 1) {
                    // console.time('load terrain');
                    // this.terrains.push(loadTerrain2(this.app, this.regionLoader, this.textureProvider, regionPos[0], regionPos[1], this.modelIndex));
                    // this.terrains.push(loadTerrain3(this.app, this.chunkDataLoader, regionPos[0], regionPos[1]));
                    this.loadingRegionIds.add(this.regionLoader.getRegionId(regionPos[0], regionPos[1]));

                    this.chunkLoaderWorker.queue(worker => worker.load(regionPos[0], regionPos[1])).then(chunkData => {
                        this.chunksToLoad.push(chunkData);
                    })
                    // loadTerrain4(this.app, this.chunkLoaderWorker, regionPos[0], regionPos[1]).then(terrain => {
                    //     this.terrains.push(terrain);
                    //     this.loadingRegionIds.delete(this.regionLoader.getRegionId(terrain.regionX, terrain.regionY));
                    // });
                    // console.timeEnd('load terrain');
                }
            });

        if (this.chunksToLoad.length) {
            const chunkData = this.chunksToLoad[0];
            this.terrains.set(this.regionLoader.getRegionId(chunkData.regionX, chunkData.regionY),
                loadTerrain5(this.app, chunkData, this.program2, this.textureArray, this.sceneUniformBuffer));
            this.chunksToLoad = this.chunksToLoad.slice(1);
        }

        this.timer.end();
    }
}

type ChunkLoaderWorker = {
    init(memoryStore: TransferDescriptor<MemoryStore>, xteasMap: Map<number, number[]>): void,

    load(regionX: number, regionY: number): ChunkData,
};

function App() {
    const [test, setTest] = useState<Test | undefined>(undefined);


    // const test = new Test();

    useEffect(() => {
        console.time('first load');
        const load = async () => {
            const fileSystem = await openFromUrl('/cache209/', [IndexType.CONFIGS, IndexType.MAPS, IndexType.MODELS, IndexType.SPRITES, IndexType.TEXTURES], true);

            const xteas: any[] = await fetch('/cache209/keys.json').then(resp => resp.json());
            const xteasMap: Map<number, number[]> = new Map();
            xteas.forEach(xtea => xteasMap.set(xtea.group, xtea.key));

            // const chunkLoaderWorker = await spawn<ChunkLoaderWorker>(new Worker(new URL("./worker", import.meta.url) as any));
            // chunkLoaderWorker.init(Transfer(fileSystem.store, []), xteasMap);

            // console.log(chunkLoaderWorker);

            // const poolSize = 1;
            // const poolSize = navigator.hardwareConcurrency;
            const poolSize = Math.min(navigator.hardwareConcurrency, 4);

            const pool = Pool(() => {
                return spawn<ChunkLoaderWorker>(new Worker(new URL("./worker", import.meta.url) as any)).then(worker => {
                    worker.init(Transfer(fileSystem.store, []), xteasMap);
                    return worker;
                });
            }, poolSize);

            // await pool.completed();

            setTest(new Test(fileSystem, xteasMap, pool));
        };

        load().catch(console.error);
    }, []);

    return (
        <div className="App">
            {test && <WebGLCanvas init={test.init} draw={test.render}></WebGLCanvas>}
        </div>
    );
}

export default App;
