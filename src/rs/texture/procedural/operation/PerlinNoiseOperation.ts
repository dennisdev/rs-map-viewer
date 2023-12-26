import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class PerlinNoiseOperation extends TextureOperation {
    static readonly invertTable: number[][] = [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
    ];

    static noise: Int32Array = new Int32Array(4096);

    field0 = true;
    field1 = 4;
    field2 = 1638;
    seed = 0;
    field5 = 4;
    field6 = 4;

    noiseInput0!: Int16Array;
    noiseInput1!: Int16Array;

    permutations = new Int8Array(512);

    static initNoise(): void {
        // correct
        for (let i = 0; i < 4096; i++) {
            PerlinNoiseOperation.noise[i] = PerlinNoiseOperation.calcNoise(i);
        }
    }

    static addInvert(x: number, y: number, invert: number[]): number {
        return x * invert[0] + y * invert[1];
    }

    static method1047(n: number): number {
        const i = (((n * n) >> 12) * n) >> 12;
        const j = 6 * n - 61440;
        const k = 40960 + ((j * n) >> 12);
        return (k * i) >> 12;
    }

    static calcNoise(n: number) {
        const i_9_ = (((n * n) >> 12) * n) >> 12;
        const i_10_ = n * 6 - 61440;
        const i_11_ = 40960 + ((n * i_10_) >> 12);
        return (i_9_ * i_11_) >> 12;
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
                this.noiseInput0 = new Int16Array(this.field1);
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
        for (let i = this.field1 - 1; i >= 1; i--) {
            const v = this.noiseInput0[i];
            if (v > 8 || v < -8) {
                break;
            }
            this.field1--;
        }
    }

    initTable() {
        this.permutations = TextureGenerator.initPermutations(this.seed); // correct
    }

    initNoiseInput() {
        if (this.field2 <= 0) {
            if (this.noiseInput0 && this.noiseInput0.length === this.field1) {
                this.noiseInput1 = new Int16Array(this.field1);
                for (let i = 0; i < this.field1; i++) {
                    this.noiseInput1[i] = Math.pow(2, i);
                }
            }
        } else {
            this.noiseInput0 = new Int16Array(this.field1); // correct
            this.noiseInput1 = new Int16Array(this.field1); // correct
            for (let i = 0; i < this.field1; i++) {
                this.noiseInput0[i] = Math.pow(Math.fround(this.field2 / 4096), i) * 4096;
                this.noiseInput1[i] = Math.pow(2, i);
            }
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            this.noise0(textureGenerator, line, output);
        }
        return output;
    }

    noise0(textureGenerator: TextureGenerator, line: number, output: Int32Array): void {
        const vGrad = this.field6 * textureGenerator.verticalGradient[line];
        if (this.field1 === 1) {
            const nin0 = this.noiseInput0[0];
            const nin1 = this.noiseInput1[0] << 12;
            const n1f5 = (nin1 * this.field5) >> 12;
            const n1f6 = (nin1 * this.field6) >> 12;
            let noiseIndex = (nin1 * vGrad) >> 12;
            const permIndex0 = noiseIndex >> 12;
            let permIndex1 = permIndex0 + 1;
            if (n1f6 <= permIndex1) {
                permIndex1 = 0;
            }
            noiseIndex &= 0xfff;
            const noise = PerlinNoiseOperation.noise[noiseIndex];
            const perm0 = this.permutations[permIndex0 & 0xff] & 0xff;
            const perm1 = this.permutations[permIndex1 & 0xff] & 0xff;
            if (this.field0) {
                for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                    const hGrad = this.field5 * textureGenerator.horizontalGradient[pixel];
                    let v = this.noise1(
                        (nin1 * hGrad) >> 12,
                        n1f5,
                        perm0,
                        perm1,
                        noiseIndex,
                        noise,
                    );
                    v = (nin0 * v) >> 12;
                    output[pixel] = (v >> 1) + 2048;
                }
            } else {
                for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                    const hGrad = this.field5 * textureGenerator.horizontalGradient[pixel];
                    const v = this.noise1(
                        (nin1 * hGrad) >> 12,
                        n1f5,
                        perm0,
                        perm1,
                        noiseIndex,
                        noise,
                    );
                    output[pixel] = (v * nin0) >> 12;
                }
            }
        } else {
            let i_45_ = this.noiseInput0[0];
            if (i_45_ > 8 || i_45_ < -8) {
                const i_46_ = this.noiseInput1[0] << 12;
                let i_47_ = (i_46_ * vGrad) >> 12;
                const i_48_ = (i_46_ * this.field5) >> 12;
                const i_49_ = (i_46_ * this.field6) >> 12;
                const i_50_ = i_47_ >> 12;
                let i_51_ = i_50_ + 1;
                i_47_ &= 0xfff;
                if (i_49_ <= i_51_) {
                    i_51_ = 0;
                }
                const i_52_ = this.permutations[i_50_ & 0xff] & 0xff;
                const i_53_ = PerlinNoiseOperation.noise[i_47_];
                const i_54_ = this.permutations[i_51_ & 0xff] & 0xff;
                for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                    const i_56_ = this.field5 * textureGenerator.horizontalGradient[pixel];
                    const i_57_ = this.noise1(
                        (i_56_ * i_46_) >> 12,
                        i_48_,
                        i_52_,
                        i_54_,
                        i_47_,
                        i_53_,
                    );
                    output[pixel] = (i_45_ * i_57_) >> 12;
                }
            }

            for (let i_58_ = 1; i_58_ < this.field1; i_58_++) {
                i_45_ = this.noiseInput0[i_58_];
                if (i_45_ > 8 || i_45_ < -8) {
                    const i_59_ = this.noiseInput1[i_58_] << 12;
                    const i_60_ = (this.field6 * i_59_) >> 12;
                    const i_61_ = (this.field5 * i_59_) >> 12;
                    let i_62_ = (vGrad * i_59_) >> 12;
                    const i_63_ = i_62_ >> 12;
                    let i_64_ = i_63_ + 1;
                    i_62_ &= 0xfff;
                    if (i_60_ <= i_64_) {
                        i_64_ = 0;
                    }
                    const i_65_ = this.permutations[i_64_ & 0xff] & 0xff;
                    const i_66_ = this.permutations[i_63_ & 0xff] & 0xff;
                    const i_67_ = PerlinNoiseOperation.noise[i_62_];
                    if (this.field0 && this.field1 - 1 === i_58_) {
                        for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                            const i_69_ = textureGenerator.horizontalGradient[pixel] * this.field5;
                            let i_70_ = this.noise1(
                                (i_59_ * i_69_) >> 12,
                                i_61_,
                                i_66_,
                                i_65_,
                                i_62_,
                                i_67_,
                            );
                            i_70_ = output[pixel] + ((i_70_ * i_45_) >> 12);
                            output[pixel] = 2048 + (i_70_ >> 1);
                        }
                    } else {
                        for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                            const i_72_ = textureGenerator.horizontalGradient[pixel] * this.field5;
                            const i_73_ = this.noise1(
                                (i_59_ * i_72_) >> 12,
                                i_61_,
                                i_66_,
                                i_65_,
                                i_62_,
                                i_67_,
                            );
                            output[pixel] += (i_45_ * i_73_) >> 12;
                        }
                    }
                }
            }
        }
    }

    noise1(
        hGrad: number,
        vGrad: number,
        perm0: number,
        perm1: number,
        noiseIndex: number,
        noise: number,
    ): number {
        let i_8_ = hGrad >> 12;
        let i_9_ = i_8_ + 1;
        hGrad &= 0xfff;
        if (i_9_ >= vGrad) {
            i_9_ = 0;
        }
        i_8_ &= 0xff;
        let i_10_ = noiseIndex - 4096;
        let i_11_ = hGrad - 4096;
        i_9_ &= 0xff;
        let i_12_ = this.permutations[perm0 + i_8_] & 0x3;
        let i_13_ = PerlinNoiseOperation.noise[hGrad];
        let i_14_;
        if (i_12_ > 1) {
            i_14_ = i_12_ == 2 ? -noiseIndex + hGrad : -noiseIndex + -hGrad;
        } else {
            i_14_ = i_12_ == 0 ? noiseIndex + hGrad : -hGrad + noiseIndex;
        }
        i_12_ = this.permutations[perm0 + i_9_] & 0x3;
        let i_15_: number;
        if (i_12_ <= 1) {
            i_15_ = i_12_ == 0 ? noiseIndex + i_11_ : noiseIndex - i_11_;
        } else {
            i_15_ = i_12_ == 2 ? i_11_ - noiseIndex : -i_11_ + -noiseIndex;
        }
        i_12_ = this.permutations[perm1 + i_8_] & 0x3;
        const i_16_ = ((i_13_ * (i_15_ - i_14_)) >> 12) + i_14_;
        if (i_12_ <= 1) {
            i_14_ = i_12_ != 0 ? i_10_ - hGrad : hGrad + i_10_;
        } else {
            i_14_ = i_12_ != 2 ? -i_10_ + -hGrad : hGrad - i_10_;
        }
        i_12_ = this.permutations[i_9_ + perm1] & 0x3;
        if (i_12_ <= 1) {
            i_15_ = i_12_ == 0 ? i_11_ + i_10_ : i_10_ - i_11_;
        } else {
            i_15_ = i_12_ == 2 ? -i_10_ + i_11_ : -i_10_ + -i_11_;
        }
        const i_17_ = i_14_ + ((i_13_ * (i_15_ - i_14_)) >> 12);
        return i_16_ + ((noise * (i_17_ - i_16_)) >> 12);
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
        const i2 = this.permutations[this.permutations[l] + i] % 4;
        const k1 = this.permutations[this.permutations[l] + k] % 4;
        j &= 0xff;
        const j2 = this.permutations[this.permutations[j] + i] % 4;
        const l1 = this.permutations[this.permutations[j] + k] % 4;
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

PerlinNoiseOperation.initNoise();
