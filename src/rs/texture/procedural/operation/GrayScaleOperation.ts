import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class GrayScaleOperation extends TextureOperation {
    constructor() {
        super(1, true);
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const input = this.getColourInput(textureGenerator, 0, line);
            const inputR = input[0];
            const inputG = input[1];
            const inputB = input[2];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                output[pixel] = (inputR[pixel] + inputG[pixel] + inputB[pixel]) / 3;
            }
        }
        return output;
    }
}
