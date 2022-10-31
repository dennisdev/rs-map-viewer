import { IndexSync } from "../fs/Index";
import { StoreSync } from "../fs/Store";
import { ByteBuffer } from "../util/ByteBuffer";
import { IndexedSprite } from "./IndexedSprite";

export class SpriteLoader {
    static spriteCount: number = 0;
    static xOffsets?: Int32Array;
    static yOffsets?: Int32Array;
    static widths?: Int32Array;
    static heights?: Int32Array;
    static pixels?: Uint8Array[];
    static width: number = 0;
    static height: number = 0;
    static palette?: Int32Array;

    static load(data: Int8Array): void {
        const buffer = new ByteBuffer(data);

        buffer.offset = data.length - 2;

        SpriteLoader.spriteCount = buffer.readUnsignedShort();
        SpriteLoader.xOffsets = new Int32Array(SpriteLoader.spriteCount);
        SpriteLoader.yOffsets = new Int32Array(SpriteLoader.spriteCount);
        SpriteLoader.widths = new Int32Array(SpriteLoader.spriteCount);
        SpriteLoader.heights = new Int32Array(SpriteLoader.spriteCount);
        SpriteLoader.pixels = new Array(SpriteLoader.spriteCount);

        buffer.offset = data.length - 7 - SpriteLoader.spriteCount * 8;

        SpriteLoader.width = buffer.readUnsignedShort();
        SpriteLoader.height = buffer.readUnsignedShort();
        const paletteSize = (buffer.readUnsignedByte() & 0xFF) + 1;

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            SpriteLoader.xOffsets[i] = buffer.readUnsignedShort();
        }

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            SpriteLoader.yOffsets[i] = buffer.readUnsignedShort();
        }

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            SpriteLoader.widths[i] = buffer.readUnsignedShort();
        }

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            SpriteLoader.heights[i] = buffer.readUnsignedShort();
        }

        buffer.offset = data.length - 7 - SpriteLoader.spriteCount * 8 - (paletteSize - 1) * 3;

        SpriteLoader.palette = new Int32Array(paletteSize);

        for (let i = 1; i < paletteSize; i++) {
            SpriteLoader.palette[i] = buffer.readMedium();
            if (SpriteLoader.palette[i] == 0) {
                SpriteLoader.palette[i] = 1;
            }
        }

        buffer.offset = 0;

        for (let i = 0; i < SpriteLoader.spriteCount; i++) {
            const width = SpriteLoader.widths[i];
            const height = SpriteLoader.heights[i];
            const pixelCount = width * height;
            const pixels = SpriteLoader.pixels[i] = new Uint8Array(pixelCount);
            const readPixelsDimension = buffer.readUnsignedByte();
            if (readPixelsDimension == 0) {
                for (let pi = 0; pi < pixelCount; pi++) {
                    pixels[pi] = buffer.readByte();
                }
            } else if (readPixelsDimension == 1) {
                for (let x = 0; x < width; x++) {
                    for (let y = 0; y < height; y++) {
                        pixels[x + y * width] = buffer.readByte();
                    }
                }
            }
        }
    }

    static loadFromIndex(spriteIndex: IndexSync<StoreSync>, id: number): boolean {
        const file = spriteIndex.getFile(id, 0);
        if (file) {
            SpriteLoader.load(file.data);
            return true;
        }
        return false;
    }

    static loadIntoIndexedSprite(spriteIndex: IndexSync<StoreSync>, id: number): IndexedSprite | undefined {
        if (SpriteLoader.loadFromIndex(spriteIndex, id) && SpriteLoader.xOffsets && SpriteLoader.yOffsets
            && SpriteLoader.widths && SpriteLoader.heights && SpriteLoader.palette && SpriteLoader.pixels) {
            const sprite = new IndexedSprite();

            sprite.width = SpriteLoader.width;
            sprite.height = SpriteLoader.height;
            sprite.xOffset = SpriteLoader.xOffsets[0];
            sprite.yOffset = SpriteLoader.yOffsets[0];
            sprite.subWidth = SpriteLoader.widths[0];
            sprite.subHeight = SpriteLoader.heights[0];
            sprite.palette = SpriteLoader.palette;
            sprite.pixels = SpriteLoader.pixels[0];

            SpriteLoader.xOffsets = undefined;
            SpriteLoader.yOffsets = undefined;
            SpriteLoader.widths = undefined;
            SpriteLoader.heights = undefined;
            SpriteLoader.palette = undefined;
            SpriteLoader.pixels = undefined;

            return sprite;
        }
        return undefined;
    }
}
