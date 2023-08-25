import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class TrigWarpOperation extends TextureOperation {
    hypotenuseMultiplier: number = 32768;

    constructor() {
        super(3, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.hypotenuseMultiplier = buffer.readUnsignedShort() << 4;
        } else if (field === 1) {
            this.isMonochrome = buffer.readUnsignedByte() === 1;
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }

        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const inputA = this.getMonochromeInput(textureGenerator, 1, line);
            const inputB = this.getMonochromeInput(textureGenerator, 2, line);
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                const angle = (inputA[pixel] >> 4) & 0xff;
                const hyp = (inputB[pixel] * this.hypotenuseMultiplier) >> 12;
                const cosine = (TextureGenerator.COSINE[angle] * hyp) >> 12;
                const sine = (TextureGenerator.SINE[angle] * hyp) >> 12;
                const nX = (pixel + (cosine >> 12)) & textureGenerator.pixelMaxIdx;
                const nY = (line + (sine >> 12)) & textureGenerator.lineMaxIdx;
                const input = this.getMonochromeInput(textureGenerator, 0, nY);
                output[pixel] = input[nX];
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
            const inputA = this.getMonochromeInput(textureGenerator, 1, line);
            const inputB = this.getMonochromeInput(textureGenerator, 2, line);
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                const angle = (inputA[pixel] >> 4) & 0xff;
                const hyp = (inputB[pixel] * this.hypotenuseMultiplier) >> 12;
                const cosine = (TextureGenerator.COSINE[angle] * hyp) >> 12;
                const sine = (TextureGenerator.SINE[angle] * hyp) >> 12;
                const nX = (pixel + (cosine >> 12)) & textureGenerator.pixelMaxIdx;
                const nY = (line + (sine >> 12)) & textureGenerator.lineMaxIdx;
                const input = this.getColourInput(textureGenerator, 0, nY);
                outputR[pixel] = input[0][nX];
                outputG[pixel] = input[1][nX];
                outputB[pixel] = input[2][nX];
            }
        }
        return output;
    }
}
