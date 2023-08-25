import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";
import JavaRandom from "java-random";

export class VoronoiNoiseOperation extends TextureOperation {
    rngSeed: number = 0;
    field2: number = 2048;
    field3: number = 2;
    field4: number = 1;
    field5: number = 5;
    field6: number = 5;

    anInt2701: number = 25;

    table!: number[][];

    anInt2705: number = 0;
    anInt2706: number = 0;

    anInt2710: number = 0;

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        switch (field) {
            case 0:
                this.field5 = this.field6 = buffer.readUnsignedByte();
                break;
            case 1:
                this.rngSeed = buffer.readUnsignedByte();
                break;
            case 2:
                this.field2 = buffer.readUnsignedShort();
                break;
            case 3:
                this.field3 = buffer.readUnsignedByte();
                break;
            case 4:
                this.field4 = buffer.readUnsignedByte();
                break;
            case 5:
                this.field5 = buffer.readUnsignedByte();
                break;
            case 6:
                this.field6 = buffer.readUnsignedByte();
                break;
        }
    }

    override init() {
        const random = new JavaRandom(this.rngSeed);
        this.anInt2701 = this.field5 * this.field6;
        this.table = new Array(this.anInt2701);

        const i = (4096 / this.field5) | 0;
        this.anInt2706 = i >> 1;
        const j = (4096 / this.field6) | 0;
        this.anInt2705 = j >> 1;
        const k = (this.anInt2706 * this.field2) >> 12;
        const l = (this.anInt2705 * this.field2) >> 12;

        for (let i1 = 0; i1 < this.field6; i1++) {
            const j1 = i1 * i;
            for (let k1 = 0; k1 < this.field5; k1++) {
                const l1 = k1 + this.field5 * i1;
                const i2 = (k * (random.nextInt(8192) - 4096)) >> 12;
                const j2 = (l * (random.nextInt(8192) - 4096)) >> 12;
                this.table[l1] = [i2 + k1 * i, j2 + j1];
            }
        }

        this.anInt2710 = Math.max(this.field6, this.field5);
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const verticalGradient = textureGenerator.verticalGradient[line];

            if (this.field3 === 2) {
                for (let i = 0; i < textureGenerator.width; i++) {
                    const horizontalGradient = textureGenerator.horizontalGradient[i];
                    const blur = this.blur(2, verticalGradient, horizontalGradient);
                    output[i] = blur[1] - blur[0];
                }
            } else if (this.field3 === 1) {
                for (let i = 0; i < textureGenerator.width; i++) {
                    const horizontalGradient = textureGenerator.horizontalGradient[i];
                    output[i] = this.blur(2, verticalGradient, horizontalGradient)[1];
                }
            } else {
                for (let i = 0; i < textureGenerator.width; i++) {
                    const horizontalGradient = textureGenerator.horizontalGradient[i];
                    output[i] = this.blur(1, verticalGradient, horizontalGradient)[0];
                }
            }
        }
        return output;
    }

    blur(count: number, verticalGradient: number, horizontalGradient: number): Int32Array {
        const output = new Int32Array(count);
        output.fill(0x7fffffff);

        verticalGradient += this.anInt2705;
        if (verticalGradient > 4096) {
            verticalGradient -= 4096;
        }
        horizontalGradient += this.anInt2706;
        if (horizontalGradient > 4096) {
            horizontalGradient -= 4096;
        }
        let j = (horizontalGradient * this.field5) >> 12;
        let k = (verticalGradient * this.field6) >> 12;
        let tableIndex0 = -1;
        let tableIndex1 = -1;
        let k1 = 0x7fffffff;
        let l1 = this.field5 > 2 ? 2 : this.field5 - 1;
        let j1 = 0x7fffffff;
        let i2 = this.field6 > 2 ? 2 : this.field6 - 1;

        for (let j2 = -l1; j2 <= l1; j2++) {
            for (let k2 = -i2; k2 <= i2; k2++) {
                let i3 = j2 + j;
                if (i3 < 0) {
                    i3 += this.field5;
                }
                if (this.field5 <= i3) {
                    i3 -= this.field5;
                }
                let k3 = k + k2;
                if (k3 < 0) {
                    k3 += this.field6;
                }
                if (this.field6 <= k3) {
                    k3 -= this.field6;
                }
                const i4 = i3 + this.field5 * k3;
                const i5 = this.table[i4][1];
                const k4 = this.table[i4][0];
                let k5 = verticalGradient - i5;
                let j5 = horizontalGradient - k4;
                if (k5 < 0) {
                    k5 = -k5;
                }
                if (k5 > 2048) {
                    k5 = 4096 - k5;
                }
                if (j5 < 0) {
                    j5 = -j5;
                }
                if (j5 > 2048) {
                    j5 = 4096 - j5;
                }
                const l5 = (k5 * k5 + j5 * j5) >> 12;
                if (l5 >= j1) {
                    if (
                        (tableIndex1 === tableIndex0 && i4 !== tableIndex0) ||
                        (l5 < k1 && tableIndex1 !== i4)
                    ) {
                        tableIndex0 = i4;
                        k1 = l5;
                    }
                } else {
                    if (tableIndex0 === -1) {
                        k1 = l5;
                        tableIndex0 = i4;
                    } else {
                        k1 = j1;
                        tableIndex0 = tableIndex1;
                    }
                    j1 = l5;
                    tableIndex1 = i4;
                }
            }
        }

        let l2 = horizontalGradient - this.table[tableIndex1][0];
        if (l2 < 0) {
            l2 = -l2;
        }
        if (l2 > 2048) {
            l2 = 4096 - l2;
        }
        let j3 = verticalGradient - this.table[tableIndex1][1];
        if (j3 < 0) {
            j3 = -j3;
        }
        let l3 = horizontalGradient - this.table[tableIndex0][0];
        let j4 = verticalGradient - this.table[tableIndex0][1];
        if (j4 < 0) {
            j4 = -j4;
        }
        if (l3 < 0) {
            l3 = -l3;
        }
        if (j3 > 2048) {
            j3 = 4096 - j3;
        }
        if (l3 > 2048) {
            l3 = 4096 - l3;
        }
        if (j4 > 2048) {
            j4 = 4096 - j4;
        }
        let l4 = this.field4;
        if (l4 === 1) {
            j1 = Math.sqrt(l2 * l2 + j3 * j3) | 0;
            k1 = Math.sqrt(j4 * j4 + l3 * l3) | 0;
        } else if (l4 === 2) {
            j1 = Math.max(l2, j3);
            k1 = Math.max(l3, j4);
        } else {
            k1 = l3 * l3 + j4 * j4;
            j1 = l2 * l2 + j3 * j3;
        }

        output[0] = j1 * this.anInt2710;
        if (count > 1) {
            output[1] = k1 * this.anInt2710;
        }
        return output;
    }
}
