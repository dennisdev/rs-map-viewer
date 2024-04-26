import { FloatUtil } from "../../util/FloatUtil";
import { clamp } from "../../util/MathUtil";
import { DataBuffer } from "./DataBuffer";

export class VertexBuffer extends DataBuffer {
    static readonly STRIDE = 12;

    vertexIndices: Map<number, number>;

    constructor(count: number) {
        super(VertexBuffer.STRIDE, count);
        this.vertexIndices = new Map();
    }

    addVertex(
        x: number,
        y: number,
        z: number,
        hsl: number,
        alpha: number,
        u: number,
        v: number,
        textureId: number,
        priority: number,
        reuseVertex: boolean = true,
    ) {
        if (textureId >= 1024) {
            textureId = -1;
        }
        const isTextured = textureId !== -1;
        if (isTextured) {
            // textureId = 119;
            // only light
            hsl &= 127;
            hsl |= (textureId & 0x1ff) << 7;
        }

        const xPos = clamp(x + 0x4000, 0, 0x8000);
        const yPos = clamp(-y + 0x4000, 0, 0x8000);
        const zPos = clamp(z + 0x4000, 0, 0x8000);

        priority &= 0x7;

        const uPacked = clamp(FloatUtil.packFloat11(u), 0, 0x7ff);
        const vPacked = clamp(FloatUtil.packFloat11(v), 0, 0x7ff);

        const v0 = (xPos << 17) | ((uPacked & 0x3f) << 11) | vPacked;

        const v1 = yPos | (hsl << 15) | (Number(isTextured) << 31);

        const v2 =
            (zPos << 17) |
            (alpha << 9) |
            (priority << 6) |
            (((textureId >> 9) & 0x1) << 5) |
            (uPacked >> 6);

        if (reuseVertex) {
            const hash = v0 * v1 * v2;
            // const hash = BigInt(v0) << 64n | BigInt(v1) << 32n | BigInt(v2);
            // const hash = Hasher.hash(this.byteArray.subarray(vertexBufIndex, vertexBufIndex + VertexBuffer.VERTEX_STRIDE));
            const cachedIndex = this.vertexIndices.get(hash);
            if (cachedIndex !== undefined) {
                return cachedIndex;
            } else {
                this.vertexIndices.set(hash, this.offset);
            }
        }
        this.ensureSize(1);
        const byteOffset = this.byteOffset();

        this.view.setUint32(byteOffset, v0, true);
        this.view.setUint32(byteOffset + 4, v1, true);
        this.view.setUint32(byteOffset + 8, v2, true);

        return this.offset++;
    }
}
