import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition } from "./Definition";

export class UnderlayDefinition extends Definition {
    public rgbColor: number;

    public hue: number;
    public saturation: number;
    public lightness: number;
    public hueMultiplier: number;

    constructor(id: number) {
        super(id);
        this.rgbColor = 0;
        this.hue = 0;
        this.saturation = 0;
        this.lightness = 0;
        this.hueMultiplier = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.rgbColor = buffer.readMedium();
        }
    }

    override post(): void {
        this.setHsl(this.rgbColor);
    }

    setHsl(rgb: number) {
        const d = ((rgb >> 16) & 0xff) / 256.0;
        const d_1_ = ((rgb >> 8) & 0xff) / 256.0;
        const d_2_ = (rgb & 0xff) / 256.0;

        let d_3_ = d;
        if (d_1_ < d_3_) {
            d_3_ = d_1_;
        }
        if (d_2_ < d_3_) {
            d_3_ = d_2_;
        }

        let d_4_ = d;
        if (d_1_ > d_4_) {
            d_4_ = d_1_;
        }
        if (d_2_ > d_4_) {
            d_4_ = d_2_;
        }

        let d_5_ = 0.0;
        let d_6_ = 0.0;
        const d_7_ = (d_4_ + d_3_) / 2.0;

        if (d_4_ != d_3_) {
            if (d_7_ < 0.5) {
                d_6_ = (d_4_ - d_3_) / (d_4_ + d_3_);
            }

            if (d_7_ >= 0.5) {
                d_6_ = (d_4_ - d_3_) / (2.0 - d_4_ - d_3_);
            }

            if (d_4_ === d) {
                d_5_ = (d_1_ - d_2_) / (d_4_ - d_3_);
            } else if (d_4_ === d_1_) {
                d_5_ = 2.0 + (d_2_ - d) / (d_4_ - d_3_);
            } else if (d_4_ === d_2_) {
                d_5_ = 4.0 + (d - d_1_) / (d_4_ - d_3_);
            }
        }
        d_5_ /= 6.0;
        this.saturation = (d_6_ * 256.0) | 0;
        this.lightness = (d_7_ * 256.0) | 0;
        if (this.saturation < 0) {
            this.saturation = 0;
        } else if (this.saturation > 255) {
            this.saturation = 255;
        }
        if (this.lightness < 0) {
            this.lightness = 0;
        } else if (this.lightness > 255) {
            this.lightness = 255;
        }
        if (d_7_ > 0.5) {
            this.hueMultiplier = (512.0 * (d_6_ * (1.0 - d_7_))) | 0;
        } else {
            this.hueMultiplier = (512.0 * (d_6_ * d_7_)) | 0;
        }
        if (this.hueMultiplier < 1) {
            this.hueMultiplier = 1;
        }
        this.hue = (this.hueMultiplier * d_5_) | 0;
    }
}
