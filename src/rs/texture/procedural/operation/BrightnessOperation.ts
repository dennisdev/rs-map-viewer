import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class BrightnessOperation extends TextureOperation {
    maxValue: number = 409;

    redFactor: number = 4096;
    greenFactor: number = 4096;
    blueFactor: number = 4096;

    colorDelta: Int32Array = new Int32Array(3);

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.maxValue = buffer.readUnsignedShort();
        } else if (field === 1) {
            this.blueFactor = buffer.readUnsignedShort();
        } else if (field === 2) {
            this.greenFactor = buffer.readUnsignedShort();
        } else if (field === 3) {
            this.redFactor = buffer.readUnsignedShort();
        } else if (field === 4) {
            const rgb = buffer.readUnsignedMedium();
            this.colorDelta[0] = (rgb & 0xff0000) << 4;
            this.colorDelta[1] = (rgb >> 4) & 0xff0;
            this.colorDelta[2] = (rgb >> 12) & 0x0;
        }
    }

    override getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        if (!this.colourImageCache) {
            throw new Error("Colour image cache is not initialized");
        }
        const output = this.colourImageCache.get(line);
        if (this.colourImageCache.dirty) {
            const input = this.getColourInput(textureGenerator, 0, line);
            const inputR = input[0];
            const inputG = input[1];
            const inputB = input[2];
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            for (let x = 0; x < textureGenerator.width; x++) {
                const r = inputR[x];
                let absR = r - this.colorDelta[0];
                if (absR < 0) {
                    absR = -absR;
                }
                if (absR <= this.maxValue) {
                    const g = inputG[x];
                    let absG = g - this.colorDelta[1];
                    if (absG < 0) {
                        absG = -absG;
                    }
                    if (absG <= this.maxValue) {
                        const b = inputB[x];
                        let absB = b - this.colorDelta[2];
                        if (absB < 0) {
                            absB = -absB;
                        }
                        if (absB <= this.maxValue) {
                            outputR[x] = (r * this.redFactor) >> 12;
                            outputG[x] = (g * this.greenFactor) >> 12;
                            outputB[x] = (b * this.blueFactor) >> 12;
                        } else {
                            outputR[x] = r;
                            outputG[x] = g;
                            outputB[x] = b;
                        }
                    } else {
                        outputR[x] = r;
                        outputG[x] = g;
                        outputB[x] = inputB[x];
                    }
                } else {
                    outputR[x] = r;
                    outputG[x] = inputG[x];
                    outputB[x] = inputB[x];
                }
            }
        }
        return output;
    }
}
