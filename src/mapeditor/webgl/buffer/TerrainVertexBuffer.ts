import { DataBuffer } from "../../../renderer/buffer/DataBuffer";
import { Scene } from "../../../rs/scene/Scene";

export const TILE_MAX_FACES = 6;
export const TILE_MAX_VERTICES = 6;

export const TOTAL_TILE_VERTICES = TILE_MAX_FACES * TILE_MAX_VERTICES;

export const LEVEL_TILE_VERTICES =
    Scene.MAP_SQUARE_SIZE * Scene.MAP_SQUARE_SIZE * TOTAL_TILE_VERTICES;

export function getTileOffset(level: number, x: number, y: number): number {
    return level * LEVEL_TILE_VERTICES + (y * Scene.MAP_SQUARE_SIZE + x) * TOTAL_TILE_VERTICES;
}

export class TerrainVertexBuffer extends DataBuffer {
    static readonly STRIDE = 8;

    constructor(count: number) {
        super(TerrainVertexBuffer.STRIDE, count);
    }

    addVertex(x: number, z: number, hsl: number, textureId: number): number {
        const isTextured = textureId !== -1;
        if (isTextured) {
            // only light
            hsl &= 127;
        }

        this.ensureSize(1);
        const byteOffset = this.byteOffset();

        this.view.setUint16(byteOffset, x, true);
        this.view.setUint16(byteOffset + 2, z, true);
        this.view.setUint16(byteOffset + 4, hsl, true);
        this.view.setUint16(byteOffset + 6, textureId + 1, true);

        return this.offset++;
    }
}
