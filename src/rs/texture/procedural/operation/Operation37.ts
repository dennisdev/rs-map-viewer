import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class Operation37 extends TextureOperation {
    field0 = 2048;
    field1 = 0;
    field2 = 0;
    field3 = 2048;
    field4 = 12288;
    field5 = 4096;
    field6 = 8192;

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
        } else if (field === 4) {
            this.field4 = buffer.readUnsignedShort();
        } else if (field === 5) {
            this.field5 = buffer.readUnsignedShort();
        } else if (field === 6) {
            this.field6 = buffer.readUnsignedShort();
        }
    }

    method3687(x: number, y: number) {
        const local9 = ((y - x) * this.field4) >> 12;
        let local24 = TextureGenerator.COSINE[((local9 * 255) >> 12) & 0xff];
        local24 = ((local24 << 12) / this.field4) | 0;
        local24 = ((local24 << 12) / this.field6) | 0;
        local24 = (this.field5 * local24) >> 12;
        return local24 > x + y && -local24 < x + y;
    }

    method3690(x: number, y: number) {
        const local13 = ((y + x) * this.field4) >> 12;
        let local23 = TextureGenerator.COSINE[((local13 * 255) >> 12) & 0xff];
        local23 = ((local23 << 12) / this.field4) | 0;
        local23 = ((local23 << 12) / this.field6) | 0;
        local23 = (local23 * this.field5) >> 12;
        return local23 > y - x && y - x > -local23;
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const local22 = textureGenerator.verticalGradient[line] - 2048;
            for (let x = 0; x < textureGenerator.width; x++) {
                const local33 = textureGenerator.horizontalGradient[x] - 2048;
                let local38 = local33 + this.field0;
                local38 = local38 >= -2048 ? local38 : local38 + 4096;
                let local53 = local22 + this.field1;
                local38 = local38 <= 2048 ? local38 : local38 - 4096;
                local53 = local53 >= -2048 ? local53 : local53 + 4096;
                local53 = local53 <= 2048 ? local53 : local53 - 4096;
                let local87 = local33 + this.field2;
                let local92 = local22 + this.field3;
                local87 = local87 >= -2048 ? local87 : local87 + 4096;
                local87 = local87 <= 2048 ? local87 : local87 - 4096;
                local92 = local92 >= -2048 ? local92 : local92 + 4096;
                local92 = local92 <= 2048 ? local92 : local92 - 4096;
                output[x] =
                    this.method3687(local38, local53) || this.method3690(local87, local92)
                        ? 4096
                        : 0;
            }
        }
        return output;
    }
}
