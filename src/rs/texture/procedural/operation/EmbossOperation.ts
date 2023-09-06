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
        const d = Math.cos(Math.fround(this.field2 / 4096));
        this.table[0] = 4096 * (d * Math.sin(Math.fround(this.field1 / 4096)));
        this.table[1] = 4096 * (d * Math.cos(Math.fround(this.field1 / 4096)));
        this.table[2] = 4096 * Math.sin(Math.fround(this.field2 / 4096));
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
            const widthMult = (this.field0 * textureGenerator.widthTimes32) >> 12;
            const prevLine = this.getMonochromeInput(
                textureGenerator,
                0,
                (line - 1) & textureGenerator.heightMask,
            );
            const currLine = this.getMonochromeInput(textureGenerator, 0, line);
            const nextLine = this.getMonochromeInput(
                textureGenerator,
                0,
                (line + 1) & textureGenerator.heightMask,
            );
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                const prevPixel = currLine[(pixel - 1) & textureGenerator.widthMask];
                const nextPixel = currLine[(pixel + 1) & textureGenerator.widthMask];

                const i_10_ = (widthMult * (nextLine[pixel] - prevLine[pixel])) >> 12;
                const i_11_ = (widthMult * (prevPixel - nextPixel)) >> 12;

                let i_12_ = i_11_ >> 4;
                let i_13_ = i_10_ >> 4;
                if (i_12_ < 0) {
                    i_12_ = -i_12_;
                }
                if (i_12_ > 255) {
                    i_12_ = 255;
                }
                if (i_13_ < 0) {
                    i_13_ = -i_13_;
                }
                if (i_13_ > 255) {
                    i_13_ = 255;
                }
                const i_14_ =
                    TextureGenerator.INVERSE_SQUARE_ROOT[i_12_ + (((i_13_ + 1) * i_13_) >> 1)] &
                    0xff;
                let v0 = (i_14_ * i_11_) >> 8;
                let v1 = (i_14_ * i_10_) >> 8;
                let v2 = (i_14_ * 4096) >> 8;
                v0 = (this.table[0] * v0) >> 12;
                v1 = (this.table[1] * v1) >> 12;
                v2 = (this.table[2] * v2) >> 12;
                output[pixel] = v0 + v1 + v2;
            }
        }
        return output;
    }
}
