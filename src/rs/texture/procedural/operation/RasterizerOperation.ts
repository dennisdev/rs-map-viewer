import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

// TODO: actually render
export class RasterizerOperation extends TextureOperation {
    ops?: RasterizerOperationShape[];

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            const count = buffer.readUnsignedByte();
            this.ops = new Array(count);
            for (let i = 0; i < count; i++) {
                const type = buffer.readUnsignedByte();
                if (type === 0) {
                    this.ops[i] = RasterizerOperationLine.create(buffer);
                } else if (type === 1) {
                    this.ops[i] = RasterizerOperationBezierCurve.create(buffer);
                } else if (type === 2) {
                    this.ops[i] = RasterizerOperationRectangle.create(buffer);
                } else if (type === 3) {
                    this.ops[i] = RasterizerOperationEllipse.create(buffer);
                }
            }
        } else if (field === 1) {
            this.isMonochrome = buffer.readUnsignedByte() === 1;
        }
    }

    render(textureGenerator: TextureGenerator, pixels: Int32Array[]): void {
        const width = textureGenerator.width;
        const height = textureGenerator.height;

        if (this.ops === undefined) {
            return;
        }

        for (const op of this.ops) {
            const fillColor = op.fillColor;
            const outlineColor = op.outlineColor;
            if (fillColor >= 0) {
                if (outlineColor >= 0) {
                    op.render(width, height);
                } else {
                    op.renderFill(width, height);
                }
            } else if (outlineColor >= 0) {
                op.render(width, height);
            }
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
        }
        return output;
    }

    override getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        if (!this.colourImageCache) {
            throw new Error("Colour image cache is not initialized");
        }
        const output = this.colourImageCache.get(line);
        if (this.colourImageCache.dirty) {
        }
        return output;
    }
}

export abstract class RasterizerOperationShape {
    constructor(
        readonly fillColor: number,
        readonly outlineColor: number,
        readonly outlineWidth: number,
    ) {}

    abstract render(width: number, height: number): void;

    abstract renderFill(width: number, height: number): void;

    abstract renderOutline(width: number, height: number): void;
}

export class RasterizerOperationLine extends RasterizerOperationShape {
    static create(buffer: ByteBuffer): RasterizerOperationLine {
        const x0 = buffer.readShort();
        const y0 = buffer.readShort();
        const x1 = buffer.readShort();
        const y1 = buffer.readShort();
        const color = buffer.readMedium();
        const outlineWidth = buffer.readUnsignedByte();
        return new RasterizerOperationLine(x0, y0, x1, y1, color, outlineWidth);
    }

    constructor(
        readonly x0: number,
        readonly y0: number,
        readonly x1: number,
        readonly y1: number,
        color: number,
        outlineWidth: number,
    ) {
        super(-1, color, outlineWidth);
    }

    override render(width: number, height: number): void {}

    override renderFill(width: number, height: number): void {}

    override renderOutline(width: number, height: number): void {}
}

export class RasterizerOperationBezierCurve extends RasterizerOperationShape {
    static create(buffer: ByteBuffer): RasterizerOperationBezierCurve {
        const x0 = buffer.readShort();
        const y0 = buffer.readShort();
        const x1 = buffer.readShort();
        const y1 = buffer.readShort();
        const x2 = buffer.readShort();
        const y2 = buffer.readShort();
        const x3 = buffer.readShort();
        const y3 = buffer.readShort();
        const color = buffer.readMedium();
        const outlineWidth = buffer.readUnsignedByte();
        return new RasterizerOperationBezierCurve(
            x0,
            y0,
            x1,
            y1,
            x2,
            y2,
            x3,
            y3,
            color,
            outlineWidth,
        );
    }

    constructor(
        readonly x0: number,
        readonly y0: number,
        readonly x1: number,
        readonly y1: number,
        readonly x2: number,
        readonly y2: number,
        readonly x3: number,
        readonly y3: number,
        color: number,
        outlineWidth: number,
    ) {
        super(-1, color, outlineWidth);
    }

    override render(width: number, height: number): void {}

    override renderFill(width: number, height: number): void {}

    override renderOutline(width: number, height: number): void {}
}

export class RasterizerOperationRectangle extends RasterizerOperationShape {
    static create(buffer: ByteBuffer): RasterizerOperationRectangle {
        const x0 = buffer.readShort();
        const y0 = buffer.readShort();
        const x1 = buffer.readShort();
        const y1 = buffer.readShort();
        const fillColor = buffer.readMedium();
        const outlineColor = buffer.readMedium();
        const outlineWidth = buffer.readUnsignedByte();
        return new RasterizerOperationRectangle(
            x0,
            y0,
            x1,
            y1,
            fillColor,
            outlineColor,
            outlineWidth,
        );
    }

    constructor(
        readonly x0: number,
        readonly y0: number,
        readonly x1: number,
        readonly y1: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        super(fillColor, outlineColor, outlineWidth);
    }

    override render(width: number, height: number): void {}

    override renderFill(width: number, height: number): void {}

    override renderOutline(width: number, height: number): void {}
}

export class RasterizerOperationEllipse extends RasterizerOperationShape {
    static create(buffer: ByteBuffer): RasterizerOperationEllipse {
        const x = buffer.readShort();
        const y = buffer.readShort();
        const sizeX = buffer.readShort();
        const sizeY = buffer.readShort();
        const fillColor = buffer.readMedium();
        const outlineColor = buffer.readMedium();
        const outlineWidth = buffer.readUnsignedByte();
        return new RasterizerOperationEllipse(
            x,
            y,
            sizeX,
            sizeY,
            fillColor,
            outlineColor,
            outlineWidth,
        );
    }

    constructor(
        readonly x: number,
        readonly y: number,
        readonly sizeX: number,
        readonly sizeY: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        super(fillColor, outlineColor, outlineWidth);
    }

    override render(width: number, height: number): void {}

    override renderFill(width: number, height: number): void {}

    override renderOutline(width: number, height: number): void {}
}
