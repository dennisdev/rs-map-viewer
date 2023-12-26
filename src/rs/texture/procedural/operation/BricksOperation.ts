import JavaRandom from "java-random";

import { nextIntJagex } from "../../../../util/MathUtil";
import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class BricksOperation extends TextureOperation {
    field0 = 4;
    seed = 8;
    field2 = 409;
    field3 = 204;
    field4 = 1024;
    field5 = 0;
    field6 = 81;
    field7 = 1024;

    halfField6 = 0;
    ratio0 = 0;
    ratio1 = 0;

    table0!: Int32Array[];
    table1!: Int32Array[];
    table2!: Int32Array;

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.field0 = buffer.readUnsignedByte();
        } else if (field === 1) {
            this.seed = buffer.readUnsignedByte();
        } else if (field === 2) {
            this.field2 = buffer.readUnsignedShort();
        } else if (field === 3) {
            this.field3 = buffer.readUnsignedShort();
        } else if (field === 4) {
            this.field4 = buffer.readUnsignedShort();
        } else if (field === 5) {
            this.field5 = buffer.readUnsignedShort();
        } else if (field === 6) {
            this.field6 = buffer.readUnsignedShort();
        } else if (field === 7) {
            this.field7 = buffer.readUnsignedShort();
        }
    }

    override init(): void {
        this.table0 = new Array(this.seed);
        this.table1 = new Array(this.seed);
        for (let i = 0; i < this.seed; i++) {
            this.table0[i] = new Int32Array(this.field0);
            this.table1[i] = new Int32Array(this.field0 + 1);
        }
        this.table2 = new Int32Array(this.seed + 1);

        const random = new JavaRandom(this.seed);
        this.halfField6 = (this.field6 / 2) | 0;
        this.ratio0 = (4096 / this.field0) | 0;
        const halfR0 = (this.ratio0 / 2) | 0;
        this.ratio1 = (4096 / this.seed) | 0;
        const halfR1 = (this.ratio1 / 2) | 0;
        this.table2[0] = 0;

        for (let x = 0; x < this.seed; x++) {
            if (x > 0) {
                let value = this.ratio1;
                const randomValue = ((nextIntJagex(random, 4096) - 2048) * this.field3) >> 12;
                value += (randomValue * halfR1) >> 12;
                this.table2[x] = value + this.table2[x - 1];
            }
            this.table1[x][0] = 0;
            for (let y = 0; y < this.field0; y++) {
                if (y > 0) {
                    let value = this.ratio0;
                    const randomValue = ((nextIntJagex(random, 4096) - 2048) * this.field2) >> 12;
                    value += (randomValue * halfR0) >> 12;
                    this.table1[x][y] = this.table1[x][y - 1] + value;
                }
                this.table0[x][y] =
                    this.field7 > 0 ? 4096 - nextIntJagex(random, this.field7) : 4096;
            }

            this.table1[x][this.field0] = 4096;
        }

        this.table2[this.seed] = 4096;
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            // if (1) {
            //     return output;
            // }
            let index0 = 0;
            let value0 = this.field5 + textureGenerator.verticalGradient[line];
            for (; value0 < 0; value0 += 4096);
            for (; value0 > 4096; value0 -= 4096);
            for (; index0 < this.seed; index0++) {
                if (value0 < this.table2[index0]) {
                    break;
                }
            }

            const tv0 = this.table2[index0 - 1];
            const tv1 = this.table2[index0];
            if (value0 > this.halfField6 + tv0 && value0 < tv1 - this.halfField6) {
                for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                    const f4 = index0 % 2 !== 0 ? -this.field4 : this.field4;
                    let index1 = 0;
                    let value1 =
                        ((this.ratio0 * f4) >> 12) + textureGenerator.horizontalGradient[pixel];
                    for (; value1 < 0; value1 += 4096);
                    for (; value1 > 4096; value1 -= 4096);
                    for (; index1 < this.field0; index1++) {
                        if (value1 < this.table1[index0 - 1][index1]) {
                            break;
                        }
                    }

                    const tv2 = this.table1[index0 - 1][index1 - 1];
                    const tv3 = this.table1[index0 - 1][index1];
                    if (tv2 + this.halfField6 < value1 && value1 < tv3 - this.halfField6) {
                        output[pixel] = this.table0[index0 - 1][index1 - 1];
                    } else {
                        output[pixel] = 0;
                    }
                }
            } else {
                output.fill(0, 0, textureGenerator.width);
            }
        }
        return output;
    }
}
