import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class MonochromeEdgeDetectorOperation extends TextureOperation {
    multiplier: number = 4096;

    constructor() {
        super(1, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.multiplier = buffer.readUnsignedShort();
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
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
            for (let x = 0; x < textureGenerator.width; x++) {
                const dy = this.multiplier * (nextInput[x] - prevInput[x]);
                const dx =
                    this.multiplier *
                    (input[(x + 1) & textureGenerator.widthMask] -
                        input[(x - 1) & textureGenerator.widthMask]);
                const dx0 = dx >> 12;
                const dy0 = dy >> 12;
                const dySquared = (dy0 * dy0) >> 12;
                const dxSquared = (dx0 * dx0) >> 12;
                const local117 = (Math.sqrt((dySquared + dxSquared + 4096) / 4096.0) * 4096.0) | 0;
                const local128 = local117 == 0 ? 0 : (16777216 / local117) | 0;
                output[x] = 4096 - local128;
            }
        }
        return output;
    }
}
