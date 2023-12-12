import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class HerringboneOperation extends TextureOperation {
    scaleX: number = 1;
    scaleY: number = 1;

    ratio: number = 204;

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.scaleX = buffer.readUnsignedByte();
        } else if (field === 1) {
            this.scaleY = buffer.readUnsignedByte();
        } else if (field === 2) {
            this.ratio = buffer.readUnsignedShort();
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            for (let x = 0; x < textureGenerator.width; x++) {
                const vGrad = textureGenerator.horizontalGradient[x];
                const hGrad = textureGenerator.verticalGradient[line];
                let local40 = (this.scaleX * vGrad) >> 12;
                const local51 = (this.scaleY * hGrad) >> 12;
                const local61 = this.scaleX * (vGrad % ((4096 / this.scaleX) | 0));
                const local71 = this.scaleY * (hGrad % ((4096 / this.scaleY) | 0));
                if (local71 < this.ratio) {
                    for (local40 -= local51; local40 < 0; local40 += 4) {}
                    while (local40 > 3) {
                        local40 -= 4;
                    }
                    if (local40 != 1) {
                        output[x] = 0;
                        continue;
                    }
                    if (local61 < this.ratio) {
                        output[x] = 0;
                        continue;
                    }
                }
                if (local61 < this.ratio) {
                    let local131: number;
                    for (local131 = local40 - local51; local131 < 0; local131 += 4) {}
                    while (local131 > 3) {
                        local131 -= 4;
                    }
                    if (local131 > 0) {
                        output[x] = 0;
                        continue;
                    }
                }
                output[x] = 4096;
            }
        }
        return output;
    }
}
