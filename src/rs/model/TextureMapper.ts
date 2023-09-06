import { TextureLoader } from "../texture/TextureLoader";
import { ModelData } from "./ModelData";

const uvTemp = new Float32Array(2);

export function computeTextureCoords(
    textureLoader: TextureLoader,
    model: ModelData,
): Float32Array | undefined {
    const faceTextures = model.faceTextures;

    if (!faceTextures) {
        return undefined;
    }

    const verticesX = model.verticesX;
    const verticesY = model.verticesY;
    const verticesZ = model.verticesZ;

    const indices0 = model.indices1;
    const indices1 = model.indices2;
    const indices2 = model.indices3;

    const textureMappingP = model.textureMappingP;
    const textureMappingM = model.textureMappingM;
    const textureMappingN = model.textureMappingN;

    const faceCount = model.faceCount;
    const uvs = new Float32Array(faceCount * 6);

    const textureScales = calculateTextureScales(model);

    for (let i = 0; i < faceCount; i++) {
        let texCoord: number;
        if (model.textureCoords) {
            texCoord = model.textureCoords[i];
        } else {
            texCoord = -1;
        }
        let textureId = faceTextures[i];
        if (textureId !== -1 && !textureLoader.isSd(textureId)) {
            textureId = -1;
        }

        let u0 = 0;
        let v0 = 0;
        let u1 = 0;
        let v1 = 0;
        let u2 = 0;
        let v2 = 0;

        if (textureId !== -1) {
            let type = 0;
            if (texCoord !== -1) {
                texCoord &= 0xff;
                type = model.textureRenderTypes[texCoord];
            }

            const index0 = indices0[i];
            const index1 = indices1[i];
            const index2 = indices2[i];
            if (type === 0) {
                let p = index0;
                let m = index1;
                let n = index2;
                if (texCoord !== -1) {
                    p = textureMappingP[texCoord];
                    m = textureMappingM[texCoord];
                    n = textureMappingN[texCoord];
                }

                const vx = verticesX[p];
                const vy = verticesY[p];
                const vz = verticesZ[p];

                const f_882_ = verticesX[m] - vx;
                const f_883_ = verticesY[m] - vy;
                const f_884_ = verticesZ[m] - vz;
                const f_885_ = verticesX[n] - vx;
                const f_886_ = verticesY[n] - vy;
                const f_887_ = verticesZ[n] - vz;
                const f_888_ = verticesX[index0] - vx;
                const f_889_ = verticesY[index0] - vy;
                const f_890_ = verticesZ[index0] - vz;
                const f_891_ = verticesX[index1] - vx;
                const f_892_ = verticesY[index1] - vy;
                const f_893_ = verticesZ[index1] - vz;
                const f_894_ = verticesX[index2] - vx;
                const f_895_ = verticesY[index2] - vy;
                const f_896_ = verticesZ[index2] - vz;

                const f_897_ = f_883_ * f_887_ - f_884_ * f_886_;
                const f_898_ = f_884_ * f_885_ - f_882_ * f_887_;
                const f_899_ = f_882_ * f_886_ - f_883_ * f_885_;
                let f_900_ = f_886_ * f_899_ - f_887_ * f_898_;
                let f_901_ = f_887_ * f_897_ - f_885_ * f_899_;
                let f_902_ = f_885_ * f_898_ - f_886_ * f_897_;
                let f_903_ = 1.0 / (f_900_ * f_882_ + f_901_ * f_883_ + f_902_ * f_884_);

                u0 = (f_900_ * f_888_ + f_901_ * f_889_ + f_902_ * f_890_) * f_903_;
                u1 = (f_900_ * f_891_ + f_901_ * f_892_ + f_902_ * f_893_) * f_903_;
                u2 = (f_900_ * f_894_ + f_901_ * f_895_ + f_902_ * f_896_) * f_903_;

                f_900_ = f_883_ * f_899_ - f_884_ * f_898_;
                f_901_ = f_884_ * f_897_ - f_882_ * f_899_;
                f_902_ = f_882_ * f_898_ - f_883_ * f_897_;
                f_903_ = 1.0 / (f_900_ * f_885_ + f_901_ * f_886_ + f_902_ * f_887_);

                v0 = (f_900_ * f_888_ + f_901_ * f_889_ + f_902_ * f_890_) * f_903_;
                v1 = (f_900_ * f_891_ + f_901_ * f_892_ + f_902_ * f_893_) * f_903_;
                v2 = (f_900_ * f_894_ + f_901_ * f_895_ + f_902_ * f_896_) * f_903_;

                if (u1 - u0 > 0.99 && u1 - u0 < 1.1) {
                    u1 = 1.0;
                }
                if (u2 - u1 > 0.99 && u2 - u1 < 1.1) {
                    u2 = 1.0;
                }
                if (u0 - u2 > 0.99 && u0 - u2 < 1.1) {
                    u0 = 1.0;
                }
                if (u0 - u1 > 0.99 && u0 - u1 < 1.1) {
                    u0 = 1.0;
                }
                if (u1 - u2 > 0.99 && u1 - u2 < 1.1) {
                    u1 = 1.0;
                }
                if (u2 - u0 > 0.99 && u2 - u0 < 1.1) {
                    u2 = 1.0;
                }
            } else if (
                textureScales.centerXs &&
                textureScales.centerYs &&
                textureScales.centerZs &&
                textureScales.fs
            ) {
                const centerX = textureScales.centerXs[texCoord];
                const centerY = textureScales.centerYs[texCoord];
                const centerZ = textureScales.centerZs[texCoord];
                const scales = textureScales.fs[texCoord];
                const direction = model.textureDirection[texCoord];
                const speed = model.textureSpeed[texCoord] / 256.0;
                if (type === 1) {
                    const scaleZ = model.textureScaleZ[texCoord] / 1024.0;
                    method2431(
                        model.verticesX[index0],
                        model.verticesY[index0],
                        model.verticesZ[index0],
                        centerX,
                        centerY,
                        centerZ,
                        scales,
                        scaleZ,
                        direction,
                        speed,
                        uvTemp,
                    );
                    u0 = uvTemp[0];
                    v0 = uvTemp[1];
                    method2431(
                        model.verticesX[index1],
                        model.verticesY[index1],
                        model.verticesZ[index1],
                        centerX,
                        centerY,
                        centerZ,
                        scales,
                        scaleZ,
                        direction,
                        speed,
                        uvTemp,
                    );
                    u1 = uvTemp[0];
                    v1 = uvTemp[1];
                    method2431(
                        model.verticesX[index2],
                        model.verticesY[index2],
                        model.verticesZ[index2],
                        centerX,
                        centerY,
                        centerZ,
                        scales,
                        scaleZ,
                        direction,
                        speed,
                        uvTemp,
                    );
                    u2 = uvTemp[0];
                    v2 = uvTemp[1];
                    const scaleZHalf = scaleZ / 2.0;
                    if ((direction & 0x1) === 0) {
                        if (u1 - u0 > scaleZHalf) {
                            u1 -= scaleZ;
                            // i_769_ = 1;
                        } else if (u0 - u1 > scaleZHalf) {
                            u1 += scaleZ;
                            // i_769_ = 2;
                        }
                        if (u2 - u0 > scaleZHalf) {
                            u2 -= scaleZ;
                            // i_770_ = 1;
                        } else if (u0 - u2 > scaleZHalf) {
                            u2 += scaleZ;
                            // i_770_ = 2;
                        }
                    } else {
                        if (v1 - v0 > scaleZHalf) {
                            v1 -= scaleZ;
                            // i_769_ = 1;
                        } else if (v0 - v1 > scaleZHalf) {
                            v1 += scaleZ;
                            // i_769_ = 2;
                        }
                        if (v2 - v0 > scaleZHalf) {
                            v2 -= scaleZ;
                            // i_770_ = 1;
                        } else if (v0 - v2 > scaleZHalf) {
                            v2 += scaleZ;
                            // i_770_ = 2;
                        }
                    }
                } else if (type === 2) {
                    const uOffset = model.textureTransU[texCoord] / 256.0;
                    const vOffset = model.textureTransV[texCoord] / 256.0;

                    const dx1 = model.verticesX[index1] - model.verticesX[index0];
                    const dy1 = model.verticesY[index1] - model.verticesY[index0];
                    const dz1 = model.verticesZ[index1] - model.verticesZ[index0];
                    const dx2 = model.verticesX[index2] - model.verticesX[index0];
                    const dy2 = model.verticesY[index2] - model.verticesY[index0];
                    const dz2 = model.verticesZ[index2] - model.verticesZ[index0];
                    const vx = dy1 * dz2 - dy2 * dz1;
                    const vy = dz1 * dx2 - dz2 * dx1;
                    const vz = dx1 * dy2 - dx2 * dy1;
                    const scaleX = 64.0 / model.textureScaleX[texCoord];
                    const scaleY = 64.0 / model.textureScaleY[texCoord];
                    const scaleZ = 64.0 / model.textureScaleZ[texCoord];
                    const f_829_ = (vx * scales[0] + vy * scales[1] + vz * scales[2]) / scaleX;
                    const f_830_ = (vx * scales[3] + vy * scales[4] + vz * scales[5]) / scaleY;
                    const f_831_ = (vx * scales[6] + vy * scales[7] + vz * scales[8]) / scaleZ;

                    const scaleType = method2437(f_829_, f_830_, f_831_);

                    method2416(
                        model.verticesX[index0],
                        model.verticesY[index0],
                        model.verticesZ[index0],
                        centerX,
                        centerY,
                        centerZ,
                        scaleType,
                        scales,
                        direction,
                        speed,
                        uOffset,
                        vOffset,
                        uvTemp,
                    );
                    u0 = uvTemp[0];
                    v0 = uvTemp[1];
                    method2416(
                        model.verticesX[index1],
                        model.verticesY[index1],
                        model.verticesZ[index1],
                        centerX,
                        centerY,
                        centerZ,
                        scaleType,
                        scales,
                        direction,
                        speed,
                        uOffset,
                        vOffset,
                        uvTemp,
                    );
                    u1 = uvTemp[0];
                    v1 = uvTemp[1];
                    method2416(
                        model.verticesX[index2],
                        model.verticesY[index2],
                        model.verticesZ[index2],
                        centerX,
                        centerY,
                        centerZ,
                        scaleType,
                        scales,
                        direction,
                        speed,
                        uOffset,
                        vOffset,
                        uvTemp,
                    );
                    u2 = uvTemp[0];
                    v2 = uvTemp[1];
                } else if (type === 3) {
                    method2434(
                        model.verticesX[index0],
                        model.verticesY[index0],
                        model.verticesZ[index0],
                        centerX,
                        centerY,
                        centerZ,
                        scales,
                        direction,
                        speed,
                        uvTemp,
                    );
                    u0 = uvTemp[0];
                    v0 = uvTemp[1];
                    method2434(
                        model.verticesX[index1],
                        model.verticesY[index1],
                        model.verticesZ[index1],
                        centerX,
                        centerY,
                        centerZ,
                        scales,
                        direction,
                        speed,
                        uvTemp,
                    );
                    u1 = uvTemp[0];
                    v1 = uvTemp[1];
                    method2434(
                        model.verticesX[index2],
                        model.verticesY[index2],
                        model.verticesZ[index2],
                        centerX,
                        centerY,
                        centerZ,
                        scales,
                        direction,
                        speed,
                        uvTemp,
                    );
                    u2 = uvTemp[0];
                    v2 = uvTemp[1];

                    if ((direction & 0x1) == 0) {
                        if (u1 - u0 > 0.5) {
                            u1--;
                            // i_769_ = 1;
                        } else if (u0 - u1 > 0) {
                            u1++;
                            // i_769_ = 2;
                        }
                        if (u2 - u0 > 0.5) {
                            u2--;
                            // i_770_ = 1;
                        } else if (u0 - u2 > 0.5) {
                            u2++;
                            // i_770_ = 2;
                        }
                    } else {
                        if (v1 - v0 > 0.5) {
                            v1--;
                            // i_769_ = 1;
                        } else if (v0 - v1 > 0.5) {
                            v1++;
                            // i_769_ = 2;
                        }
                        if (v2 - v0 > 0.5) {
                            v2--;
                            // i_770_ = 1;
                        } else if (v0 - v2 > 0.5) {
                            v2++;
                            // i_770_ = 2;
                        }
                    }
                }
            }

            // if (texCoord === -1) {
            //     u0 = 0.0;
            //     v0 = 1.0;
            //     u1 = 1.0;
            //     v1 = 1.0;
            //     u2 = 0.0;
            //     v2 = 0.0;
            // } else {
            //     texCoord &= 0xff;
            //     const type = model.textureRenderTypes[texCoord];
            // }
        }

        const uvIndex = i * 6;
        uvs[uvIndex] = u0;
        uvs[uvIndex + 1] = v0;
        uvs[uvIndex + 2] = u1;
        uvs[uvIndex + 3] = v1;
        uvs[uvIndex + 4] = u2;
        uvs[uvIndex + 5] = v2;
    }

    return uvs;
}

