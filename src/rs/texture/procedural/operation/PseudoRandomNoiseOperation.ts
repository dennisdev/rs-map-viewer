import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class PseudoRandomNoiseOperation extends TextureOperation {
    static noise(x: number, y: number): number {
        let n = x + y * 57;
        n ^= n << 1;
        return 4096 - ((((1376312589 + (789221 + 15731 * (n * n)) * n) & 0x7fffffff) / 262144) | 0);
    }

    constructor() {
        super(0, true);
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const vertGradient = textureGenerator.verticalGradient[line];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                const horzGradient = textureGenerator.horizontalGradient[pixel];
                output[pixel] = PseudoRandomNoiseOperation.noise(horzGradient, vertGradient) % 4096;
            }
        }
        return output;
    }
}
