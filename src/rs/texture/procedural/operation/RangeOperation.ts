import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class RangeOperation extends TextureOperation {
    field0 = 1024;
    field1 = 3072;

    field2 = this.field1 - this.field0;

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.field0 = buffer.readUnsignedShort();
        } else if (field === 1) {
            this.field1 = buffer.readUnsignedShort();
        } else if (field === 2) {
            this.isMonochrome = buffer.readUnsignedByte() === 1;
        }
    }

    override init() {
        this.field2 = this.field1 - this.field0;
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const input = this.getMonochromeInput(textureGenerator, 0, line);
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                output[pixel] = ((this.field2 * input[pixel]) >> 12) + this.field0;
            }
        }
        return output;
    }

    override getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        if (!this.colourImageCache) {
            throw new Error("Colour image cache is not initialized");
        }
        const output = this.colourImageCache.get(line);
        if (this.colourImageCache.dirty) {
            const input = this.getColourInput(textureGenerator, 0, line);
            const inputR = input[0];
            const inputG = input[1];
            const inputB = input[2];
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                outputR[pixel] = ((this.field2 * inputR[pixel]) >> 12) + this.field0;
                outputG[pixel] = ((this.field2 * inputG[pixel]) >> 12) + this.field0;
                outputB[pixel] = ((this.field2 * inputB[pixel]) >> 12) + this.field0;
            }
        }
        return output;
    }
}