function method2431(
    vx: number,
    vy: number,
    vz: number,
    centerX: number,
    centerY: number,
    centerZ: number,
    scales: Float32Array,
    scaleZ: number,
    direction: number,
    speed: number,
    out: Float32Array,
): void {
    vx -= centerX;
    vy -= centerY;
    vz -= centerZ;
    const f_651_ = vx * scales[0] + vy * scales[1] + vz * scales[2];
    const f_652_ = vx * scales[3] + vy * scales[4] + vz * scales[5];
    const f_653_ = vx * scales[6] + vy * scales[7] + vz * scales[8];
    let u = Math.atan2(f_651_, f_653_) / 6.2831855 + 0.5;
    if (scaleZ !== 1.0) {
        u *= scaleZ;
    }
    let v = f_652_ + 0.5 + speed;
    if (direction === 1) {
        const f_656_ = u;
        u = -v;
        v = f_656_;
    } else if (direction === 2) {
        u = -u;
        v = -v;
    } else if (direction === 3) {
        const f_657_ = u;
        u = v;
        v = -f_657_;
    }
    out[0] = u;
    out[1] = v;
}

function method2437(f: number, f_715_: number, f_716_: number): number {
    const f_717_ = f < 0.0 ? -f : f;
    const f_718_ = f_715_ < 0.0 ? -f_715_ : f_715_;
    const f_719_ = f_716_ < 0.0 ? -f_716_ : f_716_;
    if (f_718_ > f_717_ && f_718_ > f_719_) {
        if (f_715_ > 0.0) {
            return 0;
        }
        return 1;
    }
    if (f_719_ > f_717_ && f_719_ > f_718_) {
        if (f_716_ > 0.0) {
            return 2;
        }
        return 3;
    }
    if (f > 0.0) {
        return 4;
    }
    return 5;
}

