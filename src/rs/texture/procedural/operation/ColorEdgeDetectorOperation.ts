import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class ColorEdgeDetectorOperation extends TextureOperation {
    multiplier: number = 4096;

    field1: boolean = true;

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 1) {
            this.multiplier = buffer.readUnsignedShort();
        } else if (field === 2) {
            this.field1 = buffer.readUnsignedByte() === 1;
        }
    }

    override getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        if (!this.colourImageCache) {
            throw new Error("Colour image cache is not initialized");
        }
        const output = this.colourImageCache.get(line);
        if (this.colourImageCache.dirty) {
            const prevInput = this.getMonochromeInput(
                textureGenerator,
                0,
                (line - 1) & textureGenerator.heightMask,
            );
            const input = this.getMonochromeInput(textureGenerator, 0, line);
            const nextInput = this.getMonochromeInput(
                textureGenerator,
                0,
                (line + 1) & textureGenerator.heightMask,
            );
            const inputR = input[0];
            const inputG = input[1];
            const inputB = input[2];
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            for (let x = 0; x < textureGenerator.width; x++) {
                const dy = this.multiplier * (nextInput[x] - prevInput[x]);
                const dx =
                    this.multiplier *
                    (input[(x + 1) & textureGenerator.widthMask] -
                        input[(x - 1) & textureGenerator.widthMask]);
                const dy0 = dy >> 12;
                const dx0 = dx >> 12;
                const dySquared = (dy0 * dy0) >> 12;
                const dxSquared = (dx0 * dx0) >> 12;
                const local137 = (Math.sqrt((dySquared + dxSquared + 4096) / 4096.0) * 4096.0) | 0;
                let red: number;
                let green: number;
                let blue: number;
                if (local137 == 0) {
                    red = 0;
                    green = 0;
                    blue = 0;
                } else {
                    red = (dx / local137) | 0;
                    green = (dy / local137) | 0;
                    blue = (16777216 / local137) | 0;
                }
                if (this.field1) {
                    red = (red >> 1) + 2048;
                    green = (green >> 1) + 2048;
                    blue = (blue >> 1) + 2048;
                }
                outputR[x] = red;
                outputG[x] = green;
                outputB[x] = blue;
            }
        }
        return output;
    }
}
