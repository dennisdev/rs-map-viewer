import { ByteBuffer } from "../../../util/ByteBuffer";
import { CacheInfo } from "../../Types";
import { Definition } from "../Definition";
import { FloorDefinition } from "./FloorDefinition";

export class UnderlayDefinition extends Definition implements FloorDefinition {
    public rgbColor: number;

    public hue: number;
    public saturation: number;
    public lightness: number;
    public hueMultiplier: number;

    public isOverlay: boolean;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.rgbColor = 0;
        this.hue = 0;
        this.saturation = 0;
        this.lightness = 0;
        this.hueMultiplier = 0;
        this.isOverlay = false;
    }

    getHueBlend(): number {
        return this.hue;
    }

    getHueMultiplier(): number {
        return this.hueMultiplier;
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
        const r = ((rgb >> 16) & 0xff) / 256.0;
        const g = ((rgb >> 8) & 0xff) / 256.0;
        const b = (rgb & 0xff) / 256.0;

        let minRgb = r;
        if (g < minRgb) {
            minRgb = g;
        }
        if (b < minRgb) {
            minRgb = b;
        }

        let maxRgb = r;
        if (g > maxRgb) {
            maxRgb = g;
        }
        if (b > maxRgb) {
            maxRgb = b;
        }

        let hue = 0.0;
        let sat = 0.0;
        const light = (maxRgb + minRgb) / 2.0;

        if (maxRgb !== minRgb) {
            if (light < 0.5) {
                sat = (maxRgb - minRgb) / (maxRgb + minRgb);
            }

            if (light >= 0.5) {
                sat = (maxRgb - minRgb) / (2.0 - maxRgb - minRgb);
            }

            if (maxRgb === r) {
                hue = (g - b) / (maxRgb - minRgb);
            } else if (maxRgb === g) {
                hue = 2.0 + (b - r) / (maxRgb - minRgb);
            } else if (maxRgb === b) {
                hue = 4.0 + (r - g) / (maxRgb - minRgb);
            }
        }
        hue /= 6.0;
        this.saturation = (sat * 256.0) | 0;
        this.lightness = (light * 256.0) | 0;
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
        if (light > 0.5) {
            this.hueMultiplier = (512.0 * (sat * (1.0 - light))) | 0;
        } else {
            this.hueMultiplier = (512.0 * (sat * light)) | 0;
        }
        if (this.hueMultiplier < 1) {
            this.hueMultiplier = 1;
        }
        this.hue = (this.hueMultiplier * hue) | 0;
    }
}
