import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class MirrorOperation extends TextureOperation {
    invertHorizontal: boolean = true;
    invertVertical: boolean = true;

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.invertHorizontal = buffer.readUnsignedByte() === 1;
        } else if (field === 1) {
            this.invertVertical = buffer.readUnsignedByte() === 1;
        } else if (field === 2) {
            this.isMonochrome = buffer.readUnsignedByte() === 1;
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const input = this.getMonochromeInput(
                textureGenerator,
                0,
                this.invertVertical ? textureGenerator.lineMaxIdx - line : line,
            );
            if (this.invertHorizontal) {
                for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                    output[pixel] = input[textureGenerator.pixelMaxIdx - pixel];
                }
            } else {
                output.set(input.subarray(textureGenerator.width));
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
            const input = this.getColourInput(
                textureGenerator,
                0,
                this.invertVertical ? textureGenerator.lineMaxIdx - line : line,
            );
            const inputR = input[0];
            const inputG = input[1];
            const inputB = input[2];
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            if (this.invertHorizontal) {
                for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                    outputR[pixel] = inputR[textureGenerator.pixelMaxIdx - pixel];
                    outputG[pixel] = inputG[textureGenerator.pixelMaxIdx - pixel];
                    outputB[pixel] = inputB[textureGenerator.pixelMaxIdx - pixel];
                }
            } else {
                for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                    outputR[pixel] = inputR[pixel];
                    outputG[pixel] = inputG[pixel];
                    outputB[pixel] = inputB[pixel];
                }
            }
        }
        return output;
    }
}
