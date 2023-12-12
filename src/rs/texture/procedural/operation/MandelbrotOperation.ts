import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class MandelbrotOperation extends TextureOperation {
    field0 = 1365;
    field1 = 20;
    field2 = 0;
    field3 = 0;

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.field0 = buffer.readUnsignedShort();
        } else if (field === 1) {
            this.field1 = buffer.readUnsignedShort();
        } else if (field === 2) {
            this.field2 = buffer.readUnsignedShort();
        } else if (field === 3) {
            this.field3 = buffer.readUnsignedShort();
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            for (let x = 0; x < textureGenerator.width; x++) {
                const local42 =
                    (this.field2 + (textureGenerator.horizontalGradient[x] << 12) / this.field0) |
                    0;
                const local54 =
                    (this.field3 + (textureGenerator.verticalGradient[line] << 12) / this.field0) |
                    0;
                let local58 = local54;
                let local60 = local42;
                let local64 = 0;
                let local70 = (local42 * local42) >> 12;
                let local76 = (local54 * local54) >> 12;
                while (local70 + local76 < 16384 && local64 < this.field1) {
                    local64++;
                    local58 = local54 + ((local58 * local60) >> 12) * 2;
                    local60 = local42 + local70 - local76;
                    local76 = (local58 * local58) >> 12;
                    local70 = (local60 * local60) >> 12;
                }
                output[x] = local64 >= this.field1 - 1 ? 0 : ((local64 << 12) / this.field1) | 0;
            }
        }
        return output;
    }
}
