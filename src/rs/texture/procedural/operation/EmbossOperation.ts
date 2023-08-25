import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class EmbossOperation extends TextureOperation {
    field0 = 4096;
    field1 = 3216;
    field2 = 3216;

    table = new Int32Array(3);

    constructor() {
        super(1, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.field0 = buffer.readUnsignedShort();
        } else if (field === 1) {
            this.field1 = buffer.readUnsignedShort();
        } else if (field === 2) {
            this.field2 = buffer.readUnsignedShort();
        }
    }

    override init() {
        const d = Math.cos(this.field2 / 4096);
        this.table[0] = 4096 * (d * Math.sin(this.field1 / 4096));
        this.table[1] = 4096 * (d * Math.cos(this.field1 / 4096));
        this.table[2] = 4096 * Math.sin(this.field2 / 4096);
        const t0 = (this.table[0] * this.table[0]) >> 12;
        const t1 = (this.table[1] * this.table[1]) >> 12;
        const t2 = (this.table[2] * this.table[2]) >> 12;
        const scale = (Math.sqrt((t0 + t1 + t2) >> 12) * 4096) | 0;
        if (scale !== 0) {
            this.table[0] = (this.table[0] << 12) / scale;
            this.table[1] = (this.table[1] << 12) / scale;
            this.table[2] = (this.table[2] << 12) / scale;
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const prevLine = this.getMonochromeInput(
                textureGenerator,
                0,
                (line - 1) & textureGenerator.lineMaxIdx,
            );
            const currLine = this.getMonochromeInput(textureGenerator, 0, line);
            const nextLine = this.getMonochromeInput(
                textureGenerator,
                0,
                (line + 1) & textureGenerator.lineMaxIdx,
            );
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                const prevPixel = currLine[(pixel - 1) & textureGenerator.pixelMaxIdx];
                const nextPixel = currLine[(pixel + 1) & textureGenerator.pixelMaxIdx];
                const j1 = this.field0 * (nextPixel - prevPixel);
                const i1 = this.field0 * (nextLine[pixel] - prevLine[pixel]);
                const k1 = j1 >> 12;
                const l1 = i1 >> 12;
                const i2 = (k1 * k1) >> 12;
                const j2 = (l1 * l1) >> 12;

                const k2 = (Math.sqrt((i2 + j2 + 4096) / 4096) * 4096) | 0;
                let v0 = 0;
                let v1 = 0;
                let v2 = 0;
                if (k2 !== 0) {
                    v2 = (0x1000000 / k2) | 0;
                    v1 = (i1 / k2) | 0;
                    v0 = (j1 / k2) | 0;
                }
                v0 = (this.table[0] * v0) >> 12;
                v1 = (this.table[1] * v1) >> 12;
                v2 = (this.table[2] * v2) >> 12;
                output[pixel] = v0 + v1 + v2;
            }
        }
        return output;
    }
}