function method2416(
    vx: number,
    vy: number,
    vz: number,
    centerX: number,
    centerY: number,
    centerZ: number,
    scaleType: number,
    scales: Float32Array,
    direction: number,
    speed: number,
    uOffset: number,
    vOffset: number,
    out: Float32Array,
): void {
    vx -= centerX;
    vy -= centerY;
    vz -= centerZ;
    const f_223_ = vx * scales[0] + vy * scales[1] + vz * scales[2];
    const f_224_ = vx * scales[3] + vy * scales[4] + vz * scales[5];
    const f_225_ = vx * scales[6] + vy * scales[7] + vz * scales[8];
    let u: number;
    let v: number;
    if (scaleType === 0) {
        u = f_223_ + speed + 0.5;
        v = -f_225_ + vOffset + 0.5;
    } else if (scaleType === 1) {
        u = f_223_ + speed + 0.5;
        v = f_225_ + vOffset + 0.5;
    } else if (scaleType === 2) {
        u = -f_223_ + speed + 0.5;
        v = -f_224_ + uOffset + 0.5;
    } else if (scaleType === 3) {
        u = f_223_ + speed + 0.5;
        v = -f_224_ + uOffset + 0.5;
    } else if (scaleType === 4) {
        u = f_225_ + vOffset + 0.5;
        v = -f_224_ + uOffset + 0.5;
    } else {
        u = -f_225_ + vOffset + 0.5;
        v = -f_224_ + uOffset + 0.5;
    }
    if (direction === 1) {
        const f_228_ = u;
        u = -v;
        v = f_228_;
    } else if (direction === 2) {
        u = -u;
        v = -v;
    } else if (direction === 3) {
        const f_229_ = u;
        u = v;
        v = -f_229_;
    }
    out[0] = u;
    out[1] = v;
}

