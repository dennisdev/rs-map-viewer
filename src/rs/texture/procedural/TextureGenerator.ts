import JavaRandom from "java-random";
import { CacheIndex } from "../../cache/CacheIndex";
import { IndexedSprite } from "../../sprite/IndexedSprite";
import { SpriteLoader } from "../../sprite/SpriteLoader";
import { TextureLoader } from "../TextureLoader";
import { nextIntJagex } from "../../../util/MathUtil";

export class TextureGenerator {
    static SINE: Int32Array;
    static COSINE: Int32Array;

    static INVERSE_SQUARE_ROOT: Int8Array;

    static permutationCache: Map<number, Int8Array> = new Map();

    spriteIndex: CacheIndex;
    textureLoader: TextureLoader;

    width: number = 0;
    height: number = 0;

    widthTimes32: number = 0;

    widthMask: number = 0;
    heightMask: number = 0;

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
            TextureGenerator.SINE[i] = Math.sin(d) * 4096.0;
            TextureGenerator.COSINE[i] = Math.cos(d) * 4096.0;
        }
    }

    static initInverseSquareRoot(): void {
        TextureGenerator.INVERSE_SQUARE_ROOT = new Int8Array(32896);
        let i = 0;
        for (let x = 0; x < 256; x++) {
            for (let y = 0; y <= x; y++) {
                TextureGenerator.INVERSE_SQUARE_ROOT[i++] =
                    (255.0 / Math.sqrt(Math.fround((x * x + y * y + 65535) / 65535.0))) | 0;
            }
        }
    }

    static init() {
        TextureGenerator.initTrig();
        TextureGenerator.initInverseSquareRoot();
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
            this.widthMask = width - 1;
            this.width = width;
            this.widthTimes32 = width * 32;
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
            this.heightMask = height - 1;
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

    static initPermutations(seed: number): Int8Array {
        const cached = TextureGenerator.permutationCache.get(seed);
        if (cached) {
            return cached;
        }

        const permutations = new Int8Array(512);
        const random = new JavaRandom(seed);
        for (let i = 0; i < 255; i++) {
            permutations[i] = i;
        }
        for (let i = 0; i < 255; i++) {
            const index0 = 255 - i;
            const index1 = nextIntJagex(random, index0);
            const perm1 = permutations[index1];
            permutations[index1] = permutations[index0];
            permutations[index0] = permutations[511 - i] = perm1;
        }
        TextureGenerator.permutationCache.set(seed, permutations);
        return permutations;
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
