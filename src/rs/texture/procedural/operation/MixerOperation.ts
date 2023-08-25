import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class MixerOperation extends TextureOperation {
    constructor() {
        super(3, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.isMonochrome = buffer.readUnsignedByte() === 1;
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const inputA = this.getMonochromeInput(textureGenerator, 0, line);
            const inputB = this.getMonochromeInput(textureGenerator, 1, line);
            const inputC = this.getMonochromeInput(textureGenerator, 2, line);
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                const aWeight = inputC[pixel];
                if (aWeight === 4096) {
                    output[pixel] = inputA[pixel];
                } else if (aWeight === 0) {
                    output[pixel] = inputB[pixel];
                } else {
                    output[pixel] =
                        ((4096 - aWeight) * inputB[pixel] + aWeight * inputA[pixel]) >> 12;
                }
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
            const inputC = this.getMonochromeInput(textureGenerator, 2, line);
            const inputA = this.getColourInput(textureGenerator, 0, line);
            const inputB = this.getColourInput(textureGenerator, 1, line);
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            const inputAR = inputA[0];
            const inputAG = inputA[1];
            const inputAB = inputA[2];
            const inputBR = inputB[0];
            const inputBG = inputB[1];
            const inputBB = inputB[2];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                const aWeight = inputC[pixel];
                if (aWeight === 4096) {
                    outputR[pixel] = inputAR[pixel];
                    outputG[pixel] = inputAG[pixel];
                    outputB[pixel] = inputAB[pixel];
                } else if (aWeight === 0) {
                    outputR[pixel] = inputBR[pixel];
                    outputG[pixel] = inputBG[pixel];
                    outputB[pixel] = inputBB[pixel];
                } else {
                    const bWeight = 4096 - aWeight;
                    outputR[pixel] = (aWeight * inputAR[pixel] + bWeight * inputBR[pixel]) >> 12;
                    outputG[pixel] = (aWeight * inputAG[pixel] + bWeight * inputBG[pixel]) >> 12;
                    outputB[pixel] = (aWeight * inputAB[pixel] + bWeight * inputBB[pixel]) >> 12;
                }
            }
        }
        return output;
    }
}
