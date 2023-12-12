import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class BinaryOperation extends TextureOperation {
    minValue: number = 0;
    maxValue: number = 4096;

    constructor() {
        super(1, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.minValue = buffer.readUnsignedShort();
        } else if (field === 1) {
            this.maxValue = buffer.readUnsignedShort();
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const input = this.getMonochromeInput(textureGenerator, 0, line);
            for (let x = 0; x < textureGenerator.width; x++) {
                const value = input[x];
                output[x] = value >= this.minValue && value <= this.maxValue ? 4096 : 0;
            }
        }
        return output;
    }
}
