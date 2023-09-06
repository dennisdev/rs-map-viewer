import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class BlurOperation extends TextureOperation {
    hExtent: number = 1;
    vExtent: number = 1;

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.hExtent = buffer.readUnsignedByte();
        } else if (field === 1) {
            this.vExtent = buffer.readUnsignedByte();
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
            const nPasses = 1 + (this.vExtent + this.vExtent);
            const invPasses = (65536 / nPasses) | 0;
            const nPixels = 1 + this.hExtent + this.hExtent;
            const invPixels = (65536 / nPixels) | 0;
            const passes = new Array<Int32Array>(nPasses);
            for (let pass = -this.vExtent + line; pass <= line + this.vExtent; pass++) {
                const input = this.getMonochromeInput(
                    textureGenerator,
                    0,
                    pass & textureGenerator.heightMask,
                );
                const passOut = new Int32Array(textureGenerator.width);
                let sum = 0;
                for (let pixel = -this.hExtent; pixel <= this.hExtent; pixel++) {
                    sum += input[pixel & textureGenerator.widthMask];
                }
                let ptr = 0;
                while (ptr < textureGenerator.width) {
                    passOut[ptr] = ((sum * invPixels) / 65536) | 0;
                    sum -= input[(ptr - this.hExtent) & textureGenerator.widthMask];
                    ptr++;
                    sum += input[(ptr + this.hExtent) & textureGenerator.widthMask];
                }
                passes[this.vExtent - line + pass] = passOut;
            }
            /* Now average over passes */
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                let sum = 0;
                for (let pass = 0; pass < nPasses; pass++) {
                    sum += passes[pass][pixel];
                }
                output[pixel] = ((sum * invPasses) / 65536) | 0;
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
            const nPasses = 1 + (this.vExtent + this.vExtent);
            const invPasses = (65536 / nPasses) | 0;
            const nPixels = 1 + this.hExtent + this.hExtent;
            const invPixels = (65536 / nPixels) | 0;
            const passes = new Array<Int32Array[]>(nPasses);
            for (let pass = -this.vExtent + line; pass <= line + this.vExtent; pass++) {
                const input = this.getColourInput(
                    textureGenerator,
                    0,
                    pass & textureGenerator.heightMask,
                );
                const passOut = new Array<Int32Array>(3);
                for (let i = 0; i < 3; i++) {
                    passOut[i] = new Int32Array(textureGenerator.width);
                }
                let sumR = 0;
                let sumG = 0;
                let sumB = 0;
                for (let pixel = -this.hExtent; pixel <= this.hExtent; pixel++) {
                    sumR += input[0][pixel & textureGenerator.widthMask];
                    sumG += input[1][pixel & textureGenerator.widthMask];
                    sumB += input[2][pixel & textureGenerator.widthMask];
                }
                let ptr = 0;
                while (ptr < textureGenerator.width) {
                    passOut[0][ptr] = ((sumR * invPixels) / 65536) | 0;
                    passOut[1][ptr] = ((sumG * invPixels) / 65536) | 0;
                    passOut[2][ptr] = ((sumB * invPixels) / 65536) | 0;
                    sumR -= input[0][(ptr - this.hExtent) & textureGenerator.widthMask];
                    sumG -= input[1][(ptr - this.hExtent) & textureGenerator.widthMask];
                    sumB -= input[2][(ptr - this.hExtent) & textureGenerator.widthMask];
                    ptr++;
                    sumR += input[0][(ptr + this.hExtent) & textureGenerator.widthMask];
                    sumG += input[1][(ptr + this.hExtent) & textureGenerator.widthMask];
                    sumB += input[2][(ptr + this.hExtent) & textureGenerator.widthMask];
                }
                passes[this.vExtent + pass - line] = passOut;
            }
            /* Now average over passes */
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                let sumR = 0;
                let sumG = 0;
                let sumB = 0;
                for (let pass = 0; pass < nPasses; pass++) {
                    sumR += passes[pass][0][pixel];
                    sumG += passes[pass][1][pixel];
                    sumB += passes[pass][2][pixel];
                }
                output[0][pixel] = ((sumR * invPasses) / 65536) | 0;
                output[1][pixel] = ((sumG * invPasses) / 65536) | 0;
                output[2][pixel] = ((sumB * invPasses) / 65536) | 0;
            }
        }
        return output;
    }
}
