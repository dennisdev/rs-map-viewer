import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class ConstantMonochromeOperation extends TextureOperation {
    constant: number;

    constructor(constant: number = 4096) {
        super(0, true);
        this.constant = constant;
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.constant = ((buffer.readUnsignedByte() << 12) / 255) | 0;
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            output.fill(this.constant, 0, textureGenerator.width);
        }
        return output;
    }
}
