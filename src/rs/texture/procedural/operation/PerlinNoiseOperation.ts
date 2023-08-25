import JavaRandom from "java-random";

import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";
import { ByteBuffer } from "../../../io/ByteBuffer";

export class PerlinNoiseOperation extends TextureOperation {
    static readonly invertTable: number[][] = [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
    ];

    field0 = true;
    field1 = 4;
    field2 = 1638;
    seed = 0;
    field5 = 4;
    field6 = 4;

    noiseInput0!: Int32Array;
    noiseInput1!: Int32Array;

    table = new Int32Array(512);

    static addInvert(x: number, y: number, invert: number[]): number {
        return x * invert[0] + y * invert[1];
    }

    static method1047(n: number): number {
        const i = (((n * n) >> 12) * n) >> 12;
        const j = 6 * n - 61440;
        const k = 40960 + ((j * n) >> 12);
        return (k * i) >> 12;
    }

    static lerp(start: number, end: number, amount: number): number {
        return (start * (4096 - amount) + end * amount) >> 12;
    }

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.field0 = buffer.readUnsignedByte() === 1;
        } else if (field === 1) {
            this.field1 = buffer.readUnsignedByte();
        } else if (field === 2) {
            this.field2 = buffer.readSignedShort();
            if (this.field2 < 0) {
                this.noiseInput0 = new Int32Array(this.field1);
                for (let i = 0; i < this.field1; i++) {
                    this.noiseInput0[i] = buffer.readSignedShort();
                }
            }
        } else if (field === 3) {
            this.field5 = this.field6 = buffer.readUnsignedByte();
        } else if (field === 4) {
            this.seed = buffer.readUnsignedByte();
        } else if (field === 5) {
            this.field5 = buffer.readUnsignedByte();
        } else if (field === 6) {
            this.field6 = buffer.readUnsignedByte();
        }
    }

    override init() {
        this.initTable();
        this.initNoiseInput();
    }

    initTable() {
        const random = new JavaRandom(this.seed);
        this.table.fill(-1, 0, 255);

        for (let i = 0; i < 255; i++) {
            let k: number;
            do {
                k = random.nextInt(255);
            } while (this.table[k] !== -1);
            this.table[k + 255] = this.table[k] = i;
        }
    }

    initNoiseInput() {
        if (this.field2 <= 0) {
            if (this.noiseInput0 && this.noiseInput0.length === this.field1) {
                this.noiseInput1 = new Int32Array(this.field1);
                for (let i = 0; i < this.field1; i++) {
                    this.noiseInput1[i] = (4096 * Math.pow(2, i)) | 0;
                }
            }
        } else {
            this.noiseInput0 = new Int32Array(this.field1);
            this.noiseInput1 = new Int32Array(this.field1);
            for (let i = 0; i < this.field1; i++) {
                this.noiseInput0[i] = (Math.pow(this.field2 / 4096, i) * 4096) | 0;
                this.noiseInput1[i] = (Math.pow(2, i) * 4096) | 0;
            }
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const horizonMult = this.field5 << 12;
            const verticalMult = this.field6 << 12;
            const vertGrad = this.field6 * textureGenerator.verticalGradient[line];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                let sum = 0;
                const horizonGrad = this.field5 * textureGenerator.horizontalGradient[pixel];
                for (let i = 0; i < this.field1; i++) {
                    const l1 = this.noiseInput1[i];
                    const i2 = this.noiseInput0[i];
                    const j2 = this.noise(
                        (horizonGrad * l1) >> 12,
                        (vertGrad * l1) >> 12,
                        (l1 * verticalMult) >> 12,
                        (l1 * horizonMult) >> 12,
                    );
                    sum += (j2 * i2) >> 12;
                }
                if (this.field0) {
                    sum = 2048 + (sum >> 1);
                }
                output[pixel] = sum;
            }
        }
        return output;
    }

    noise(x: number, y: number, verticalGradient: number, horizontalGradient: number): number {
        let k = x & 0xfffff000;
        x -= k;
        let l = y & 0xfffff000;
        y -= l;
        const j1 = verticalGradient & 0xfffff000;
        const i1 = horizontalGradient & 0xfffff000;
        l >>= 12;
        let j = l + 1;
        l &= 0xff;
        k >>= 12;
        let i = k + 1;
        if (i1 >> 12 <= i) {
            i = 0;
        }
        k &= 0xff;
        i &= 0xff;
        if (j >= j1 >> 12) {
            j = 0;
        }
        const i2 = this.table[this.table[l] + i] % 4;
        const k1 = this.table[this.table[l] + k] % 4;
        j &= 0xff;
        const j2 = this.table[this.table[j] + i] % 4;
        const l1 = this.table[this.table[j] + k] % 4;
        const k2 = PerlinNoiseOperation.addInvert(x, y, PerlinNoiseOperation.invertTable[k1]);
        const l2 = PerlinNoiseOperation.addInvert(
            x - 4096,
            y,
            PerlinNoiseOperation.invertTable[i2],
        );
        const i3 = PerlinNoiseOperation.addInvert(
            x,
            y - 4096,
            PerlinNoiseOperation.invertTable[l1],
        );
        const j3 = PerlinNoiseOperation.addInvert(
            x - 4096,
            y - 4096,
            PerlinNoiseOperation.invertTable[j2],
        );
        const k3 = PerlinNoiseOperation.method1047(x);
        const l3 = PerlinNoiseOperation.method1047(y);
        const i4 = PerlinNoiseOperation.lerp(k2, l2, k3);
        const j4 = PerlinNoiseOperation.lerp(i3, j3, k3);
        return PerlinNoiseOperation.lerp(i4, j4, l3);
    }
}
