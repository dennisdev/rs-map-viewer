import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class WeaveOperation extends TextureOperation {
    thickness = 585;

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.thickness = buffer.readUnsignedShort();
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const gradV = textureGenerator.verticalGradient[line];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                const gradH = textureGenerator.horizontalGradient[pixel];
                if (
                    gradH > this.thickness &&
                    4096 - this.thickness > gradH &&
                    gradV > 2048 - this.thickness &&
                    gradV < this.thickness + 2048
                ) {
                    let v = 2048 - gradH;
                    v = v < 0 ? -v : v;
                    v <<= 12;
                    v /= 2048 - this.thickness;
                    output[pixel] = 4096 - v;
                } else if (2048 - this.thickness < gradH && 2048 + this.thickness > gradH) {
                    let v = gradV - 2048;
                    v = v < 0 ? -v : v;
                    v -= this.thickness;
                    v <<= 12;
                    output[pixel] = v / (2048 - this.thickness);
                } else if (this.thickness > gradV || gradV > 4096 - this.thickness) {
                    let v = gradH - 2048;
                    v = v < 0 ? -v : v;
                    v -= this.thickness;
                    v <<= 12;
                    output[pixel] = v / (2048 - this.thickness);
                } else if (gradH < this.thickness || 4096 - this.thickness < gradH) {
                    let v = 2048 - gradV;
                    v = v < 0 ? -v : v;
                    v <<= 12;
                    v /= 2048 - this.thickness;
                    output[pixel] = 4096 - v;
                } else {
                    output[pixel] = 0;
                }
            }
        }
        return output;
    }
}
