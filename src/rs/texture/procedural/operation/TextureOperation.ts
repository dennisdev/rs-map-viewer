import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { ColourImageCache } from "../cache/ColourImageCache";
import { MonochromeImageCache } from "../cache/MonochromeImageCache";

export abstract class TextureOperation {
    id: number = -1;

    cacheSize: number = 0;
    isMonochrome: boolean;

    inputs: TextureOperation[];

    monochromeImageCache?: MonochromeImageCache;
    colourImageCache?: ColourImageCache;

    constructor(inputCount: number, isMonochrome: boolean) {
        this.isMonochrome = isMonochrome;
        this.inputs = new Array(inputCount);
    }

    decode(field: number, buffer: ByteBuffer): void {}

    init(): void {}

    initCaches(textureGenerator: TextureGenerator, width: number, height: number): void {
        const slotCount = this.cacheSize === 0xff ? height : this.cacheSize;
        if (this.isMonochrome) {
            this.monochromeImageCache = new MonochromeImageCache(slotCount, height, width);
        } else {
            this.colourImageCache = new ColourImageCache(slotCount, height, width);
        }
    }

    clearCaches(): void {
        this.monochromeImageCache = undefined;
        this.colourImageCache = undefined;
    }

    getSpriteId(): number {
        return -1;
    }

    getTextureId(): number {
        return -1;
    }

    getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        throw new Error("This operation does not have a monochrome output");
    }

    getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        throw new Error("This operation does not have a colour output");
    }

    getMonochromeInput(textureGenerator: TextureGenerator, n: number, line: number): Int32Array {
        if (this.inputs[n].isMonochrome) {
            return this.inputs[n].getMonochromeOutput(textureGenerator, line);
        }
        return this.inputs[n].getColourOutput(textureGenerator, line)[0];
    }

    getColourInput(textureGenerator: TextureGenerator, n: number, line: number): Int32Array[] {
        if (this.inputs[n].isMonochrome) {
            const monochromeOuputs = this.inputs[n].getMonochromeOutput(textureGenerator, line);
            const colourOutputs = new Array<Int32Array>(3).fill(monochromeOuputs);
            return colourOutputs;
        }
        return this.inputs[n].getColourOutput(textureGenerator, line);
    }
}
