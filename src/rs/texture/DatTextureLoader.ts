import { Archive } from "../cache/Archive";
import { IndexedSprite } from "../sprite/IndexedSprite";
import { SpriteLoader } from "../sprite/SpriteLoader";
import { brightenRgb, rgbToHsl } from "../util/ColorUtil";
import { TextureLoader } from "./TextureLoader";

export class DatTextureLoader implements TextureLoader {
    static WATER_DROPLETS_TEXTURE_ID = 17;

    animatedTextureIds: Set<number>;

    textureIds: number[];

    textureSprites: IndexedSprite[];

    idAverageHslMap: Map<number, number>;
    transparentTextureMap: Map<number, boolean> = new Map();

    constructor(
        readonly textureArchive: Archive,
        animatedTextureIds: number[],
    ) {
        this.animatedTextureIds = new Set(animatedTextureIds);
        this.textureIds = new Array(this.getTextureCount());
        for (let i = 0; i < this.textureIds.length; i++) {
            this.textureIds[i] = i;
        }
        this.textureSprites = new Array(this.getLastTextureId());
        this.idAverageHslMap = new Map();
    }

    getTextureIds(): number[] {
        return this.textureIds;
    }

    getTextureIndex(id: number): number {
        return id;
    }

    getTextureCount(): number {
        // one is for index.dat
        return this.textureArchive.fileCount - 1;
    }

    getLastTextureId(): number {
        return this.getTextureCount() - 1;
    }

    isSd(id: number): boolean {
        return true;
    }

    isSmall(id: number): boolean {
        return this.loadTextureSprite(id).subWidth === 64;
    }

    isTransparent(id: number): boolean {
        this.loadTextureSprite(id);
        return this.transparentTextureMap.get(id) ?? false;
    }

    getAverageHsl(id: number): number {
        let averageHsl = this.idAverageHslMap.get(id);
        if (averageHsl !== undefined) {
            return averageHsl;
        }

        const sprite = this.loadTextureSprite(id);

        let red = 0;
        let green = 0;
        let blue = 0;

        const colourCount = sprite.palette.length;
        for (let i = 0; i < colourCount; i++) {
            red += (sprite.palette[i] >> 16) & 0xff;
            green += (sprite.palette[i] >> 8) & 0xff;
            blue += sprite.palette[i] & 0xff;
        }

        const averageRgb =
            ((red / colourCount) << 16) + ((green / colourCount) << 8) + ((blue / colourCount) | 0);

        averageHsl = rgbToHsl(averageRgb);

        this.idAverageHslMap.set(id, averageHsl);

        return averageHsl;
    }

    getAnimationUv(id: number): [number, number] {
        if (this.animatedTextureIds.has(id)) {
            return [0, -1];
        }
        return [0, 0];
    }

    getPixelsRgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array {
        const sprite = this.loadTextureSprite(id);

        const palettePixels = sprite.pixels;
        const palette = sprite.palette;

        for (let pi = 0; pi < palette.length; pi++) {
            let alpha = 0xff;
            if (palette[pi] === 0) {
                alpha = 0;
            }
            palette[pi] = (alpha << 24) | brightenRgb(palette[pi], brightness);
        }

        const pixelCount = size * size;
        const pixels = new Int32Array(pixelCount);

        if (size === sprite.subWidth) {
            for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
                const paletteIndex = palettePixels[pixelIndex];
                pixels[pixelIndex] = palette[paletteIndex];
            }
        } else if (sprite.subWidth === 64 && size === 128) {
            let pixelIndex = 0;

            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    const paletteIndex = palettePixels[((x >> 1) << 6) + (y >> 1)];
                    pixels[pixelIndex++] = palette[paletteIndex];
                }
            }
        } else {
            if (sprite.subWidth !== 128 || size !== 64) {
                throw new Error("Texture sprite has unexpected size");
            }

            let pixelIndex = 0;

            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    const paletteIndex = palettePixels[(y << 1) + ((x << 1) << 7)];
                    pixels[pixelIndex++] = palette[paletteIndex];
                }
            }
        }

        return pixels;
    }

    getPixelsArgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array {
        return this.getPixelsRgb(id, size, flipH, brightness);
    }

    loadTextureSprite(id: number): IndexedSprite {
        let sprite = this.textureSprites[id];
        if (!sprite) {
            sprite = this.textureSprites[id] = SpriteLoader.loadIndexedSpriteDat(
                this.textureArchive,
                id.toString(),
                0,
            );
            sprite.normalize();

            const palette = sprite.palette;

            const alphaPaletteIndices: Set<number> = new Set();
            for (let pi = 0; pi < palette.length; pi++) {
                if (palette[pi] === 0) {
                    alphaPaletteIndices.add(pi);
                }
            }

            const isTransparent =
                sprite.pixels.findIndex((pi) => alphaPaletteIndices.has(pi)) !== -1;

            this.transparentTextureMap.set(id, isTransparent);
        }
        return sprite;
    }
}
