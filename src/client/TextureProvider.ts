import { brightenRgb } from "./Client";
import { TextureDefinition } from "./fs/definition/TextureDefinition";
import { IndexSync } from "./fs/Index";
import { StoreSync } from "./fs/Store";
import { SpriteLoader } from "./sprite/SpriteLoader";

export class TextureProvider {
    textureIndex: IndexSync<StoreSync>;

    spriteIndex: IndexSync<StoreSync>;

    definitions: Map<number, TextureDefinition>;

    idIndexMap: Map<number, number>;

    constructor(textureIndex: IndexSync<StoreSync>, spriteIndex: IndexSync<StoreSync>, definitions: Map<number, TextureDefinition>) {
        this.textureIndex = textureIndex;
        this.spriteIndex = spriteIndex;
        this.definitions = definitions;
        this.idIndexMap = new Map();
        this.getDefinitions().forEach((def, index) => {
            this.idIndexMap.set(def.id, index);
        })
    }

    public static load(textureIndex: IndexSync<StoreSync>, spriteIndex: IndexSync<StoreSync>): TextureProvider {
        const definitions: Map<number, TextureDefinition> = new Map();

        const texturesArchive = textureIndex.getArchive(0);

        Array.from(texturesArchive.fileIds)
            .forEach(id => {
                const file = texturesArchive.getFile(id);
                if (file) {
                    definitions.set(id, TextureDefinition.decode(file.getDataAsBuffer(), id));
                }
            });

        return new TextureProvider(textureIndex, spriteIndex, definitions);
    }

    getTextureIds(): number[] {
        return Array.from(this.definitions.keys());
    }

    getDefinitions(): TextureDefinition[] {
        return Array.from(this.definitions.values());
    }

    getTextureIndex(id: number): number | undefined {
        return this.idIndexMap.get(id);
    }

    getTextureCount(): number {
        return this.definitions.size;
    }

    getDefinition(id: number): TextureDefinition | undefined {
        return this.definitions.get(id);
    }

    loadFromDef(def: TextureDefinition, brightness: number, size: number): Int32Array {
        const pixelCount = size * size;
        const pixels = new Int32Array(pixelCount);

        for (let i = 0; i < def.spriteIds.length; i++) {
            const sprite = SpriteLoader.loadIntoIndexedSprite(this.spriteIndex, def.spriteIds[i]);
            if (!sprite) {
                throw new Error('Texture references invalid sprite');
            }
            sprite.normalize();

            const palettePixels = sprite.pixels;
            const palette = sprite.palette;
            const transform = def.transforms[i];

            // not used by any texture but who knows
            if ((transform & -0x1000000) == 0x3000000) {
                // red, 0, blue
                const r_b = transform & 0xFF00FF;
                // green
                const green = transform >> 8 & 0xFF;

                for (let pi = 0; pi < palette.length; pi++) {
                    const color = palette[pi];
                    const rg = color >> 8;
                    const gb = color & 0xFFFF;
                    if (rg == gb) {
                        const blue = color & 0xFF;
                        palette[pi] = r_b * blue >> 8 & 0xFF00FF | green * blue & 0xFF00;
                    }
                }
            }

            for (let pi = 0; pi < palette.length; pi++) {
                const alpha = palette[pi] === 0 ? 0 : 0xFF;
                palette[pi] = alpha << 24 | brightenRgb(palette[pi], brightness);
            }

            let index = 0;
            if (i > 0 && def.spriteTypes) {
                index = def.spriteTypes[i - 1];
            }

            if (index === 0) {
                if (size == sprite.subWidth) {
                    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
                        pixels[pixelIndex] = palette[palettePixels[pixelIndex]];
                    }
                } else if (sprite.subWidth == 64 && size == 128) {
                    let pixelIndex = 0;

                    for (let x = 0; x < size; x++) {
                        for (let y = 0; y < size; y++) {
                            pixels[pixelIndex++] = palette[palettePixels[(x >> 1 << 6) + (y >> 1)]];
                        }
                    }
                } else {
                    if (sprite.subWidth != 128 || size != 64) {
                        throw new Error('Texture sprite has unexpected size');
                    }

                    let pixelIndex = 0;

                    for (let x = 0; x < size; x++) {
                        for (let y = 0; y < size; y++) {
                            pixels[pixelIndex++] = palette[palettePixels[(y << 1) + (x << 1 << 7)]];
                        }
                    }
                }
            }
        }

        return pixels;
    }

    load(id: number, brightness: number, size: number): Int32Array | undefined {
        const def = this.definitions.get(id);
        return def && this.loadFromDef(def, brightness, size);
    }

    createTextureArrayImage(brightness: number, size: number): Int32Array {
        const textures = this.getDefinitions();

        const pixelCount = size * size;

        const img = new Int32Array(pixelCount * textures.length);

        textures.forEach((def, index) => {
            img.set(this.loadFromDef(def, brightness, size), pixelCount * index);
        });

        return img;
    }
}
