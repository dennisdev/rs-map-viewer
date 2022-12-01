import { COSINE } from "./Client";
import { CollisionMap } from "./CollisionMap";
import { ByteBuffer } from "./util/ByteBuffer";

function interpolate(i: number, i_4_: number, i_5_: number, freq: number): number {
    const i_8_ = 65536 - COSINE[i_5_ * 1024 / freq] >> 1;
    return (i_8_ * i_4_ >> 16) + ((65536 - i_8_) * i >> 16);
}

function noise(x: number, y: number): number {
    let n = y * 57 + x;
    n = n << 13 ^ n;
    const n2 = Math.imul(n, Math.imul(Math.imul(n, n), 15731) + 789221) + 1376312589 & 0x7fffffff;
    return n2 >> 19 & 0xff;
}

function smoothedNoise1(x: number, y: number): number {
    const corners = (noise(x - 1, y - 1) + noise(x + 1, y - 1) + noise(x - 1, y + 1) + noise(x + 1, y + 1));
    const sides = (noise(x - 1, y) + noise(x + 1, y) + noise(x, y - 1) + noise(x, y + 1));
    const center = noise(x, y);
    return (center / 4 | 0) + (sides / 8 | 0) + (corners / 16 | 0);
}

function interpolateNoise(x: number, y: number, freq: number): number {
    const i_23_ = x / freq | 0;
    const i_24_ = x & freq - 1;
    const i_25_ = y / freq | 0;
    const i_26_ = y & freq - 1;
    const i_27_ = smoothedNoise1(i_23_, i_25_);
    const i_28_ = smoothedNoise1(i_23_ + 1, i_25_);
    const i_29_ = smoothedNoise1(i_23_, i_25_ + 1);
    const i_30_ = smoothedNoise1(i_23_ + 1, i_25_ + 1);
    const i_31_ = interpolate(i_27_, i_28_, i_24_, freq);
    const i_32_ = interpolate(i_29_, i_30_, i_24_, freq);
    return interpolate(i_31_, i_32_, i_26_, freq);
}

function generateHeight(x: number, y: number) {
    let n = interpolateNoise(x + 45365, y + 91923, 4) - 128
        + (interpolateNoise(x + 10294, y + 37821, 2) - 128 >> 1)
        + (interpolateNoise(x, y, 1) - 128 >> 2);
    n = (0.3 * n | 0) + 35;
    if (n < 10) {
        n = 10;
    } else if (n > 60) {
        n = 60;
    }
    return n;
}

export type ObjectSpawn = {
    id: number,
    type: number,
    rotation: number,
    localX: number,
    localY: number,
    plane: number
};

// TODO: rename to Region
export class Scene {
    public static readonly MAX_PLANE = 4;

    public static readonly MAP_SIZE = 64;

    revision: number;

    planes: number;

    width: number;

    height: number;

    collisionMaps: CollisionMap[];

    tileHeights: Int32Array[][];

    tileRenderFlags: Uint8Array[][];

    tileUnderlays: Uint16Array[][];

    tileOverlays: Int16Array[][];

    tileShapes: Uint8Array[][];

    tileRotations: Uint8Array[][];

    objectLightOcclusionMap: Uint8Array[][];

    constructor(revision: number, planes: number, width: number, height: number) {
        this.revision = revision;
        this.planes = planes;
        this.width = width;
        this.height = height;
        this.collisionMaps = new Array(this.planes);
        this.tileHeights = new Array(this.planes);
        this.tileRenderFlags = new Array(this.planes);
        this.tileUnderlays = new Array(this.planes);
        this.tileOverlays = new Array(this.planes);
        this.tileShapes = new Array(this.planes);
        this.tileRotations = new Array(this.planes);
        this.objectLightOcclusionMap = new Array(this.planes);
        for (let i = 0; i < Scene.MAX_PLANE; i++) {
            this.collisionMaps[i] = new CollisionMap(width, height);
            this.tileHeights[i] = new Array(this.width + 1).fill(0).map(() => new Int32Array(this.height + 1));
            this.tileRenderFlags[i] = new Array(this.width);
            this.tileUnderlays[i] = new Array(this.width);
            this.tileOverlays[i] = new Array(this.width);
            this.tileShapes[i] = new Array(this.width);
            this.tileRotations[i] = new Array(this.width);
            this.objectLightOcclusionMap[i] = new Array(this.width);
            for (let x = 0; x < this.width; x++) {
                this.tileRenderFlags[i][x] = new Uint8Array(this.height);
                this.tileUnderlays[i][x] = new Uint16Array(this.height);
                this.tileOverlays[i][x] = new Int16Array(this.height);
                this.tileShapes[i][x] = new Uint8Array(this.height);
                this.tileRotations[i][x] = new Uint8Array(this.height);
                this.objectLightOcclusionMap[i][x] = new Uint8Array(this.height);
            }
        }
    }

