export class IndexedSprite {
    pixels!: Uint8Array;

    palette!: Int32Array;

    subWidth!: number;

    subHeight!: number;

    xOffset!: number;

    yOffset!: number;

    width!: number;

    height!: number;

    normalize(): void {
        if (this.subWidth !== this.width || this.subHeight !== this.height) {
			const pixels = new Uint8Array(this.width * this.height); 
			let index = 0; 

			for (let y = 0; y < this.subHeight; y++) { 
				for (let x = 0; x < this.subWidth; x++) { 
					pixels[x + (y + this.yOffset) * this.width + this.xOffset] = this.pixels[index++]; 
				}
			}

			this.pixels = pixels; 
			this.subWidth = this.width; 
			this.subHeight = this.height;
			this.xOffset = 0; 
			this.yOffset = 0; 
		}
    }

    shiftColors(rOffset: number, gOffset: number, bOffset: number): void {
        for (let i = 0; i < this.palette.length; i++) { 
			let r = this.palette[i] >> 16 & 255; 
			r += rOffset; 
			if (r < 0) { 
				r = 0;
			} else if (r > 255) { 
				r = 255;
			}

			let g = this.palette[i] >> 8 & 255; 
			g += gOffset; 
			if (g < 0) { 
				g = 0;
			} else if (g > 255) { 
				g = 255;
			}

			let b = this.palette[i] & 255; 
			b += bOffset; 
			if (b < 0) { 
				b = 0;
			} else if (b > 255) {
				b = 255;
			}

			this.palette[i] = b + (g << 8) + (r << 16);
		}
    }
}
