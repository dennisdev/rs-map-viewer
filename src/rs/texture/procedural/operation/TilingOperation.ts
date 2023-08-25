import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class TilingOperation extends TextureOperation {
    tileCountH: number = 4;
    tileCountV: number = 4;

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        switch (field) {
            case 0:
                this.tileCountH = buffer.readUnsignedByte();
                break;
            case 1:
                this.tileCountV = buffer.readUnsignedByte();
                break;
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const tileW = textureGenerator.width / this.tileCountH;
            const tileH = textureGenerator.height / this.tileCountV;
            let input: Int32Array;
            if (tileH <= 0) {
                input = this.getMonochromeInput(textureGenerator, 0, 0);
            } else {
                const tY = line % tileH;
                input = this.getMonochromeInput(
                    textureGenerator,
                    0,
                    ((textureGenerator.height * tY) / tileH) | 0,
                );
            }
            for (let x = 0; x < textureGenerator.width; x++) {
                if (tileW <= 0) {
                    output[x] = input[0];
                } else {
                    const tX = x % tileW;
                    output[x] = input[((tX * textureGenerator.width) / tileW) | 0];
                }
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
            const tileW = textureGenerator.width / this.tileCountH;
            const tileH = textureGenerator.height / this.tileCountV;
            let input: Int32Array[];
            if (tileH <= 0) {
                input = this.getColourInput(textureGenerator, 0, 0);
            } else {
                const tY = line % tileH;
                input = this.getColourInput(
                    textureGenerator,
                    0,
                    ((textureGenerator.height * tY) / tileH) | 0,
                );
            }
            const inputR = input[0];
            const inputG = input[1];
            const inputB = input[2];
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            for (let x = 0; x < textureGenerator.width; x++) {
                let inputX = 0;
                if (tileW > 0) {
                    const tX = x % tileW;
                    inputX = ((tX * textureGenerator.width) / tileW) | 0;
                }
                outputR[x] = inputR[inputX];
                outputG[x] = inputG[inputX];
                outputB[x] = inputB[inputX];
            }
        }
        return output;
    }
}
