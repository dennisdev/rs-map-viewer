import { TextureGenerator } from "../TextureGenerator";
import { SpriteSourceOperation } from "./SpriteSourceOperation";

export class TilingSpriteOperation extends SpriteSourceOperation {
    override getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        if (!this.colourImageCache) {
            throw new Error("Colour image cache is not initialized");
        }
        const output = this.colourImageCache.get(line);
        if (this.colourImageCache.dirty && super.loadSprite(textureGenerator) && this.pixels) {
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            const startY = this.height * (line % this.height);
            for (let x = 0; x < textureGenerator.width; x++) {
                const rgb = this.pixels[startY + (x % this.width)];
                outputR[x] = (rgb >> 12) & 0xff0;
                outputG[x] = (rgb >> 4) & 0xff0;
                outputB[x] = (rgb & 0xff) << 4;
            }
        }
        return output;
    }
}
