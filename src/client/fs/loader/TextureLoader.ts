import { TextureDefinition } from "../definition/TextureDefinition";
import { SpriteLoader } from "../../sprite/SpriteLoader";
import { brightenRgb, rgbToHsl } from "../../util/ColorUtil";
import { CacheInfo } from "../Types";
import { GenericIndexDat2 } from "../Index";
import { Archive } from "../Archive";
import { IndexedSprite } from "../../sprite/IndexedSprite";

export abstract class TextureLoader {
    public static TEXTURE_SIZE = 128;

    indexAlphaMap: Map<number, boolean> = new Map();

    abstract getTextureCount(): number;

    abstract getTextureId(index: number): number;
    abstract getTextureIndex(id: number): number;

    hasAlpha(id: number): boolean {
        const index = this.getTextureIndex(id);
        if (index === -1) {
            return false;
        }
        const hasAlpha = this.indexAlphaMap.get(index);
        if (hasAlpha !== undefined) {
            return hasAlpha;
        }
        this.loadTexturePixels(index, 1.0, 128);
        return this.indexAlphaMap.get(index) ?? false;
    }

    protected setAlpha(index: number, hasAlpha: boolean) {
        this.indexAlphaMap.set(index, hasAlpha);
    }

    abstract getAnimDirection(index: number): number;
    abstract getAnimSpeed(index: number): number;

    abstract getAverageHsl(id: number): number;

    abstract loadTexturePixels(
        index: number,
        brightness: number,
        size: number
    ): Int32Array;

    loadTextureArrayPixels(
        brightness: number,
        size: number,
        includeWhiteTexture: boolean
    ): Int32Array {
        const pixelCount = size * size;

        const textureCount = this.getTextureCount();

        let pixelOffset = 0;
        let totalPixelCount = pixelCount * textureCount;
        if (includeWhiteTexture) {
            pixelOffset = pixelCount;
            totalPixelCount += pixelCount;
        }

        const img = new Int32Array(totalPixelCount);

        if (includeWhiteTexture) {
            img.fill(0xffffffff, 0, pixelCount);
        }

        for (let i = 0; i < textureCount; i++) {
            img.set(
                this.loadTexturePixels(i, brightness, size),
                pixelOffset + pixelCount * i
            );
        }

        return img;
    }
}

export class TextureDatLoader extends TextureLoader {
    static ANIMATED_TEXTURE_IDS = new Set([17, 24, 34, 40]);

    textureArchive: Archive;

    textureSprites: IndexedSprite[];

    idAverageHslMap: Map<number, number>;

    constructor(textureArchive: Archive) {
        super();
        this.textureArchive = textureArchive;
        this.textureSprites = new Array(this.getTextureCount());
        this.idAverageHslMap = new Map();
    }

    override getTextureCount(): number {
        // one is for index.dat
        return this.textureArchive.fileCount - 1;
    }

    override getTextureIndex(id: number): number {
        return id;
    }

    override getTextureId(index: number): number {
        return index;
    }

    override getAnimDirection(index: number): number {
        if (TextureDatLoader.ANIMATED_TEXTURE_IDS.has(index)) {
            return 1;
        }
        return 0;
    }

    override getAnimSpeed(index: number): number {
        if (TextureDatLoader.ANIMATED_TEXTURE_IDS.has(index)) {
            return 1;
        }
        return 0;
    }

    override getAverageHsl(id: number): number {
        let averageHsl = this.idAverageHslMap.get(id);
        if (averageHsl !== undefined) {
            return averageHsl;
        }

        const sprite = this.loadTextureIndexedSprite(this.getTextureIndex(id));

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
            ((red / colourCount) << 16) +
            ((green / colourCount) << 8) +
            ((blue / colourCount) | 0);

        averageHsl = rgbToHsl(averageRgb);
        this.idAverageHslMap.set(id, averageHsl);

        return averageHsl;
    }

    loadTextureIndexedSprite(index: number): IndexedSprite {
        let sprite = this.textureSprites[index];
        if (!sprite) {
            sprite = this.textureSprites[index] =
                SpriteLoader.loadIndexedSpriteDat(
                    this.textureArchive,
                    index.toString(),
                    0
                );
            sprite.normalize();

            const palette = sprite.palette;

            const alphaPaletteIndices: Set<number> = new Set();
            for (let pi = 0; pi < palette.length; pi++) {
                if (palette[pi] === 0) {
                    alphaPaletteIndices.add(pi);
                }
            }

            const isAlpha =
                sprite.pixels.find((pi) => alphaPaletteIndices.has(pi)) !==
                undefined;

            this.setAlpha(index, isAlpha);
        }
        return sprite;
    }

    override loadTexturePixels(
        index: number,
        brightness: number,
        size: number
    ): Int32Array {
        const sprite = this.loadTextureIndexedSprite(index);

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
                    const paletteIndex =
                        palettePixels[((x >> 1) << 6) + (y >> 1)];
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
                    const paletteIndex =
                        palettePixels[(y << 1) + ((x << 1) << 7)];
                    pixels[pixelIndex++] = palette[paletteIndex];
                }
            }
        }

        return pixels;
    }
}

export class TextureDat2Loader extends TextureLoader {
    textureIndex: GenericIndexDat2;
    spriteIndex: GenericIndexDat2;

    definitions: Map<number, TextureDefinition>;

    idIndexMap: Map<number, number>;
    indexIdMap: Map<number, number>;

