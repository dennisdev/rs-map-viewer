import JavaRandom from "java-random";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";
import { ByteBuffer } from "../../../io/ByteBuffer";

export class LineNoiseOperation extends TextureOperation {
    seed = 0;
    count = 2000;
    length = 16;
    minAngle = 0;
    maxAngle = 4096;

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.seed = buffer.readUnsignedByte();
        } else if (field === 1) {
            this.count = buffer.readUnsignedShort();
        } else if (field === 2) {
            this.length = buffer.readUnsignedByte();
        } else if (field === 3) {
            this.minAngle = buffer.readUnsignedShort();
        } else if (field === 4) {
            this.maxAngle = buffer.readUnsignedShort();
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const midAngle = this.maxAngle >> 1;
            const pixels = this.monochromeImageCache.getAll();
            const random = new JavaRandom(this.seed);
            for (let i = 0; i < this.count; i++) {
                let angle =
                    this.maxAngle > 0
                        ? this.minAngle - midAngle + random.nextInt(this.maxAngle)
                        : this.minAngle;
                angle = (angle >> 4) & 0xff;

                let x0 = random.nextInt(textureGenerator.width);
                let y0 = random.nextInt(textureGenerator.height);
                let x1 = ((TextureGenerator.COSINE[angle] * this.length) >> 12) + x0;
                let y1 = ((TextureGenerator.SINE[angle] * this.length) >> 12) + y0;
                let deltaX = x1 - x0;
                let deltaY = y1 - y0;
                if (deltaX !== 0 || deltaY !== 0) {
                    if (deltaX < 0) {
                        deltaX = -deltaX;
                    }
                    if (deltaY < 0) {
                        deltaY = -deltaY;
                    }
                    const flag = deltaX < deltaY;
                    if (flag) {
                        const tempX0 = x0;
                        const tempX1 = x1;
                        x0 = y0;
                        y0 = tempX0;
                        x1 = y1;
                        y1 = tempX1;
                    }
                    if (x0 > x1) {
                        const tempX0 = x0;
                        const tempY0 = y0;
                        x0 = x1;
                        y0 = y1;
                        x1 = tempX0;
                        y1 = tempY0;
                    }
                    const deltaX0 = x1 - x0;
                    let deltaY0 = y1 - y0;
                    let l2 = y0;
                    if (deltaY0 < 0) {
                        deltaY0 = -deltaY0;
                    }
                    let i4 = (-deltaX0 / 2) | 0;
                    const j4 = (2048 / deltaX0) | 0;
                    const k4 = 1024 - (random.nextInt(4096) >> 2);
                    const byte0 = y1 <= y0 ? -1 : 1;

                    for (let x = x0; x < x1; x++) {
                        i4 += deltaY0;
                        const value = j4 * (x - x0) + (1024 + k4);
                        const line = l2 & textureGenerator.lineMaxIdx;
                        if (i4 > 0) {
                            l2 = byte0 + l2;
                            i4 = i4 - deltaX0;
                        }
                        const pixel = x & textureGenerator.pixelMaxIdx;
                        if (!flag) {
                            pixels[pixel][line] = value;
                        } else {
                            pixels[line][pixel] = value;
                        }
                    }
                }
            }
        }
        return output;
    }
}