function method2434(
    vx: number,
    vy: number,
    vz: number,
    centerX: number,
    centerY: number,
    centerZ: number,
    scales: Float32Array,
    direction: number,
    speed: number,
    out: Float32Array,
): void {
    vx -= centerX;
    vy -= centerY;
    vz -= centerZ;
    const f_682_ = vx * scales[0] + vy * scales[1] + vz * scales[2];
    const f_683_ = vx * scales[3] + vy * scales[4] + vz * scales[5];
    const f_684_ = vx * scales[6] + vy * scales[7] + vz * scales[8];
    const f_685_ = Math.sqrt(f_682_ * f_682_ + f_683_ * f_683_ + f_684_ * f_684_);
    let u = Math.atan2(f_682_, f_684_) / 6.2831855 + 0.5;
    let v = Math.asin(f_683_ / f_685_) / 3.1415927 + 0.5 + speed;
    if (direction === 1) {
        const f_688_ = u;
        u = -v;
        v = f_688_;
    } else if (direction === 2) {
        u = -u;
        v = -v;
    } else if (direction === 3) {
        const f_689_ = u;
        u = v;
        v = -f_689_;
    }
    out[0] = u;
    out[1] = v;
}

class TextureScales {
    constructor(
        readonly centerXs: Int32Array | undefined,
        readonly centerYs: Int32Array | undefined,
        readonly centerZs: Int32Array | undefined,
        // 3x3 rotation matrix maybe
        readonly fs: Float32Array[] | undefined,
    ) {}
}

