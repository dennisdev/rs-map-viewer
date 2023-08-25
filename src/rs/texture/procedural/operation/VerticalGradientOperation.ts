import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class VerticalGradientOperation extends TextureOperation {
    constructor() {
        super(0, true);
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            output.fill(textureGenerator.verticalGradient[line], 0, textureGenerator.width);
        }
        return output;
    }
}
