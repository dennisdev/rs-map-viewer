import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition } from "./Definition";


export class OverlayDefinition extends Definition {
    primaryRgb: number;

    textureId: number;

    hideUnderlay: boolean;

    secondaryRgb: number;

    hue: number;
    saturation: number;
    lightness: number;

    secondaryHue: number;
    secondarySaturation: number;
    secondaryLightness: number;

    constructor(id: number) {
        super(id);
        this.primaryRgb = 0;
        this.textureId = -1;
        this.hideUnderlay = true;
        this.secondaryRgb = -1;
        this.hue = 0;
        this.saturation = 0;
        this.lightness = 0;
        this.secondaryHue = 0;
        this.secondarySaturation = 0;
        this.secondaryLightness = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (1 == opcode) {
            this.primaryRgb = buffer.readMedium();
        } else if (2 == opcode) {
            this.textureId = buffer.readUnsignedByte();
        } else if (opcode == 5) {
            this.hideUnderlay = false;
        } else if (7 == opcode) {
            this.secondaryRgb = buffer.readMedium();
        } else if (8 == opcode) {
            
        }
    }

    override post(): void {
		if (this.secondaryRgb != -1) {
			this.setHsl(this.secondaryRgb);
			this.secondaryHue = this.hue;
			this.secondarySaturation = this.saturation;
			this.secondaryLightness = this.lightness;
		}

		this.setHsl(this.primaryRgb);
    }

    setHsl(rgb: number): void {
        const var2 = (rgb >> 16 & 255) / 256.0;
		const var4 = (rgb >> 8 & 255) / 256.0;
		const var6 = (rgb & 255) / 256.0;
		let var8 = var2;
		if (var4 < var2) {
			var8 = var4;
		}

		if (var6 < var8) {
			var8 = var6;
		}

		let var10 = var2; 
		if (var4 > var2) { 
			var10 = var4;
		}

		if (var6 > var10) { 
			var10 = var6;
		}

		let var12 = 0.0; 
		let var14 = 0.0; 
		let var16 = (var8 + var10) / 2.0;
		if (var8 != var10) {
			if (var16 < 0.5) { 
				var14 = (var10 - var8) / (var8 + var10);
			}

			if (var16 >= 0.5) { 
				var14 = (var10 - var8) / (2.0 - var10 - var8);
			}

			if (var10 == var2) { 
				var12 = (var4 - var6) / (var10 - var8);
			} else if (var10 == var4) { 
				var12 = 2.0 + (var6 - var2) / (var10 - var8);
			} else if (var10 == var6) {
				var12 = 4.0 + (var2 - var4) / (var10 - var8);
			}
		}

		var12 /= 6.0;
		this.hue = (var12 * 256.0) | 0;
		this.saturation = (var14 * 256.0) | 0;
		this.lightness = (var16 * 256.0) | 0;
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
    }
}
