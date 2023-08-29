import { clamp } from "../../../util/MathUtil";
import { ByteBuffer } from "../../io/ByteBuffer";
import { TextureGenerator } from "./TextureGenerator";
import { TextureOperation } from "./operation/TextureOperation";
import { TextureOperationFactory } from "./operation/TextureOperationFactory";

export class ProceduralTexture {
    operations: TextureOperation[];

    spriteDependencies: number[];
    textureDependencies: number[];

    colourOperation: TextureOperation;
    monochromeOperation: TextureOperation;

    alphaOperation?: TextureOperation;

    constructor(buffer: ByteBuffer, hasAlphaOperation: boolean) {
        const operationCount = buffer.readUnsignedByte();
        // console.log("op count", operationCount);
        let spriteDepCount = 0;
        let textureDepCount = 0;
        const inputConnections = new Array<number[]>(operationCount);
        this.operations = new Array(operationCount);
        for (let op = 0; op < operationCount; op++) {
            const operation = TextureOperationFactory.create(buffer);
            if (operation.getSpriteId() >= 0) {
                spriteDepCount++;
            }
            if (operation.getTextureId() >= 0) {
                textureDepCount++;
            }
            const inputCount = operation.inputs.length;
            inputConnections[op] = new Array(inputCount);
            for (let i = 0; i < inputCount; i++) {
                inputConnections[op][i] = buffer.readUnsignedByte();
            }
            this.operations[op] = operation;
        }
        this.spriteDependencies = new Array(spriteDepCount);
        this.textureDependencies = new Array(textureDepCount);
        let spriteDepIndex = 0;
        let textureDepIndex = 0;
        for (let op = 0; op < operationCount; op++) {
            const operation = this.operations[op];
            const inputCount = operation.inputs.length;
            for (let i = 0; i < inputCount; i++) {
                operation.inputs[i] = this.operations[inputConnections[op][i]];
            }
            const spriteId = operation.getSpriteId();
            const textureId = operation.getTextureId();
            if (spriteId >= 0) {
                this.spriteDependencies[spriteDepIndex++] = spriteId;
            }
            if (textureId >= 0) {
                this.textureDependencies[textureDepIndex++] = textureId;
            }
            delete inputConnections[op];
        }
        this.colourOperation = this.operations[buffer.readUnsignedByte()];
        if (hasAlphaOperation) {
            this.alphaOperation = this.operations[buffer.readUnsignedByte()];
        }
        this.monochromeOperation = this.operations[buffer.readUnsignedByte()];
    }

    getPixelsRgb(
        textureGenerator: TextureGenerator,
        width: number,
        height: number,
        flipH: boolean,
        flipV: boolean,
        brightness: number,
    ): Int32Array {
        for (const operation of this.operations) {
            operation.initCaches(textureGenerator, width, height);
        }
        textureGenerator.initBrightness(brightness);
        textureGenerator.init(width, height);

        const pixels = new Int32Array(width * height);

        let srcInc: number;
        let srcEnd: number;
        let srcStart: number;
        if (flipH) {
            srcInc = -1;
            srcEnd = -1;
            srcStart = width - 1;
        } else {
            srcStart = 0;
            srcEnd = width;
            srcInc = 1;
        }
        let dstIdx = 0;

        for (let line = 0; line < height; line++) {
            if (flipV) {
                dstIdx = line;
            }
            let pixelsR: Int32Array;
            let pixelsG: Int32Array;
            let pixelsB: Int32Array;
            if (this.colourOperation.isMonochrome) {
                const output = this.colourOperation.getMonochromeOutput(textureGenerator, line);
                pixelsR = output;
                pixelsG = output;
                pixelsB = output;
            } else {
                const output = this.colourOperation.getColourOutput(textureGenerator, line);
                pixelsR = output[0];
                pixelsG = output[1];
                pixelsB = output[2];
            }
            for (let srcIdx = srcStart; srcIdx !== srcEnd; srcIdx += srcInc) {
                let r = pixelsR[srcIdx] >> 4;
                if (r > 255) {
                    r = 255;
                }
                if (r < 0) {
                    r = 0;
                }
                let g = pixelsG[srcIdx] >> 4;
                if (g > 255) {
                    g = 255;
                }
                if (g < 0) {
                    g = 0;
                }
                let b = pixelsB[srcIdx] >> 4;
                if (b > 255) {
                    b = 255;
                }
                if (b < 0) {
                    b = 0;
                }
                r = textureGenerator.brightnessTable[r];
                g = textureGenerator.brightnessTable[g];
                b = textureGenerator.brightnessTable[b];
                let rgb = (r << 16) | (g << 8) | b;
                if (rgb !== 0) {
                    rgb |= 0xff000000;
                } else {
                    textureGenerator.isTransparent = true;
                    // rgb |= 0xff000000;
                }
                pixels[dstIdx++] = rgb;
                if (flipV) {
                    dstIdx += width - 1;
                }
            }
        }

        for (const operation of this.operations) {
            operation.clearCaches();
        }
        return pixels;
    }

