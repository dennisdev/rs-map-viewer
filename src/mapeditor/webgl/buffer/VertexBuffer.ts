import { DataBuffer } from "../../../mapviewer/buffer/DataBuffer";

export class VertexBuffer extends DataBuffer {
    static readonly STRIDE = 8;

    constructor(count: number) {
        super(VertexBuffer.STRIDE, count);
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
