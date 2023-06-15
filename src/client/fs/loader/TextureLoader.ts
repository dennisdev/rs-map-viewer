import { TextureDefinition } from "../definition/TextureDefinition";
import { IndexSync } from "../Index";
import { StoreSync } from "../Store";
import { SpriteLoader } from "../../sprite/SpriteLoader";
import { brightenRgb } from "../../util/ColorUtil";
import { CacheInfo } from "../../../mapviewer/CacheInfo";

export class TextureLoader {
    textureIndex: IndexSync<StoreSync>;

    spriteIndex: IndexSync<StoreSync>;

    definitions: Map<number, TextureDefinition>;

    idIndexMap: Map<number, number>;
    indexIdMap: Map<number, number>;

    idAlphaMap: Map<number, boolean>;

    constructor(
        textureIndex: IndexSync<StoreSync>,
        spriteIndex: IndexSync<StoreSync>,
        definitions: Map<number, TextureDefinition>
    ) {
        this.textureIndex = textureIndex;
        this.spriteIndex = spriteIndex;
        this.definitions = definitions;
        this.idIndexMap = new Map();
        this.indexIdMap = new Map();
        this.getDefinitions().forEach((def, index) => {
            this.idIndexMap.set(def.id, index);
            this.indexIdMap.set(index, def.id);
        });
        this.idAlphaMap = new Map();
    }

    public static load(
        textureIndex: IndexSync<StoreSync>,
        spriteIndex: IndexSync<StoreSync>,
        cacheInfo: CacheInfo
    ): TextureLoader {
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

        return new TextureLoader(textureIndex, spriteIndex, definitions);
    }

    getTextureIds(): number[] {
        return Array.from(this.definitions.keys());
    }

    getDefinitions(): TextureDefinition[] {
        return Array.from(this.definitions.values());
    }

    getTextureIndex(id: number): number {
        const index = this.idIndexMap.get(id);
        if (index === undefined) {
            return -1;
        }
        return index;
    }

    getTextureCount(): number {
        return this.definitions.size;
    }

    getDefinition(id: number): TextureDefinition | undefined {
        return this.definitions.get(id);
    }

    getAverageHsl(id: number): number {
        const def = this.getDefinition(id);
        if (def === undefined) {
            return 0;
        }
        return def.averageHsl;
    }

    hasAlpha(id: number): boolean {
        let hasAlpha = this.idAlphaMap.get(id);
        if (hasAlpha === undefined) {
            const def = this.getDefinition(id);
            if (def) {
                this.loadFromDef(def, 1.0, 128);
            }
            return !!this.idAlphaMap.get(id);
        }
        return hasAlpha;
    }

    loadFromDef(
        def: TextureDefinition,
        brightness: number,
        size: number
    ): Int32Array {
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

        this.idAlphaMap.set(def.id, alphaPixelCount > 0);

        return pixels;
    }

    load(id: number, brightness: number, size: number): Int32Array | undefined {
        const def = this.definitions.get(id);
        return def && this.loadFromDef(def, brightness, size);
    }

    createTextureArrayImage(
        brightness: number,
        size: number,
        includeWhiteTexture: boolean
    ): Int32Array {
        const textures = this.getDefinitions();

        const pixelCount = size * size;

        let textureCount = textures.length;
        let pixelOffset = 0;
        if (includeWhiteTexture) {
            textureCount++;
            pixelOffset = pixelCount;
        }

        const img = new Int32Array(pixelCount * textureCount);

        img.set(new Int32Array(pixelCount).fill(0xffffffff), 0);

        textures.forEach((def, index) => {
            img.set(
                this.loadFromDef(def, brightness, size),
                pixelOffset + pixelCount * index
            );
        });

        return img;
    }
}