    getPixelsArgb(
        textureGenerator: TextureGenerator,
        width: number,
        height: number,
        flipH: boolean,
        flipV: boolean,
        brightness: number,
    ): Int32Array {
        for (const operation of this.operations) {
            operation.initCaches(textureGenerator, width, height);
        }
        textureGenerator.initBrightness(brightness);
        textureGenerator.init(width, height);

        const pixels = new Int32Array(width * height);

        let srcInc: number;
        let srcEnd: number;
        let srcStart: number;
        if (flipH) {
            srcInc = -1;
            srcEnd = -1;
            srcStart = width - 1;
        } else {
            srcStart = 0;
            srcEnd = width;
            srcInc = 1;
        }
        let dstIdx = 0;

        for (let line = 0; line < height; line++) {
            if (flipV) {
                dstIdx = line;
            }
            let pixelsR: Int32Array;
            let pixelsG: Int32Array;
            let pixelsB: Int32Array;
            let pixelsA: Int32Array | undefined;
            if (this.colourOperation.isMonochrome) {
                const output = this.colourOperation.getMonochromeOutput(textureGenerator, line);
                pixelsR = output;
                pixelsG = output;
                pixelsB = output;
            } else {
                const output = this.colourOperation.getColourOutput(textureGenerator, line);
                pixelsR = output[0];
                pixelsG = output[1];
                pixelsB = output[2];
            }
            if (this.alphaOperation) {
                if (this.alphaOperation.isMonochrome) {
                    pixelsA = this.alphaOperation.getMonochromeOutput(textureGenerator, line);
                } else {
                    pixelsA = this.alphaOperation.getColourOutput(textureGenerator, line)[0];
                }
            }
            for (let srcIdx = srcStart; srcIdx !== srcEnd; srcIdx += srcInc) {
                let r = pixelsR[srcIdx] >> 4;
                if (r > 255) {
                    r = 255;
                }
                if (r < 0) {
                    r = 0;
                }
                let g = pixelsG[srcIdx] >> 4;
                if (g > 255) {
                    g = 255;
                }
                if (g < 0) {
                    g = 0;
                }
                let b = pixelsB[srcIdx] >> 4;
                if (b > 255) {
                    b = 255;
                }
                if (b < 0) {
                    b = 0;
                }
                r = textureGenerator.brightnessTable[r];
                g = textureGenerator.brightnessTable[g];
                b = textureGenerator.brightnessTable[b];
                let a = 0;
                if (r !== 0 || g !== 0 || b !== 0) {
                    if (pixelsA) {
                        a = clamp(pixelsA[srcIdx] >> 4, 0, 0xff);
                    } else {
                        a = 0xff;
                    }
                }

                if (a !== 0xff) {
                    textureGenerator.isTransparent = true;
                }

                const argb = (a << 24) | (r << 16) | (g << 8) | b;

                pixels[dstIdx++] = argb;
                if (flipV) {
                    dstIdx += width - 1;
                }
            }
        }

        for (const operation of this.operations) {
            operation.clearCaches();
        }
        return pixels;
    }
}
