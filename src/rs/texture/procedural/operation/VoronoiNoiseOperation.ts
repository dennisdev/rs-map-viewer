import JavaRandom from "java-random";

import { nextIntJagex } from "../../../../util/MathUtil";
import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class VoronoiNoiseOperation extends TextureOperation {
    static temp0: number = 0;
    static temp1: number = 0;
    static temp2: number = 0;
    static temp3: number = 0;

    rngSeed: number = 0;
    field2: number = 2048;
    field3: number = 2;
    field4: number = 1;
    field5: number = 5;
    field6: number = 5;

    permutations: Int8Array = new Int8Array(512);
    randomNs: Int16Array = new Int16Array(512);

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
        this.permutations = TextureGenerator.initPermutations(this.rngSeed);
        this.initRandomNumbers();
    }

    initRandomNumbers(): void {
        const random = new JavaRandom(this.rngSeed);
        this.randomNs = new Int16Array(512);
        if (this.field2 > 0) {
            for (let i = 0; i < 512; i++) {
                this.randomNs[i] = nextIntJagex(random, this.field2);
            }
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const i_1_ = 2048 + this.field6 * textureGenerator.verticalGradient[line];
            const i_2_ = i_1_ >> 12;
            const i_3_ = i_2_ + 1;
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                VoronoiNoiseOperation.temp0 = 2147483647;
                VoronoiNoiseOperation.temp1 = 2147483647;
                VoronoiNoiseOperation.temp2 = 2147483647;
                VoronoiNoiseOperation.temp3 = 2147483647;

                const i_5_ = this.field5 * textureGenerator.horizontalGradient[pixel] + 2048;
                const i_6_ = i_5_ >> 12;
                const i_7_ = i_6_ + 1;
                for (let i_8_ = i_2_ - 1; i_8_ <= i_3_; i_8_++) {
                    const i_9_ =
                        this.permutations[
                            (i_8_ >= this.field6 ? i_8_ - this.field6 : i_8_) & 0xff
                        ] & 0xff;
                    for (let i_10_ = i_6_ - 1; i_10_ <= i_7_; i_10_++) {
                        let i_11_ =
                            (this.permutations[
                                ((i_10_ >= this.field5 ? i_10_ - this.field5 : i_10_) + i_9_) & 0xff
                            ] &
                                0xff) *
                            2;

                        let i_12_ = i_5_ - (this.randomNs[i_11_++] + (i_10_ << 12));
                        let i_13_ = i_1_ - (this.randomNs[i_11_] + (i_8_ << 12));
                        let i_14_: number;
                        switch (this.field4) {
                            case 1:
                                i_14_ = (i_12_ * i_12_ + i_13_ * i_13_) >> 12;
                                break;
                            case 2:
                                i_14_ = (i_13_ < 0 ? -i_13_ : i_13_) + (i_12_ < 0 ? -i_12_ : i_12_);
                                break;
                            case 3:
                                i_12_ = i_12_ < 0 ? -i_12_ : i_12_;
                                i_13_ = i_13_ < 0 ? -i_13_ : i_13_;
                                i_14_ = Math.max(i_12_, i_13_);
                                break;
                            case 4:
                                i_12_ =
                                    (Math.sqrt(Math.fround(i_12_ < 0 ? -i_12_ : i_12_) / 4096.0) *
                                        4096.0) |
                                    0;
                                i_13_ =
                                    (Math.sqrt(Math.fround(i_13_ < 0 ? -i_13_ : i_13_) / 4096.0) *
                                        4096.0) |
                                    0;
                                i_14_ = i_13_ + i_12_;
                                i_14_ = (i_14_ * i_14_) >> 12;
                                break;

                            case 5:
                                i_12_ *= i_12_;
                                i_13_ *= i_13_;
                                i_14_ =
                                    (Math.sqrt(
                                        Math.sqrt(Math.fround((i_12_ + i_13_) / 1.6777216e7)),
                                    ) *
                                        4096.0) |
                                    0;
                                break;
                            default:
                                i_14_ =
                                    (Math.sqrt(
                                        Math.fround((i_13_ * i_13_ + i_12_ * i_12_) / 1.6777216e7),
                                    ) *
                                        4096.0) |
                                    0;
                                break;
                        }

                        if (i_14_ < VoronoiNoiseOperation.temp3) {
                            VoronoiNoiseOperation.temp0 = VoronoiNoiseOperation.temp1;
                            VoronoiNoiseOperation.temp1 = VoronoiNoiseOperation.temp2;
                            VoronoiNoiseOperation.temp2 = VoronoiNoiseOperation.temp3;
                            VoronoiNoiseOperation.temp3 = i_14_;
                        } else if (i_14_ < VoronoiNoiseOperation.temp2) {
                            VoronoiNoiseOperation.temp0 = VoronoiNoiseOperation.temp1;
                            VoronoiNoiseOperation.temp1 = VoronoiNoiseOperation.temp2;
                            VoronoiNoiseOperation.temp2 = i_14_;
                        } else if (i_14_ < VoronoiNoiseOperation.temp1) {
                            VoronoiNoiseOperation.temp0 = VoronoiNoiseOperation.temp1;
                            VoronoiNoiseOperation.temp1 = i_14_;
                        } else if (i_14_ < VoronoiNoiseOperation.temp0) {
                            VoronoiNoiseOperation.temp0 = i_14_;
                        }
                    }
                }

                switch (this.field3) {
                    case 0:
                        output[pixel] = VoronoiNoiseOperation.temp3;
                        break;
                    case 1:
                        output[pixel] = VoronoiNoiseOperation.temp2;
                        break;
                    case 2:
                        output[pixel] = VoronoiNoiseOperation.temp2 - VoronoiNoiseOperation.temp3;
                        break;
                    case 3:
                        output[pixel] = VoronoiNoiseOperation.temp1;
                        break;
                    case 4:
                        output[pixel] = VoronoiNoiseOperation.temp0;
                        break;
                }
            }
        }
        return output;
    }
}
