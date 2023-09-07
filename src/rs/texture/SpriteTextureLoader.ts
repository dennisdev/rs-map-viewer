import { CacheIndex } from "../cache/CacheIndex";
import { ByteBuffer } from "../io/ByteBuffer";
import { IndexedSprite } from "../sprite/IndexedSprite";
import { SpriteLoader } from "../sprite/SpriteLoader";
import { brightenRgb } from "../util/ColorUtil";
import { TextureLoader } from "./TextureLoader";
import { TextureMaterial } from "./TextureMaterial";

export class SpriteTextureLoader implements TextureLoader {
    static ANIM_DIRECTION_UV = [
        [0.0, 0.0],
        [0.0, -1.0],
        [-1.0, 0.0],
        [0.0, 1.0],
        [1.0, 0.0],
    ];

    idIndexMap: Map<number, number>;

    transparentTextureMap: Map<number, boolean> = new Map();

    static load(textureIndex: CacheIndex, spriteIndex: CacheIndex): SpriteTextureLoader {
        const definitions = new Map<number, TextureDefinition>();

        const textureArchive = textureIndex.getArchive(0);
        const textureIds = Array.from(textureArchive.fileIds);
        for (let i = 0; i < textureIds.length; i++) {
            const textureId = textureIds[i];
            const file = textureArchive.getFile(textureId);
            if (file) {
                const buffer = file.getDataAsBuffer();
                const definition = TextureDefinition.decode(textureId, buffer);
                definitions.set(textureId, definition);
            }
        }

        return new SpriteTextureLoader(spriteIndex, textureIds, definitions);
    }

    constructor(
        readonly spriteIndex: CacheIndex,
        readonly textureIds: number[],
        readonly definitions: Map<number, TextureDefinition>,
    ) {
        this.idIndexMap = new Map();
        for (let i = 0; i < textureIds.length; i++) {
            this.idIndexMap.set(textureIds[i], i);
        }
    }

    getTextureIds(): number[] {
        return this.textureIds;
    }

    getTextureIndex(id: number): number {
        return this.idIndexMap.get(id) ?? -1;
    }

    isSd(id: number): boolean {
        return true;
    }

    isSmall(id: number): boolean {
        return this.loadTextureSprite(id).subWidth === 64;
    }

    getAverageHsl(id: number): number {
        return this.definitions.get(id)?.averageHsl ?? 0;
    }

    getAnimationUv(id: number): [number, number] {
        const def = this.definitions.get(id);
        if (!def) {
            return [0, 0];
        }

        const direction = def.animationDirection;
        const speed = def.animationSpeed;

        const uv = SpriteTextureLoader.ANIM_DIRECTION_UV[direction];

        return [uv[0] * speed, uv[1] * speed];
    }

    isTransparent(id: number): boolean {
        if (!this.transparentTextureMap.has(id)) {
            if (!this.definitions.has(id)) {
                return false;
            }
            this.getPixelsRgb(id, 128, false, 1.0);
        }
        return this.transparentTextureMap.get(id) ?? false;
    }

    getMaterial(id: number): TextureMaterial {
        const def = this.definitions.get(id);
        if (!def) {
            return {
                animU: 0,
                animV: 0,
                alphaCutOff: 0.1,
            };
        }

        const direction = def.animationDirection;
        const speed = def.animationSpeed;

        const uv = SpriteTextureLoader.ANIM_DIRECTION_UV[direction];

        const animU = uv[0] * speed;
        const animV = uv[1] * speed;

        let alphaCutOff = 0.5;
        if (animU !== 0 || animV !== 0) {
            alphaCutOff = 0.1;
        }

        return {
            animU,
            animV,
            alphaCutOff,
        };
    }

    loadTextureSprite(id: number): IndexedSprite {
        const def = this.definitions.get(id);
        if (!def) {
            throw new Error("Texture definition not found: " + id);
        }

        for (let i = 0; i < def.spriteIds.length; i++) {
            const sprite = SpriteLoader.loadIntoIndexedSprite(this.spriteIndex, def.spriteIds[i]);
            if (!sprite) {
                throw new Error("Texture references invalid sprite");
            }
            sprite.normalize();
            return sprite;
        }
        throw new Error("Texture has no sprites");
    }

    getPixelsRgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array {
        const def = this.definitions.get(id);
        if (!def) {
            throw new Error("Texture definition not found: " + id);
        }

        const pixelCount = size * size;
        const pixels = new Int32Array(pixelCount);

        let alphaPixelCount: number = 0;

        for (let i = 0; i < def.spriteIds.length; i++) {
            const sprite = SpriteLoader.loadIntoIndexedSprite(this.spriteIndex, def.spriteIds[i]);
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
                        palette[pi] = (((r_b * blue) >> 8) & 0xff00ff) | ((green * blue) & 0xff00);
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
                palette[pi] = (alpha << 24) | brightenRgb(palette[pi], brightness);
            }

            let index = 0;
            if (i > 0 && def.spriteTypes) {
                index = def.spriteTypes[i - 1];
            }

            if (index === 0) {
                if (size === sprite.subWidth) {
                    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
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
                            const paletteIndex = palettePixels[((x >> 1) << 6) + (y >> 1)];
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
                            const paletteIndex = palettePixels[(y << 1) + ((x << 1) << 7)];
                            if (alphaPaletteIndices.has(paletteIndex)) {
                                alphaPixelCount++;
                            }
                            pixels[pixelIndex++] = palette[paletteIndex];
                        }
                    }
                }
            }
        }

        this.transparentTextureMap.set(id, alphaPixelCount > 0);

        return pixels;
    }

    getPixelsArgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array {
        return this.getPixelsRgb(id, size, flipH, brightness);
    }
}

class TextureDefinition {
    static decode(id: number, buffer: ByteBuffer): TextureDefinition {
        const averageHsl = buffer.readUnsignedShort();
        const unknown = buffer.readUnsignedByte() === 1;
        const spriteCount = buffer.readUnsignedByte();
        if (spriteCount < 1 || spriteCount > 4) {
            throw new Error("Invalid sprite count for texture: " + spriteCount);
        }

        const spriteIds = new Array<number>(spriteCount);
        for (let i = 0; i < spriteCount; i++) {
            spriteIds[i] = buffer.readUnsignedShort();
        }

        let spriteTypes: number[] | undefined;
        if (spriteCount > 1) {
            spriteTypes = new Array(spriteCount - 1);
            for (let i = 0; i < spriteCount - 1; i++) {
                spriteTypes[i] = buffer.readUnsignedByte();
            }
        }
        let unused: number[] | undefined;
        if (spriteCount > 1) {
            unused = new Array(spriteCount - 1);
            for (let i = 0; i < spriteCount - 1; i++) {
                unused[i] = buffer.readUnsignedByte();
            }
        }

        const transforms = new Array<number>(spriteCount);
        for (let i = 0; i < spriteCount; i++) {
            transforms[i] = buffer.readInt();
        }

        const animationDirection = buffer.readUnsignedByte();
        const animationSpeed = buffer.readUnsignedByte();

        return new TextureDefinition(
            id,
            averageHsl,
            unknown,
            spriteCount,
            spriteIds,
            transforms,
            animationDirection,
            animationSpeed,
            spriteTypes,
            unused,
        );
    }

    constructor(
        readonly id: number,
        readonly averageHsl: number,
        readonly unknown: boolean,
        readonly spriteCount: number,
        readonly spriteIds: number[],
        readonly transforms: number[],
        readonly animationDirection: number,
        readonly animationSpeed: number,
        readonly spriteTypes?: number[],
        readonly unused?: number[],
    ) {}
}
