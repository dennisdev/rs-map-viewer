import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class ColourStripOperation extends TextureOperation {
    colourR: number = 4096;
    colourG: number = 4096;
    colourB: number = 4096;

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.colourR = buffer.readUnsignedShort();
        } else if (field === 1) {
            this.colourG = buffer.readUnsignedShort();
        } else if (field === 2) {
            this.colourB = buffer.readUnsignedShort();
        }
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
                const valueR = inputR[pixel];
                const valueG = inputG[pixel];
                const valueB = inputB[pixel];
                if (valueR !== valueB || valueB !== valueG) {
                    outputR[pixel] = this.colourR;
                    outputG[pixel] = this.colourG;
                    outputB[pixel] = this.colourB;
                } else {
                    outputR[pixel] = (this.colourR * valueR) >> 12;
                    outputG[pixel] = (this.colourG * valueG) >> 12;
                    outputB[pixel] = (this.colourB * valueB) >> 12;
                }
            }
        }
        return output;
    }
}
