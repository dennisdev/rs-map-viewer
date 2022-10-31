export class SpritePixels {
    pixels!: Int32Array;

    subWidth!: number;

    subHeight!: number;

    xOffset!: number;

    yOffset!: number;

    width!: number;

    height!: number;

    public static fromPixels(pixels: Int32Array, width: number, height: number): SpritePixels {
        const sprite = new SpritePixels();
        sprite.pixels = pixels;
        sprite.subWidth = sprite.width = width;
        sprite.subHeight = sprite.height = height;
        sprite.yOffset = 0;
        sprite.xOffset = 0;
        return sprite;
    }

    public static fromDimensions(width: number, height: number): SpritePixels {
        return this.fromPixels(new Int32Array(width * height), width, height);
    }

    mirrorHorizontally(): SpritePixels {
        const mirrored = SpritePixels.fromDimensions(this.subWidth, this.subHeight);
        mirrored.width = this.width;
        mirrored.height = this.height;
        mirrored.xOffset = this.width - this.subWidth - this.xOffset;
        mirrored.yOffset = this.yOffset;

        for (let y = 0; y < this.subHeight; y++) {
            for (let x = 0; x < this.subWidth; x++) {
                mirrored.pixels[x + y * this.subWidth] = this.pixels[y * this.subWidth + this.subWidth - 1 - x];
            }
        }

        return mirrored;
    }

    copyNormalized(): SpritePixels {
        const normalized = SpritePixels.fromDimensions(this.width, this.height);

        for (let y = 0; y < this.subHeight; y++) {
            for (let x = 0; x < this.subWidth; x++) {
                normalized.pixels[x + (y + this.yOffset) * this.width + this.xOffset] = this.pixels[x + y * this.subWidth];
            }
        }

        return normalized;
    }

    normalize(): void {
        if (this.subWidth != this.width || this.subHeight != this.height) {
            const pixels = new Int32Array(this.width * this.height);

            for (let y = 0; y < this.subHeight; y++) {
                for (let x = 0; x < this.subWidth; x++) {
                    pixels[x + (y + this.yOffset) * this.width + this.xOffset] = this.pixels[x + y * this.subWidth];
                }
            }

            this.pixels = pixels;
            this.subWidth = this.width;
            this.subHeight = this.height;
            this.xOffset = 0;
            this.yOffset = 0;
        }
    }

    pad(padding: number): void {
        if (this.subWidth != this.width || this.subHeight != this.height) {
            let var2 = padding;
            if (padding > this.xOffset) {
                var2 = this.xOffset;
            }

            let var3 = padding;
            if (padding + this.xOffset + this.subWidth > this.width) {
                var3 = this.width - this.xOffset - this.subWidth;
            }

            let var4 = padding;
            if (padding > this.yOffset) {
                var4 = this.yOffset;
            }

            let var5 = padding;
            if (padding + this.yOffset + this.subHeight > this.height) {
                var5 = this.height - this.yOffset - this.subHeight;
            }

            const width = var2 + var3 + this.subWidth;
            const height = var4 + var5 + this.subHeight;
            const pixels = new Int32Array(width * height);

            for (let y = 0; y < this.subHeight; y++) {
                for (let x = 0; x < this.subWidth; x++) {
                    pixels[width * (y + var4) + x + var2] = this.pixels[x + y * this.subWidth];
                }
            }

            this.pixels = pixels;
            this.subWidth = width;
            this.subHeight = height;
            this.xOffset -= var2;
            this.yOffset -= var4;
        }
    }

    flipHorizontally(): void {
        const pixels = new Int32Array(this.subWidth * this.subHeight);
        let index = 0;

        for (let y = 0; y < this.subHeight; y++) {
            for (let x = this.subWidth - 1; x >= 0; x--) {
                pixels[index++] = this.pixels[x + y * this.subWidth];
            }
        }

        this.pixels = pixels;
        this.xOffset = this.width - this.subWidth - this.xOffset;
    }

    flipVertically(): void {
        const pixels = new Int32Array(this.subWidth * this.subHeight);
        let index = 0;

        for (let y = this.subHeight - 1; y >= 0; y--) {
            for (let x = 0; x < this.subWidth; x++) {
                pixels[index++] = this.pixels[x + y * this.subWidth];
            }
        }

        this.pixels = pixels;
        this.yOffset = this.height - this.subHeight - this.yOffset;
    }

    outline(rgb: number): void {
        const pixels = new Int32Array(this.subWidth * this.subHeight);
        let index = 0;

        for (let y = 0; y < this.subHeight; y++) {
            for (let x = 0; x < this.subWidth; x++) {
                let newRgb = this.pixels[index];
                if (newRgb === 0) {
                    if (x > 0 && this.pixels[index - 1] !== 0) {
                        newRgb = rgb;
                    } else if (y > 0 && this.pixels[index - this.subWidth] !== 0) {
                        newRgb = rgb;
                    } else if (x < this.subWidth - 1 && this.pixels[index + 1] !== 0) {
                        newRgb = rgb;
                    } else if (y < this.subHeight - 1 && this.pixels[index + this.subWidth] !== 0) {
                        newRgb = rgb;
                    }
                }

                pixels[index++] = newRgb;
            }
        }

        this.pixels = pixels;
    }

    shadow(rgb: number): void {
        for (let y = this.subHeight - 1; y > 0; y--) {
            const yOffset = y * this.subWidth;

            for (let x = this.subWidth - 1; x > 0; x--) {
                if (this.pixels[x + yOffset] === 0 && this.pixels[x + yOffset - 1 - this.subWidth] !== 0) {
                    this.pixels[x + yOffset] = rgb;
                }
            }
        }
    }
}
