import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { Type } from "../Type";
import { FloorType } from "./FloorType";

export class UnderlayFloorType extends Type implements FloorType {
    rgbColor: number;

    hue: number;
    saturation: number;
    lightness: number;
    hueMultiplier: number;

    isOverlay: boolean;

    textureId: number;
    textureSize: number;
    blockShadow: boolean;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.rgbColor = 0;
        this.hue = 0;
        this.saturation = 0;
        this.lightness = 0;
        this.hueMultiplier = 0;
        this.isOverlay = false;
        this.textureId = -1;
        this.textureSize = 128;
        this.blockShadow = true;
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
        } else if (opcode === 2) {
            this.textureId = buffer.readUnsignedShort();
            if (this.textureId === 0xffff) {
                this.textureId = -1;
            }
        } else if (opcode === 3) {
            this.textureSize = buffer.readUnsignedShort();
        } else if (opcode === 4) {
            this.blockShadow = false;
        } else if (opcode === 5) {
            // this.blockShadow = false;
        } else {
            throw new Error(
                "UnderlayFloorType: Opcode " + opcode + " not implemented. id: " + this.id,
            );
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
