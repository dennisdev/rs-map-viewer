import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class KaleidoscopeOperation extends TextureOperation {
    static x0: number = 0;
    static y0: number = 0;

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.isMonochrome = buffer.readUnsignedByte() === 1;
        }
    }

    calcPos(textureGenerator: TextureGenerator, x: number, y: number): void {
        const hGrad = textureGenerator.horizontalGradient[y];
        const vGrad = textureGenerator.verticalGradient[x];
        const angle = Math.fround(Math.atan2(hGrad - 2048, vGrad - 2048));
        if (angle >= -3.141592653589793 && angle <= -2.356194490192345) {
            KaleidoscopeOperation.x0 = x;
            KaleidoscopeOperation.y0 = y;
        } else if (angle <= -1.5707963267948966 && angle >= -2.356194490192345) {
            KaleidoscopeOperation.y0 = x;
            KaleidoscopeOperation.x0 = y;
        } else if (angle <= -0.7853981633974483 && angle >= -1.5707963267948966) {
            KaleidoscopeOperation.x0 = textureGenerator.width - y;
            KaleidoscopeOperation.y0 = x;
        } else if (angle <= 0.0 && angle >= -0.7853981633974483) {
            KaleidoscopeOperation.y0 = textureGenerator.height - y;
            KaleidoscopeOperation.x0 = x;
        } else if (angle >= 0.0 && angle <= 0.7853981633974483) {
            KaleidoscopeOperation.x0 = textureGenerator.width - x;
            KaleidoscopeOperation.y0 = textureGenerator.height - y;
        } else if (angle >= 0.7853981633974483 && angle <= 1.5707963267948966) {
            KaleidoscopeOperation.x0 = textureGenerator.width - y;
            KaleidoscopeOperation.y0 = textureGenerator.height - x;
        } else if (angle >= 1.5707963267948966 && angle <= 2.356194490192345) {
            KaleidoscopeOperation.x0 = y;
            KaleidoscopeOperation.y0 = textureGenerator.height - x;
        } else if (angle >= 2.356194490192345 && angle <= 3.141592653589793) {
            KaleidoscopeOperation.y0 = y;
            KaleidoscopeOperation.x0 = textureGenerator.width - x;
        }
        KaleidoscopeOperation.x0 &= textureGenerator.widthMask;
        KaleidoscopeOperation.y0 &= textureGenerator.heightMask;
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                this.calcPos(textureGenerator, pixel, line);
                const input = this.getMonochromeInput(
                    textureGenerator,
                    0,
                    KaleidoscopeOperation.y0,
                );
                output[pixel] = input[KaleidoscopeOperation.x0];
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
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                this.calcPos(textureGenerator, pixel, line);
                const input = this.getColourInput(textureGenerator, 0, KaleidoscopeOperation.y0);
                outputR[pixel] = input[0][KaleidoscopeOperation.x0];
                outputG[pixel] = input[1][KaleidoscopeOperation.x0];
                outputB[pixel] = input[2][KaleidoscopeOperation.x0];
            }
        }
        return output;
    }
}