    readTerrainValue(buffer: ByteBuffer, signed: boolean = false) {
        if (this.revision < 209) {
            return signed ? buffer.readByte() : buffer.readUnsignedByte();
        } else {
            return signed ? buffer.readShort() : buffer.readUnsignedShort();
        }
    }

    decodeTerrain(data: Int8Array, offsetX: number, offsetY: number, baseX: number, baseY: number): void {
        const buffer = new ByteBuffer(data);

        for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
            for (let x = 0; x < Scene.MAP_SIZE; x++) {
                for (let y = 0; y < Scene.MAP_SIZE; y++) {
                    this.decodeTile(buffer, plane, x + offsetX, y + offsetY, baseX, baseY, 0);
                }
            }
        }
    }

    decodeTile(buffer: ByteBuffer, plane: number, x: number, y: number, baseX: number, baseY: number, rotationOffset: number): void {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.tileRenderFlags[plane][x][y] = 0;

            while (true) {
                const v = this.readTerrainValue(buffer);
                if (v === 0) {
                    if (plane == 0) {
                        const actualX = x + baseX + 932731;
                        const actualY = y + baseY + 556238;
                        this.tileHeights[plane][x][y] = -generateHeight(actualX, actualY) * 8;
                    } else {
                        this.tileHeights[plane][x][y] = this.tileHeights[plane - 1][x][y] - 240;
                    }
                    break;
                }

                if (v === 1) {
                    let height = buffer.readUnsignedByte();
                    if (height === 1) {
                        height = 0;
                    }

                    if (plane === 0) {
                        this.tileHeights[0][x][y] = -height * 8;
                    } else {
                        this.tileHeights[plane][x][y] = this.tileHeights[plane - 1][x][y] - height * 8;
                    }
                    break;
                }

                if (v <= 49) {
                    this.tileOverlays[plane][x][y] = this.readTerrainValue(buffer);
                    this.tileShapes[plane][x][y] = (v - 2) / 4;
                    this.tileRotations[plane][x][y] = v - 2 + rotationOffset & 3;
                } else if (v <= 81) {
                    this.tileRenderFlags[plane][x][y] = v - 49;
                } else {
                    this.tileUnderlays[plane][x][y] = v - 81;
                }
            }
        } else {
            while (true) {
                const v = this.readTerrainValue(buffer);
                if (v === 0) {
                    break;
                }

                if (v === 1) {
                    buffer.readUnsignedByte();
                    break;
                }

                if (v <= 49) {
                    this.readTerrainValue(buffer);
                }
            }
        }
    }

    decodeLandscape(buffer: ByteBuffer): ObjectSpawn[] {
        const spawns = [];

        let id = -1;
        let idDelta;
        while ((idDelta = buffer.readSmart3()) != 0) {
            id += idDelta;

            let pos = 0;
            let posDelta;
            while ((posDelta = buffer.readUnsignedSmart()) != 0) {
                pos += posDelta - 1;

                const localX = (pos >> 6 & 0x3f);
                const localY = (pos & 0x3f);
                const plane = pos >> 12;

                const attributes = buffer.readUnsignedByte();

                const type = attributes >> 2;
                const rotation = attributes & 0x3;
                
                spawns.push({id, type, rotation, localX, localY, plane});
                // this.addObject(objectId, type, rotation, plane, localX, localY);
            }
        }

        return spawns;
    }
}
