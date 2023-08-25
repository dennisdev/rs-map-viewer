import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class ConstantColourOperation extends TextureOperation {
    constantR: number = 0;
    constantG: number = 0;
    constantB: number = 0;

    constructor(rgb: number = 0) {
        super(0, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.setConstant(buffer.readMedium());
        }
    }

    setConstant(rgb: number) {
        this.constantR = ((rgb >> 16) & 0xff) * 16;
        this.constantG = ((rgb >> 8) & 0xff) * 16;
        this.constantB = (rgb & 0xff) * 16;
    }

    override getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        if (!this.colourImageCache) {
            throw new Error("Colour image cache is not initialized");
        }
        const output = this.colourImageCache.get(line);
        if (this.colourImageCache.dirty) {
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                outputR[pixel] = this.constantR;
                outputG[pixel] = this.constantG;
                outputB[pixel] = this.constantB;
            }
        }
        return output;
    }
}