export function calculateTextureScales(model: ModelData): TextureScales {
    let centerXs: Int32Array | undefined;
    let centerYs: Int32Array | undefined;
    let centerZs: Int32Array | undefined;
    let fs: Float32Array[] | undefined;
    if (model.textureCoords) {
        const textureFaceCount = model.textureFaceCount;
        const minX = new Int32Array(textureFaceCount);
        const maxX = new Int32Array(textureFaceCount);
        const minY = new Int32Array(textureFaceCount);
        const maxY = new Int32Array(textureFaceCount);
        const minZ = new Int32Array(textureFaceCount);
        const maxZ = new Int32Array(textureFaceCount);
        for (let i = 0; i < textureFaceCount; i++) {
            minX[i] = 2147483647;
            maxX[i] = -2147483647;
            minY[i] = 2147483647;
            maxY[i] = -2147483647;
            minZ[i] = 2147483647;
            maxZ[i] = -2147483647;
        }
        fs = new Array(textureFaceCount);
        for (let i = 0; i < model.faceCount; i++) {
            if (model.textureCoords[i] === -1) {
                continue;
            }
            const texCoord = model.textureCoords[i] & 0xff;
            for (let v = 0; v < 3; v++) {
                let vertexIndex: number;
                if (v === 0) {
                    vertexIndex = model.indices1[i];
                } else if (v === 1) {
                    vertexIndex = model.indices2[i];
                } else {
                    vertexIndex = model.indices3[i];
                }
                const vx = model.verticesX[vertexIndex];
                const vy = model.verticesY[vertexIndex];
                const vz = model.verticesZ[vertexIndex];

                if (minX[texCoord] > vx) {
                    minX[texCoord] = vx;
                }
                if (vx > maxX[texCoord]) {
                    maxX[texCoord] = vx;
                }
                if (minY[texCoord] > vy) {
                    minY[texCoord] = vy;
                }
                if (maxY[texCoord] < vy) {
                    maxY[texCoord] = vy;
                }
                if (minZ[texCoord] > vz) {
                    minZ[texCoord] = vz;
                }
                if (maxZ[texCoord] < vz) {
                    maxZ[texCoord] = vz;
                }
            }
        }
        centerXs = new Int32Array(textureFaceCount);
        centerYs = new Int32Array(textureFaceCount);
        centerZs = new Int32Array(textureFaceCount);
        for (let i = 0; i < textureFaceCount; i++) {
            const type = model.textureRenderTypes[i];
            if (type > 0) {
                centerXs[i] = (minX[i] + maxX[i]) / 2;
                centerYs[i] = (minY[i] + maxY[i]) / 2;
                centerZs[i] = (minZ[i] + maxZ[i]) / 2;
                let scaleX: number;
                let scaleY: number;
                let scaleZ: number;
                if (type === 1) {
                    const scaleX0 = model.textureScaleX[i];
                    scaleY = 64.0 / model.textureScaleY[i];
                    if (scaleX0 === 0) {
                        scaleZ = 1.0;
                        scaleX = 1.0;
                    } else if (scaleX0 <= 0) {
                        scaleZ = 1.0;
                        scaleX = -scaleX0 / 1024.0;
                    } else {
                        scaleX = 1.0;
                        scaleZ = scaleX0 / 1024.0;
                    }
                } else if (type === 2) {
                    scaleX = 64.0 / model.textureScaleX[i];
                    scaleY = 64.0 / model.textureScaleY[i];
                    scaleZ = 64.0 / model.textureScaleZ[i];
                } else {
                    scaleX = model.textureScaleX[i] / 1024.0;
                    scaleY = model.textureScaleY[i] / 1024.0;
                    scaleZ = model.textureScaleZ[i] / 1024.0;
                }
                fs[i] = method2424(
                    model.textureMappingP[i],
                    model.textureMappingM[i],
                    model.textureMappingN[i],
                    model.textureRotation[i] & 0xff,
                    scaleX,
                    scaleY,
                    scaleZ,
                );
            }
        }
    }
    return new TextureScales(centerXs, centerYs, centerZs, fs);
}

