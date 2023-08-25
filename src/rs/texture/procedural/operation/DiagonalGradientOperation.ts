import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class DiagonalGradientOperation extends TextureOperation {
    interpolationMode = 0;
    steepness = 1;
    mixMode = 0;

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.mixMode = buffer.readUnsignedByte();
        } else if (field === 1) {
            this.interpolationMode = buffer.readUnsignedByte();
        } else if (field === 3) {
            this.steepness = buffer.readUnsignedByte();
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const inParam = textureGenerator.verticalGradient[line];
            const nParam = (inParam - 2048) >> 1;
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                const inValue = textureGenerator.horizontalGradient[pixel];
                const nValue = (inValue - 2048) >> 1;
                let pytN: number;
                if (this.mixMode === 0) {
                    pytN = (inValue - inParam) * this.steepness;
                } else {
                    const sqNSum = (nParam * nParam + nValue * nValue) >> 12;
                    pytN = (4096.0 * Math.sqrt(sqNSum / 4096.0)) | 0;
                    pytN = (this.steepness * pytN * 3.141592653589793) | 0;
                }
                pytN -= pytN & ~0xfff;
                if (this.interpolationMode === 0) {
                    pytN = (TextureGenerator.SINE[(pytN >> 4) & 0xff] + 4096) >> 1;
                } else if (this.interpolationMode === 2) {
                    pytN -= 2048;
                    if (pytN < 0) {
                        pytN = -pytN;
                    }
                    pytN = (2048 - pytN) << 1;
                }
                output[pixel] = pytN;
            }
        }
        return output;
    }
}
