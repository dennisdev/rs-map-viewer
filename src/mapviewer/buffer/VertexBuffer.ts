import { FloatUtil } from "../../client/util/FloatUtil";
import { DataBuffer } from "./DataBuffer";

export class VertexBuffer extends DataBuffer {
    public static readonly STRIDE = 12;

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
        reuseVertex: boolean = true
    ) {
        if (textureId !== -1) {
            // only light
            hsl = hsl & 127;
        }

        const v0 =
            ((x + 0x4000) << 17) |
            (FloatUtil.packFloat6(u) << 11) |
            FloatUtil.packFloat11(v);

        const v1 =
            (hsl << 16) |
            (alpha << 8) |
            ((textureId + 1) << 1) |
            (priority & 0x1);

        const v2 = ((z + 0x4000) << 17) | ((-y + 0x400) << 3) | (priority >> 1);

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

        this.view.setInt32(byteOffset, v0, true);
        this.view.setInt32(byteOffset + 4, v1, true);
        this.view.setInt32(byteOffset + 8, v2, true);

        return this.offset++;
    }
}
