import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class SquareWaveformOperation extends TextureOperation {
    field0 = 10;
    field1 = 2048;
    field2 = 0;

    table0!: Int32Array;
    table1!: Int32Array;

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.field0 = buffer.readUnsignedByte();
        } else if (field === 1) {
            this.field1 = buffer.readUnsignedShort();
        } else if (field === 2) {
            this.field2 = buffer.readUnsignedByte();
        }
    }

    override init() {
        this.table0 = new Int32Array(this.field0 + 1);
        this.table1 = new Int32Array(this.field0 + 1);

        let i = 0;
        let j = (4096 / this.field0) | 0;
        let k = (j * this.field1) >> 12;
        for (let l = 0; l < this.field0; l++) {
            this.table1[l] = i;
            this.table0[l] = i + k;
            i += j;
        }
        this.table1[this.field0] = 4096;
        this.table0[this.field0] = this.table0[0] + 4096;
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const verticalGradient = textureGenerator.verticalGradient[line];
            if (this.field2 === 0) {
                let value = 0;
                for (let i = 0; i < this.field0; i++) {
                    if (
                        verticalGradient >= this.table1[i] &&
                        verticalGradient < this.table1[i + 1]
                    ) {
                        if (verticalGradient < this.table0[i]) {
                            value = 4096;
                        }
                        break;
                    }
                }

                output.fill(value, 0, textureGenerator.width);
            } else {
                for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                    let index = 0;
                    let value = 0;
                    const horizontalGradient = textureGenerator.horizontalGradient[pixel];
                    switch (this.field2) {
                        case 3:
                            index = ((horizontalGradient - verticalGradient) >> 1) + 2048;
                            break;
                        case 2:
                            index = ((horizontalGradient - (4096 - verticalGradient)) >> 1) + 2048;
                            break;
                        case 1:
                            index = horizontalGradient;
                            break;
                    }
                    for (let i = 0; i < this.field0; i++) {
                        if (index >= this.table1[i] && index < this.table1[i + 1]) {
                            if (index < this.table0[i]) {
                                value = 4096;
                            }
                            break;
                        }
                    }
                    output[pixel] = value;
                }
            }
        }
        return output;
    }
}
