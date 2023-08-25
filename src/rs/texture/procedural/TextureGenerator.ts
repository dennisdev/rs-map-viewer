import { CacheIndex } from "../../cache/CacheIndex";
import { IndexedSprite } from "../../sprite/IndexedSprite";
import { SpriteLoader } from "../../sprite/SpriteLoader";
import { TextureLoader } from "../TextureLoader";

export class TextureGenerator {
    static SINE: Int32Array;
    static COSINE: Int32Array;

    spriteIndex: CacheIndex;
    textureLoader: TextureLoader;

    width: number = 0;
    height: number = 0;

    pixelMaxIdx: number = 0;
    lineMaxIdx: number = 0;

    horizontalGradient!: Int32Array;
    verticalGradient!: Int32Array;

    brightnessTable: Int32Array = new Int32Array(256);
    brightness: number = -1.0;

    isTransparent: boolean = false;

    debug: boolean = false;

    static initTrig(): void {
        TextureGenerator.SINE = new Int32Array(256);
        TextureGenerator.COSINE = new Int32Array(256);
        for (let i = 0; i < 256; i++) {
            const d = (i / 255.0) * 6.283185307179586;
            TextureGenerator.SINE[i] = (Math.sin(d) * 4096.0) | 0;
            TextureGenerator.COSINE[i] = (Math.cos(d) * 4096.0) | 0;
        }
    }

    static init() {
        TextureGenerator.initTrig();
    }

    constructor(spriteIndex: CacheIndex, textureLoader: TextureLoader) {
        this.spriteIndex = spriteIndex;
        this.textureLoader = textureLoader;
    }

    init(width: number, height: number): void {
        this.isTransparent = false;
        if (this.width !== width) {
            this.horizontalGradient = new Int32Array(width);
            for (let i = 0; i < width; i++) {
                this.horizontalGradient[i] = (i << 12) / width;
            }
            this.pixelMaxIdx = width - 1;
            this.width = width;
        }
        if (this.height !== height) {
            if (height !== this.width) {
                this.verticalGradient = new Int32Array(height);
                for (let i = 0; i < height; i++) {
                    this.verticalGradient[i] = (i << 12) / height;
                }
            } else {
                this.verticalGradient = this.horizontalGradient;
            }
            this.lineMaxIdx = height - 1;
            this.height = height;
        }
    }

    initBrightness(brightness: number): void {
        if (this.brightness !== brightness) {
            for (let i = 0; i < this.brightnessTable.length; i++) {
                const v = (Math.pow(i / 255.0, brightness) * 255.0) | 0;
                this.brightnessTable[i] = Math.min(v, 255);
            }

            this.brightness = brightness;
        }
    }

    loadSprite(spriteId: number): IndexedSprite {
        const sprite = SpriteLoader.loadIntoIndexedSprite(this.spriteIndex, spriteId);
        if (!sprite) {
            throw new Error("Sprite not found: " + spriteId);
        }
        return sprite;
    }
}

TextureGenerator.init();