function method2424(
    p: number,
    m: number,
    n: number,
    rotation: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
): Float32Array {
    const fs = new Float32Array(9);
    let f_552_ = 1.0;
    let f_553_ = 0.0;
    let f_554_ = m / 32767.0;
    let f_555_ = -Math.sqrt(1.0 - f_554_ * f_554_);
    let f_556_ = 1.0 - f_554_;
    const f_557_ = Math.sqrt(p * p + n * n);
    if (f_557_ !== 0.0) {
        f_552_ = -n / f_557_;
        f_553_ = p / f_557_;
    }
    fs[0] = f_554_ + f_552_ * f_552_ * f_556_;
    fs[1] = f_553_ * f_555_;
    fs[2] = f_553_ * f_552_ * f_556_;
    fs[3] = -f_553_ * f_555_;
    fs[4] = f_554_;
    fs[5] = f_552_ * f_555_;
    fs[6] = f_552_ * f_553_ * f_556_;
    fs[7] = -f_552_ * f_555_;
    fs[8] = f_554_ + f_553_ * f_553_ * f_556_;
    const fs_558_ = new Float32Array(9);
    f_554_ = Math.cos(rotation * 0.024543693); //pi/128 = 0.024543693
    f_555_ = Math.sin(rotation * 0.024543693); //pi/128 = 0.024543693
    f_556_ = 1.0 - f_554_;
    fs_558_[0] = f_554_;
    fs_558_[1] = 0.0;
    fs_558_[2] = f_555_;
    fs_558_[3] = 0.0;
    fs_558_[4] = 1.0;
    fs_558_[5] = 0.0;
    fs_558_[6] = -f_555_;
    fs_558_[7] = 0.0;
    fs_558_[8] = f_554_;
    const fs_559_ = new Float32Array(9);
    fs_559_[0] = fs_558_[0] * fs[0] + fs_558_[1] * fs[3] + fs_558_[2] * fs[6];
    fs_559_[1] = fs_558_[0] * fs[1] + fs_558_[1] * fs[4] + fs_558_[2] * fs[7];
    fs_559_[2] = fs_558_[0] * fs[2] + fs_558_[1] * fs[5] + fs_558_[2] * fs[8];
    fs_559_[3] = fs_558_[3] * fs[0] + fs_558_[4] * fs[3] + fs_558_[5] * fs[6];
    fs_559_[4] = fs_558_[3] * fs[1] + fs_558_[4] * fs[4] + fs_558_[5] * fs[7];
    fs_559_[5] = fs_558_[3] * fs[2] + fs_558_[4] * fs[5] + fs_558_[5] * fs[8];
    fs_559_[6] = fs_558_[6] * fs[0] + fs_558_[7] * fs[3] + fs_558_[8] * fs[6];
    fs_559_[7] = fs_558_[6] * fs[1] + fs_558_[7] * fs[4] + fs_558_[8] * fs[7];
    fs_559_[8] = fs_558_[6] * fs[2] + fs_558_[7] * fs[5] + fs_558_[8] * fs[8];
    fs_559_[0] *= scaleX;
    fs_559_[1] *= scaleX;
    fs_559_[2] *= scaleX;
    fs_559_[3] *= scaleY;
    fs_559_[4] *= scaleY;
    fs_559_[5] *= scaleY;
    fs_559_[6] *= scaleZ;
    fs_559_[7] *= scaleZ;
    fs_559_[8] *= scaleZ;
    return fs_559_;
}
