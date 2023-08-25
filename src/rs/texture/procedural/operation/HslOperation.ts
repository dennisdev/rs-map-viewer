import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class HslOperation extends TextureOperation {
    deltaHue = 0;
    deltaSaturation = 0;
    deltaLight = 0;

    hue = 0;
    saturation = 0;
    lightness = 0;

    r = 0;
    g = 0;
    b = 0;

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.deltaHue = buffer.readSignedShort();
        } else if (field === 1) {
            // TODO: check if this is correct
            this.deltaSaturation = ((buffer.readByte() << 12) / 100) | 0;
        } else if (field === 2) {
            this.deltaLight = ((buffer.readByte() << 12) / 100) | 0;
        }
    }

    setHsl(r: number, g: number, b: number): void {
        const maxValue = Math.max(r, g, b);
        const minValue = Math.min(r, g, b);
        const delta = maxValue - minValue;
        this.lightness = ((maxValue + minValue) / 2) | 0;
        if (delta > 0) {
            const invR = ((maxValue - r) << 12) / delta;
            const invG = ((maxValue - g) << 12) / delta;
            const invB = ((maxValue - b) << 12) / delta;
            if (r === maxValue) {
                this.hue = g === minValue ? invB + 0x5000 : 4096 - invG;
            } else if (g === maxValue) {
                this.hue = b === minValue ? invR + 4096 : 0x3000 - invB;
            } else {
                this.hue = minValue === r ? invG + 0x3000 : 0x5000 - invR;
            }
            this.hue = (this.hue / 6) | 0;
        } else {
            this.hue = 0;
        }
        if (this.lightness > 0 && this.lightness < 4096) {
            this.saturation =
                (delta << 12) /
                (this.lightness > 2048 ? 8192 - this.lightness * 2 : this.lightness * 2);
        } else {
            this.saturation = 0;
        }
    }

    setRgb(hue: number, saturation: number, light: number) {
        const i =
            light > 2048
                ? saturation + light - ((saturation * light) >> 12)
                : (light * (4096 + saturation)) >> 12;
        if (i > 0) {
            const j = light - i + light;
            const k = ((i - j) << 12) / i;
            hue *= 6;
            const l = hue >> 12;
            let j1 = i;
            let i1 = hue - (l << 12);
            j1 = (j1 * k) >> 12;
            j1 = (i1 * j1) >> 12;
            const k1 = j + j1;
            const l1 = i - j1;
            if (l === 0) {
                this.r = i;
                this.g = k1;
                this.b = j;
            } else if (l === 1) {
                this.r = l1;
                this.g = i;
                this.b = j;
            } else if (l === 2) {
                this.r = j;
                this.g = i;
                this.b = k1;
            } else if (l === 3) {
                this.r = j;
                this.g = l1;
                this.b = i;
            } else if (l === 4) {
                this.r = k1;
                this.g = j;
                this.b = i;
            } else if (l === 5) {
                this.r = i;
                this.g = j;
                this.b = l1;
            }
        } else {
            this.r = this.g = this.b = light;
        }
    }

    override getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        if (!this.colourImageCache) {
            throw new Error("Colour image cache is not initialized");
        }
        const output = this.colourImageCache.get(line);
        if (this.colourImageCache.dirty) {
            const input = this.getColourInput(textureGenerator, 0, line);
            const inputR = input[0];
            const inputG = input[1];
            const inputB = input[2];
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                this.setHsl(inputR[pixel], inputG[pixel], inputB[pixel]);
                this.hue += this.deltaHue;
                this.saturation += this.deltaSaturation;
                this.lightness += this.deltaLight;
                for (; this.hue < 0; this.hue += 4096) {}
                for (; this.hue > 4096; this.hue -= 4096) {}
                if (this.saturation < 0) {
                    this.saturation = 0;
                }
                if (this.saturation > 4096) {
                    this.saturation = 4096;
                }
                if (this.lightness < 0) {
                    this.lightness = 0;
                }
                if (this.lightness > 4096) {
                    this.lightness = 4096;
                }
                this.setRgb(this.hue, this.saturation, this.lightness);
                outputR[pixel] = this.r;
                outputG[pixel] = this.g;
                outputB[pixel] = this.b;
            }
        }
        return output;
    }
}