    public static load(
        textureIndex: GenericIndexDat2,
        spriteIndex: GenericIndexDat2,
        cacheInfo: CacheInfo
    ): TextureDat2Loader {
        const definitions: Map<number, TextureDefinition> = new Map();

        // TODO: Load newer revision textures
        if (
            cacheInfo.game === "oldschool" ||
            (cacheInfo.game === "runescape" && cacheInfo.revision < 474)
        ) {
            const texturesArchive = textureIndex.getArchive(0);

            Array.from(texturesArchive.fileIds).forEach((id) => {
                const file = texturesArchive.getFile(id);
                if (file) {
                    definitions.set(
                        id,
                        TextureDefinition.decode(file.getDataAsBuffer(), id)
                    );
                }
            });
        }

        return new TextureDat2Loader(textureIndex, spriteIndex, definitions);
    }

    constructor(
        textureIndex: GenericIndexDat2,
        spriteIndex: GenericIndexDat2,
        definitions: Map<number, TextureDefinition>
    ) {
        super();
        this.textureIndex = textureIndex;
        this.spriteIndex = spriteIndex;
        this.definitions = definitions;
        this.idIndexMap = new Map();
        this.indexIdMap = new Map();
        this.getDefinitions().forEach((def, index) => {
            this.idIndexMap.set(def.id, index);
            this.indexIdMap.set(index, def.id);
        });
    }

    getTextureIds(): number[] {
        return Array.from(this.definitions.keys());
    }

    getDefinitions(): TextureDefinition[] {
        return Array.from(this.definitions.values());
    }

    getDefinition(id: number): TextureDefinition | undefined {
        return this.definitions.get(id);
    }

    override getTextureCount(): number {
        return this.definitions.size;
    }

    override getTextureIndex(id: number): number {
        return this.idIndexMap.get(id) ?? -1;
    }

    override getTextureId(index: number): number {
        return this.indexIdMap.get(index) ?? -1;
    }

    override getAnimDirection(index: number): number {
        return (
            this.getDefinition(this.getTextureId(index))?.animationDirection ??
            0
        );
    }

    override getAnimSpeed(index: number): number {
        return (
            this.getDefinition(this.getTextureId(index))?.animationSpeed ?? 0
        );
    }

    override getAverageHsl(id: number): number {
        return this.getDefinition(id)?.averageHsl ?? 0;
    }

    override loadTexturePixels(
        index: number,
        brightness: number,
        size: number
    ): Int32Array {
        const def = this.getDefinition(this.getTextureId(index));
        if (!def) {
            throw new Error("Texture definition not found: " + index);
        }

        const pixelCount = size * size;
        const pixels = new Int32Array(pixelCount);

        let alphaPixelCount: number = 0;

        for (let i = 0; i < def.spriteIds.length; i++) {
            const sprite = SpriteLoader.loadIntoIndexedSprite(
                this.spriteIndex,
                def.spriteIds[i]
            );
            if (!sprite) {
                throw new Error("Texture references invalid sprite");
            }
            sprite.normalize();

            const palettePixels = sprite.pixels;
            const palette = sprite.palette;
            const transform = def.transforms[i];

            // not used by any texture but who knows
            if ((transform & -0x1000000) === 0x3000000) {
                // red, 0, blue
                const r_b = transform & 0xff00ff;
                // green
                const green = (transform >> 8) & 0xff;

                for (let pi = 0; pi < palette.length; pi++) {
                    const color = palette[pi];
                    const rg = color >> 8;
                    const gb = color & 0xffff;
                    if (rg === gb) {
                        const blue = color & 0xff;
                        palette[pi] =
                            (((r_b * blue) >> 8) & 0xff00ff) |
                            ((green * blue) & 0xff00);
                    }
                }
            }

            const alphaPaletteIndices: Set<number> = new Set();
            for (let pi = 0; pi < palette.length; pi++) {
                let alpha = 0xff;
                if (palette[pi] === 0) {
                    alpha = 0;
                    alphaPaletteIndices.add(pi);
                }
                palette[pi] =
                    (alpha << 24) | brightenRgb(palette[pi], brightness);
            }

            let index = 0;
            if (i > 0 && def.spriteTypes) {
                index = def.spriteTypes[i - 1];
            }

            if (index === 0) {
                if (size === sprite.subWidth) {
                    for (
                        let pixelIndex = 0;
                        pixelIndex < pixelCount;
                        pixelIndex++
                    ) {
                        const paletteIndex = palettePixels[pixelIndex];
                        if (alphaPaletteIndices.has(paletteIndex)) {
                            alphaPixelCount++;
                        }
                        pixels[pixelIndex] = palette[paletteIndex];
                    }
                } else if (sprite.subWidth === 64 && size === 128) {
                    let pixelIndex = 0;

                    for (let x = 0; x < size; x++) {
                        for (let y = 0; y < size; y++) {
                            const paletteIndex =
                                palettePixels[((x >> 1) << 6) + (y >> 1)];
                            if (alphaPaletteIndices.has(paletteIndex)) {
                                alphaPixelCount++;
                            }
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
                            const paletteIndex =
                                palettePixels[(y << 1) + ((x << 1) << 7)];
                            if (alphaPaletteIndices.has(paletteIndex)) {
                                alphaPixelCount++;
                            }
                            pixels[pixelIndex++] = palette[paletteIndex];
                        }
                    }
                }
            }
        }

        this.setAlpha(index, alphaPixelCount > 0);

        return pixels;
    }
}
