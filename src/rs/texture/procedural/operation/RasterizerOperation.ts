import { clamp } from "../../../../util/MathUtil";
import { ByteBuffer } from "../../../io/ByteBuffer";
import { ArrayUtils } from "../../../util/ArrayUtils";
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

        Rasterizer.setPixels(pixels);
        Rasterizer.setDimensionMasks(textureGenerator.widthMask, textureGenerator.heightMask);

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
                op.renderOutline(width, height);
            }
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            this.render(textureGenerator, this.monochromeImageCache.getAll());
        }
        return output;
    }

    override getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        if (!this.colourImageCache) {
            throw new Error("Colour image cache is not initialized");
        }
        const output = this.colourImageCache.get(line);
        if (this.colourImageCache.dirty) {
            const width = textureGenerator.width;
            const height = textureGenerator.height;
            const pixels = new Array<Int32Array>(height);
            for (let i = 0; i < height; i++) {
                pixels[i] = new Int32Array(width);
            }
            const outputAll = this.colourImageCache.getAll();
            this.render(textureGenerator, pixels);
            for (let y = 0; y < textureGenerator.height; y++) {
                const output = outputAll[y];
                const outputR = output[0];
                const outputG = output[1];
                const outputB = output[2];
                const input = pixels[y];
                for (let x = 0; x < textureGenerator.width; x++) {
                    const rgb = input[x];
                    outputR[x] = (rgb >> 12) & 0xff0;
                    outputG[x] = (rgb >> 4) & 0xff0;
                    outputB[x] = (rgb & 0xff) << 4;
                }
            }
        }
        return output;
    }
}

export class Rasterizer {
    static pixels: Int32Array[];

    static widthMask: number = 0;
    static heightMask: number = 0;
    static startX: number = 0;
    static startY: number = 0;

    static circleOutline: Int32Array;

    static setPixels(pixels: Int32Array[]): void {
        this.pixels = pixels;
    }

    static setDimensionMasks(widthMask: number, heightMask: number): void {
        this.widthMask = widthMask;
        this.heightMask = heightMask;
        this.startX = 0;
        this.startY = 0;
    }

    static initCircleOutline(size: number): void {
        if (this.circleOutline === undefined || this.circleOutline.length < size) {
            this.circleOutline = new Int32Array(size);
        }
    }

    static rasterLine(x0: number, x1: number, y0: number, y1: number, color: number): void {
        const deltaX = x1 - x0;
        const deltaY = y1 - y0;
        if (deltaX === 0) {
            if (deltaY !== 0) {
                Rasterizer.rasterVerticalLine(x0, y0, y1, color);
            }
        } else if (deltaY === 0) {
            Rasterizer.rasterHorizontalLine(x0, x1, y0, color);
        } else {
            const local55 = ((deltaY << 12) / deltaX) | 0;
            const local64 = y0 - ((x0 * local55) >> 12);
            let startX: number;
            let startY: number;
            if (x0 < Rasterizer.startX) {
                startY = local64 + ((Rasterizer.startX * local55) >> 12);
                startX = Rasterizer.startX;
            } else if (Rasterizer.widthMask >= x0) {
                startX = x0;
                startY = y0;
            } else {
                startX = Rasterizer.widthMask;
                startY = ((Rasterizer.widthMask * local55) >> 12) + local64;
            }
            let endX: number;
            let endY: number;
            if (x1 < Rasterizer.startX) {
                endX = Rasterizer.startX;
                endY = local64 + ((Rasterizer.startX * local55) >> 12);
            } else if (x1 <= Rasterizer.widthMask) {
                endX = x1;
                endY = y1;
            } else {
                endX = Rasterizer.widthMask;
                endY = ((local55 * Rasterizer.widthMask) >> 12) + local64;
            }
            if (Rasterizer.startY > endY) {
                endX = ((Rasterizer.startY - local64) << 12) / local55;
                endY = Rasterizer.startY;
            } else if (Rasterizer.heightMask < endY) {
                endX = ((Rasterizer.heightMask - local64) << 12) / local55;
                endY = Rasterizer.heightMask;
            }
            if (Rasterizer.startY > startY) {
                startX = ((Rasterizer.startY - local64) << 12) / local55;
                startY = Rasterizer.startY;
            } else if (startY > Rasterizer.heightMask) {
                startY = Rasterizer.heightMask;
                startX = ((Rasterizer.heightMask - local64) << 12) / local55;
            }
            Rasterizer.rasterLine0(startX, endX, startY, endY, color);
        }
    }

    static rasterLine0(x0: number, x1: number, y0: number, y1: number, color: number): void {
        let deltaX = x1 - x0;
        let deltaY = y1 - y0;
        if (deltaX === 0) {
            if (deltaY !== 0) {
                Rasterizer.rasterVerticalLine0(x0, y0, y1, color);
            }
        } else if (deltaY === 0) {
            Rasterizer.rasterHorizontalLine0(x0, x1, y0, color);
        } else {
            if (deltaX < 0) {
                deltaX = -deltaX;
            }
            if (deltaY < 0) {
                deltaY = -deltaY;
            }
            const local70 = deltaY > deltaX;
            if (local70) {
                const temp0 = x0;
                x0 = y0;
                y0 = temp0;
                const temp1 = x1;
                x1 = y1;
                y1 = temp1;
            }
            if (x1 < x0) {
                const temp0 = x0;
                x0 = x1;
                const temp1 = y0;
                y0 = y1;
                y1 = temp1;
                x1 = temp0;
            }
            let y = y0;
            const local110 = x1 - x0;
            let local115 = y1 - y0;
            const local126 = y1 > y0 ? 1 : -1;
            if (local115 < 0) {
                local115 = -local115;
            }
            let local137 = -(local110 >> 1);
            if (local70) {
                for (let local141 = x0; local141 <= x1; local141++) {
                    local137 += local115;
                    Rasterizer.pixels[local141][y] = color;
                    if (local137 > 0) {
                        y += local126;
                        local137 -= local110;
                    }
                }
            } else {
                for (let x = x0; x <= x1; x++) {
                    local137 += local115;
                    Rasterizer.pixels[y][x] = color;
                    if (local137 > 0) {
                        y += local126;
                        local137 -= local110;
                    }
                }
            }
        }
    }

    static rasterVerticalLine(x0: number, y0: number, y1: number, color: number) {
        if (Rasterizer.startX <= x0 && Rasterizer.widthMask >= x0) {
            y0 = clamp(y0, Rasterizer.startY, Rasterizer.heightMask);
            y1 = clamp(y1, Rasterizer.startY, Rasterizer.heightMask);
            Rasterizer.rasterVerticalLine0(x0, y0, y1, color);
        }
    }

    static rasterVerticalLine0(x0: number, y0: number, y1: number, color: number) {
        if (y1 >= y0) {
            for (let y = y0; y < y1; y++) {
                Rasterizer.pixels[y][x0] = color;
            }
        } else {
            for (let y = y1; y < y0; y++) {
                Rasterizer.pixels[y][x0] = color;
            }
        }
    }

    static rasterHorizontalLine(x0: number, x1: number, y0: number, color: number) {
        if (Rasterizer.startY <= y0 && y0 <= Rasterizer.heightMask) {
            x0 = clamp(x0, Rasterizer.startX, Rasterizer.widthMask);
            x1 = clamp(x1, Rasterizer.startX, Rasterizer.widthMask);
            Rasterizer.rasterHorizontalLine0(x0, x1, y0, color);
        }
    }

    static rasterHorizontalLine0(x0: number, x1: number, y0: number, color: number) {
        if (x1 >= x0) {
            ArrayUtils.fillRange(Rasterizer.pixels[y0], x0, x1, color);
        } else {
            ArrayUtils.fillRange(Rasterizer.pixels[y0], x1, x0, color);
        }
    }

    static rasterBezierCurve(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        outlineColor: number,
    ) {
        if (
            Rasterizer.startX <= x0 &&
            x0 <= Rasterizer.widthMask &&
            Rasterizer.startX <= x1 &&
            Rasterizer.widthMask >= x1 &&
            Rasterizer.startX <= x2 &&
            Rasterizer.widthMask >= x2 &&
            Rasterizer.startX <= x3 &&
            x3 <= Rasterizer.widthMask &&
            y0 >= Rasterizer.startY &&
            y0 <= Rasterizer.heightMask &&
            y1 >= Rasterizer.startY &&
            Rasterizer.heightMask >= y1 &&
            y2 >= Rasterizer.startY &&
            Rasterizer.heightMask >= y2 &&
            Rasterizer.startY <= y3 &&
            Rasterizer.heightMask >= y3
        ) {
            Rasterizer.rasterBezierCurve0(x0, y0, x1, y1, x2, y2, x3, y3, outlineColor);
        } else {
            Rasterizer.rasterBezierCurveClamped(x0, y0, x1, y1, x2, y2, x3, y3, outlineColor);
        }
    }

    static rasterBezierCurve0(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        outlineColor: number,
    ) {
        if (x0 === x1 && y0 === y1 && x2 === x3 && y2 === y3) {
            Rasterizer.rasterLine0(x0, x3, y0, y3, outlineColor);
            return;
        }
        let local36 = x0;
        let local38 = y0;
        const local42 = x0 * 3;
        const local46 = y0 * 3;
        const local50 = x1 * 3;
        const local54 = x2 * 3;
        const local58 = y1 * 3;
        const local62 = y2 * 3;
        const local72 = local50 + x3 - x0 - local54;
        const local81 = local58 + y3 - local62 - y0;
        const local92 = local54 + local42 - local50 - local50;
        const local103 = local62 + local46 - local58 - local58;
        const local108 = local58 - local46;
        const local113 = local50 - local42;
        for (let local115 = 128; local115 <= 4096; local115 += 128) {
            const local126 = (local115 * local115) >> 12;
            const local132 = (local115 * local126) >> 12;
            const local136 = local132 * local72;
            const local140 = local126 * local92;
            const local144 = local113 * local115;
            const local148 = local103 * local126;
            const local158 = ((local144 + local140 + local136) >> 12) + x0;
            const local162 = local81 * local132;
            const local166 = local108 * local115;
            const local176 = ((local166 + local162 + local148) >> 12) + y0;
            Rasterizer.rasterLine0(local36, local158, local38, local176, outlineColor);
            local36 = local158;
            local38 = local176;
        }
    }

    static rasterBezierCurveClamped(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        outlineColor: number,
    ) {
        if (x1 === x0 && y1 === y0 && x2 === x3 && y2 === y3) {
            Rasterizer.rasterLine(x0, x3, y0, y3, outlineColor);
            return;
        }
        let local32 = x0;
        let local34 = y0;
        const local38 = x0 * 3;
        const local42 = y1 * 3;
        const local46 = x1 * 3;
        const local50 = x2 * 3;
        const local61 = x3 + local46 - x0 - local50;
        const local65 = y0 * 3;
        const local75 = local38 + local50 - local46 - local46;
        const local79 = y2 * 3;
        const local90 = local79 + local65 - local42 - local42;
        const local100 = local42 + y3 - y0 - local79;
        const local104 = local46 - local38;
        const local108 = local42 - local65;
        for (let local110 = 128; local110 <= 4096; local110 += 128) {
            const local119 = (local110 * local110) >> 12;
            const local123 = local119 * local75;
            const local129 = (local110 * local119) >> 12;
            const local133 = local129 * local61;
            const local137 = local108 * local110;
            const local141 = local90 * local119;
            const local145 = local100 * local129;
            const local149 = local104 * local110;
            const local159 = ((local149 + local123 + local133) >> 12) + x0;
            const local170 = ((local137 + local145 + local141) >> 12) + y0;
            Rasterizer.rasterLine(local32, local159, local34, local170, outlineColor);
            local34 = local170;
            local32 = local159;
        }
    }

    static rasterRectangle(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        if (
            x0 >= Rasterizer.startX &&
            x1 <= Rasterizer.widthMask &&
            Rasterizer.startY <= y0 &&
            y1 <= Rasterizer.heightMask
        ) {
            Rasterizer.rasterRectangle0(x0, x1, y0, y1, fillColor, outlineColor, outlineWidth);
        } else {
            Rasterizer.rasterRectangleClamped(
                x0,
                x1,
                y0,
                y1,
                fillColor,
                outlineColor,
                outlineWidth,
            );
        }
    }

    static rasterRectangle0(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        const local6 = y0 + outlineWidth;
        const local14 = y1 - outlineWidth;
        const local18 = x0 + outlineWidth;
        const local23 = x1 - outlineWidth;
        for (let local25 = y0; local25 < local6; local25++) {
            ArrayUtils.fillRange(Rasterizer.pixels[local25], x0, x1, outlineColor);
        }
        for (let local55 = y1; local55 > local14; local55--) {
            ArrayUtils.fillRange(Rasterizer.pixels[local55], x0, x1, outlineColor);
        }
        for (let local75 = local6; local75 <= local14; local75++) {
            const local86 = Rasterizer.pixels[local75];
            ArrayUtils.fillRange(local86, x0, local18, outlineColor);
            ArrayUtils.fillRange(local86, local18, local23, fillColor);
            ArrayUtils.fillRange(local86, local23, x1, outlineColor);
        }
    }

    static rasterRectangleClamped(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        const local11 = clamp(y0, Rasterizer.startY, Rasterizer.heightMask);
        const local22 = clamp(y1, Rasterizer.startY, Rasterizer.heightMask);
        const local28 = clamp(x0, Rasterizer.startX, Rasterizer.widthMask);
        const local34 = clamp(x1, Rasterizer.startX, Rasterizer.widthMask);
        const local43 = clamp(y0 + outlineWidth, Rasterizer.startY, Rasterizer.heightMask);
        const local52 = clamp(y1 - outlineWidth, Rasterizer.startY, Rasterizer.heightMask);
        for (let local54 = local11; local54 < local43; local54++) {
            ArrayUtils.fillRange(Rasterizer.pixels[local54], local28, local34, outlineColor);
        }
        for (let local74 = local22; local74 > local52; local74--) {
            ArrayUtils.fillRange(Rasterizer.pixels[local74], local28, local34, outlineColor);
        }
        const local97 = clamp(x0 + outlineWidth, Rasterizer.startX, Rasterizer.widthMask);
        const local106 = clamp(x1 - outlineWidth, Rasterizer.startX, Rasterizer.widthMask);
        for (let local108 = local43; local108 <= local52; local108++) {
            const local119 = Rasterizer.pixels[local108];
            ArrayUtils.fillRange(local119, local28, local97, outlineColor);
            ArrayUtils.fillRange(local119, local97, local106, fillColor);
            ArrayUtils.fillRange(local119, local106, local34, outlineColor);
        }
    }

    static rasterRectangleFill(x0: number, x1: number, y0: number, y1: number, fillColor: number) {
        if (
            Rasterizer.startX <= x0 &&
            x1 <= Rasterizer.widthMask &&
            Rasterizer.startY <= y0 &&
            y1 <= Rasterizer.heightMask
        ) {
            Rasterizer.rasterRectangleFill0(x0, x1, y0, y1, fillColor);
        } else {
            Rasterizer.rasterRectangleFillClamped(x0, x1, y0, y1, fillColor);
        }
    }

    static rasterRectangleFill0(x0: number, x1: number, y0: number, y1: number, fillColor: number) {
        for (let local6 = y0; local6 <= y1; local6++) {
            ArrayUtils.fillRange(Rasterizer.pixels[local6], x0, x1, fillColor);
        }
    }

    static rasterRectangleFillClamped(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        fillColor: number,
    ) {
        const local11 = clamp(y0, Rasterizer.startY, Rasterizer.heightMask);
        const local17 = clamp(y1, Rasterizer.startY, Rasterizer.heightMask);
        const local23 = clamp(x0, Rasterizer.startX, Rasterizer.widthMask);
        const local29 = clamp(x1, Rasterizer.startX, Rasterizer.widthMask);
        for (let local31 = local11; local31 <= local17; local31++) {
            ArrayUtils.fillRange(Rasterizer.pixels[local31], local23, local29, fillColor);
        }
    }

    static rasterRectangleOutline(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        if (
            x0 >= Rasterizer.startX &&
            Rasterizer.widthMask >= x1 &&
            y0 >= Rasterizer.startY &&
            Rasterizer.heightMask >= y1
        ) {
            if (outlineWidth === 1) {
                Rasterizer.rasterRectangleOutlineWidth1(x0, x1, y0, y1, outlineColor);
            } else {
                Rasterizer.rasterRectangleOutline0(x0, x1, y0, y1, outlineColor, outlineWidth);
            }
        } else if (outlineWidth === 1) {
            Rasterizer.rasterRectangleOutlineWidth1Clamped(x0, x1, y0, y1, outlineColor);
        } else {
            Rasterizer.rasterRectangleOutlineClamped(x0, x1, y0, y1, outlineColor, outlineWidth);
        }
    }

    static rasterRectangleOutlineWidth1(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        outlineColor: number,
    ) {
        ArrayUtils.fillRange(Rasterizer.pixels[y0++], x0, x1, outlineColor);
        ArrayUtils.fillRange(Rasterizer.pixels[y1--], x0, x1, outlineColor);
        for (let local31 = y0; local31 <= y1; local31++) {
            const local42 = Rasterizer.pixels[local31];
            local42[x0] = local42[x1] = outlineColor;
        }
    }

    static rasterRectangleOutline0(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        const local10 = outlineWidth + y0;
        const local18 = y1 - outlineWidth;
        const local22 = outlineWidth + x0;
        for (let local24 = y0; local24 < local10; local24++) {
            ArrayUtils.fillRange(Rasterizer.pixels[local24], x0, x1, outlineColor);
        }
        for (let local44 = y1; local44 > local18; local44--) {
            ArrayUtils.fillRange(Rasterizer.pixels[local44], x0, x1, outlineColor);
        }
        const local66 = x1 - outlineWidth;
        for (let local68 = local10; local68 <= local18; local68++) {
            const local79 = Rasterizer.pixels[local68];
            ArrayUtils.fillRange(local79, x0, local22, outlineColor);
            ArrayUtils.fillRange(local79, local66, x1, outlineColor);
        }
    }

    static rasterRectangleOutlineWidth1Clamped(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        outlineColor: number,
    ) {
        if (Rasterizer.heightMask < y0 || Rasterizer.startY > y1) {
            return;
        }
        let local23: boolean;
        if (Rasterizer.startX > x0) {
            x0 = Rasterizer.startX;
            local23 = false;
        } else if (x0 > Rasterizer.widthMask) {
            x0 = Rasterizer.widthMask;
            local23 = false;
        } else {
            local23 = true;
        }
        let local51: boolean;
        if (x1 < Rasterizer.startX) {
            x1 = Rasterizer.startX;
            local51 = false;
        } else if (Rasterizer.widthMask < x1) {
            x1 = Rasterizer.widthMask;
            local51 = false;
        } else {
            local51 = true;
        }
        let local71: number;
        if (Rasterizer.startY <= y0) {
            local71 = y0 + 1;
            ArrayUtils.fillRange(Rasterizer.pixels[y0], x0, x1, outlineColor);
        } else {
            local71 = Rasterizer.startY;
        }
        let local89: number;
        if (Rasterizer.heightMask < y1) {
            local89 = Rasterizer.heightMask;
        } else {
            local89 = y1 - 1;
            ArrayUtils.fillRange(Rasterizer.pixels[y1], x0, x1, outlineColor);
        }
        if (local23 && local51) {
            for (let local106 = local71; local106 <= local89; local106++) {
                const local113 = Rasterizer.pixels[local106];
                local113[x0] = local113[x1] = outlineColor;
            }
        } else if (local23) {
            for (let local149 = local71; local149 <= local89; local149++) {
                Rasterizer.pixels[local149][x0] = outlineColor;
            }
        } else if (local51) {
            for (let local133 = local71; local133 <= local89; local133++) {
                Rasterizer.pixels[local133][x1] = outlineColor;
            }
        }
    }

    static rasterRectangleOutlineClamped(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        const local17 = clamp(y0, Rasterizer.startY, Rasterizer.heightMask);
        const local23 = clamp(y1, Rasterizer.startY, Rasterizer.heightMask);
        const local29 = clamp(x0, Rasterizer.startX, Rasterizer.widthMask);
        const local35 = clamp(x1, Rasterizer.startX, Rasterizer.widthMask);
        const local43 = clamp(outlineWidth + y0, Rasterizer.startY, Rasterizer.heightMask);
        const local52 = clamp(y1 - outlineWidth, Rasterizer.startY, Rasterizer.heightMask);
        for (let local54 = local17; local54 < local43; local54++) {
            ArrayUtils.fillRange(Rasterizer.pixels[local54], local29, local35, outlineColor);
        }
        for (let local70 = local23; local70 > local52; local70--) {
            ArrayUtils.fillRange(Rasterizer.pixels[local70], local29, local35, outlineColor);
        }
        const local97 = clamp(x0 + outlineWidth, Rasterizer.startX, Rasterizer.widthMask);
        const local106 = clamp(x1 - outlineWidth, Rasterizer.startX, Rasterizer.widthMask);
        for (let local108 = local43; local108 <= local52; local108++) {
            const local119 = Rasterizer.pixels[local108];
            ArrayUtils.fillRange(local119, local29, local97, outlineColor);
            ArrayUtils.fillRange(local119, local106, local35, outlineColor);
        }
    }

    static rasterEllipse(
        x: number,
        y: number,
        sizeX: number,
        sizeY: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        if (sizeX === sizeY) {
            Rasterizer.rasterCircle(x, y, sizeX, fillColor, outlineColor, outlineWidth);
        } else if (
            x - sizeX >= Rasterizer.startX &&
            Rasterizer.widthMask >= sizeX + x &&
            y - sizeY >= Rasterizer.startY &&
            sizeY + y <= Rasterizer.heightMask
        ) {
            Rasterizer.rasterEllipse0(x, y, sizeX, sizeY, fillColor, outlineColor, outlineWidth);
        } else {
            Rasterizer.rasterEllipseClamped(
                x,
                y,
                sizeX,
                sizeY,
                fillColor,
                outlineColor,
                outlineWidth,
            );
        }
    }

    static rasterEllipse0(
        x: number,
        y: number,
        sizeX: number,
        sizeY: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        let local7 = 0;
        let local9 = sizeY;
        const local14 = sizeX - outlineWidth;
        let local16 = 0;
        const local21 = sizeY - outlineWidth;
        const local25 = sizeX * sizeX;
        const local29 = sizeY * sizeY;
        const local33 = local14 * local14;
        const local37 = local21 * local21;
        const local41 = local29 << 1;
        const local45 = local37 << 1;
        const local49 = local25 << 1;
        const local53 = local33 << 1;
        const local57 = sizeY << 1;
        const local61 = local21 << 1;
        let local71 = local25 * (1 - local57) + local41;
        let local80 = local29 - local49 * (local57 - 1);
        let local89 = local45 + (1 - local61) * local33;
        let local98 = local37 - local53 * (local61 - 1);
        const local102 = local25 << 2;
        const local106 = local29 << 2;
        const local110 = local37 << 2;
        const local114 = local33 << 2;
        let local118 = local41 * 3;
        let local124 = local49 * (local57 - 3);
        let local128 = local45 * 3;
        let local130 = local106;
        let local136 = (local61 - 3) * local53;
        let local138 = local110;
        let local144 = (sizeY - 1) * local102;
        let local150 = local114 * (local21 - 1);
        const local154 = Rasterizer.pixels[y];
        ArrayUtils.fillRange(local154, x - sizeX, x - local14, outlineColor);
        ArrayUtils.fillRange(local154, x - local14, local14 + x, fillColor);
        ArrayUtils.fillRange(local154, local14 + x, x + sizeX, outlineColor);
        while (local9 > 0) {
            if (local71 < 0) {
                while (local71 < 0) {
                    local71 += local118;
                    local118 += local106;
                    local7++;
                    local80 += local130;
                    local130 += local106;
                }
            }
            if (local80 < 0) {
                local71 += local118;
                local80 += local130;
                local118 += local106;
                local7++;
                local130 += local106;
            }
            local71 += -local144;
            const local251 = x - local7;
            const local258 = local21 >= local9;
            const local263 = x + local7;
            local144 -= local102;
            local9--;
            local80 += -local124;
            const local277 = local9 + y;
            local124 -= local102;
            if (local258) {
                if (local89 < 0) {
                    while (local89 < 0) {
                        local16++;
                        local98 += local138;
                        local89 += local128;
                        local138 += local110;
                        local128 += local110;
                    }
                }
                if (local98 < 0) {
                    local89 += local128;
                    local128 += local110;
                    local16++;
                    local98 += local138;
                    local138 += local110;
                }
                local98 += -local136;
                local89 += -local150;
                local150 -= local114;
                local136 -= local114;
            }
            const local352 = y - local9;
            if (local258) {
                const local358 = x - local16;
                ArrayUtils.fillRange(Rasterizer.pixels[local352], local251, local358, outlineColor);
                const local371 = x + local16;
                ArrayUtils.fillRange(Rasterizer.pixels[local352], local358, local371, fillColor);
                ArrayUtils.fillRange(Rasterizer.pixels[local352], local371, local263, outlineColor);
                ArrayUtils.fillRange(Rasterizer.pixels[local277], local251, local358, outlineColor);
                ArrayUtils.fillRange(Rasterizer.pixels[local277], local358, local371, fillColor);
                ArrayUtils.fillRange(Rasterizer.pixels[local277], local371, local263, outlineColor);
            } else {
                ArrayUtils.fillRange(Rasterizer.pixels[local352], local251, local263, outlineColor);
                ArrayUtils.fillRange(Rasterizer.pixels[local277], local251, local263, outlineColor);
            }
        }
    }

    static rasterEllipseClamped(
        x: number,
        y: number,
        sizeX: number,
        sizeY: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        let local3 = 0;
        const local7 = sizeY - outlineWidth;
        let local9 = sizeY;
        let local11 = 0;
        const local16 = sizeX - outlineWidth;
        const local20 = sizeX * sizeX;
        const local28 = sizeY * sizeY;
        const local32 = local16 * local16;
        const local36 = local28 << 1;
        const local40 = local7 * local7;
        const local44 = local20 << 1;
        const local48 = local40 << 1;
        const local52 = local32 << 1;
        const local56 = sizeY << 1;
        const local60 = local7 << 1;
        let local69 = local36 + (1 - local56) * local20;
        let local78 = local28 - (local56 - 1) * local44;
        let local87 = local32 * (1 - local60) + local48;
        const local91 = local20 << 2;
        let local104 = local40 - local52 * (local60 - 1);
        const local108 = local28 << 2;
        const local112 = local32 << 2;
        const local116 = local40 << 2;
        let local120 = local36 * 3;
        let local124 = local48 * 3;
        let local130 = local44 * (local56 - 3);
        let local132 = local108;
        let local138 = (local60 - 3) * local52;
        let local144 = local91 * (sizeY - 1);
        let local146 = local116;
        let local152 = (local7 - 1) * local112;
        if (y >= Rasterizer.startY && Rasterizer.heightMask >= y) {
            const local166 = Rasterizer.pixels[y];
            const local177 = clamp(x - sizeX, Rasterizer.startX, Rasterizer.widthMask);
            const local185 = clamp(x + sizeX, Rasterizer.startX, Rasterizer.widthMask);
            const local193 = clamp(x - local16, Rasterizer.startX, Rasterizer.widthMask);
            const local203 = clamp(x + local16, Rasterizer.startX, Rasterizer.widthMask);
            ArrayUtils.fillRange(local166, local177, local193, outlineColor);
            ArrayUtils.fillRange(local166, local193, local203, fillColor);
            ArrayUtils.fillRange(local166, local203, local185, outlineColor);
        }
        while (local9 > 0) {
            if (local69 < 0) {
                while (local69 < 0) {
                    local69 += local120;
                    local3++;
                    local120 += local108;
                    local78 += local132;
                    local132 += local108;
                }
            }
            if (local78 < 0) {
                local3++;
                local69 += local120;
                local120 += local108;
                local78 += local132;
                local132 += local108;
            }
            const local281 = local7 >= local9;
            local78 += -local130;
            local9--;
            if (local281) {
                if (local87 < 0) {
                    while (local87 < 0) {
                        local87 += local124;
                        local104 += local146;
                        local124 += local116;
                        local146 += local116;
                        local11++;
                    }
                }
                if (local104 < 0) {
                    local87 += local124;
                    local124 += local116;
                    local104 += local146;
                    local146 += local116;
                    local11++;
                }
                local104 += -local138;
                local138 -= local112;
                local87 += -local152;
                local152 -= local112;
            }
            local69 += -local144;
            const local363 = local9 + y;
            const local367 = y - local9;
            local144 -= local91;
            local130 -= local91;
            if (local363 >= Rasterizer.startY && Rasterizer.heightMask >= local367) {
                const local389 = clamp(local3 + x, Rasterizer.startX, Rasterizer.widthMask);
                const local398 = clamp(x - local3, Rasterizer.startX, Rasterizer.widthMask);
                if (local281) {
                    const local409 = clamp(x + local11, Rasterizer.startX, Rasterizer.widthMask);
                    const local418 = clamp(x - local11, Rasterizer.startX, Rasterizer.widthMask);
                    if (Rasterizer.startY <= local367) {
                        const local426 = Rasterizer.pixels[local367];
                        ArrayUtils.fillRange(local426, local398, local418, outlineColor);
                        ArrayUtils.fillRange(local426, local418, local409, fillColor);
                        ArrayUtils.fillRange(local426, local409, local389, outlineColor);
                    }
                    if (Rasterizer.heightMask >= local363) {
                        const local456 = Rasterizer.pixels[local363];
                        ArrayUtils.fillRange(local456, local398, local418, outlineColor);
                        ArrayUtils.fillRange(local456, local418, local409, fillColor);
                        ArrayUtils.fillRange(local456, local409, local389, outlineColor);
                    }
                } else {
                    if (local367 >= Rasterizer.startY) {
                        ArrayUtils.fillRange(
                            Rasterizer.pixels[local367],
                            local398,
                            local389,
                            outlineColor,
                        );
                    }
                    if (Rasterizer.heightMask >= local363) {
                        ArrayUtils.fillRange(
                            Rasterizer.pixels[local363],
                            local398,
                            local389,
                            outlineColor,
                        );
                    }
                }
            }
        }
    }

    static rasterCircle(
        x: number,
        y: number,
        size: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        if (
            Rasterizer.startX <= x - size &&
            size + x <= Rasterizer.widthMask &&
            y - size >= Rasterizer.startY &&
            Rasterizer.heightMask >= size + y
        ) {
            Rasterizer.rasterCircle0(x, y, size, fillColor, outlineColor, outlineWidth);
        } else {
            Rasterizer.rasterCircleClamped(x, y, size, fillColor, outlineColor, outlineWidth);
        }
    }

    static rasterCircle0(
        x: number,
        y: number,
        size: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        Rasterizer.initCircleOutline(size);
        let local10 = 0;
        let local13 = -size;
        let local17 = size - outlineWidth;
        let local19 = size;
        let local21 = -1;
        let local23 = -1;
        const local27 = Rasterizer.pixels[y];
        if (local17 < 0) {
            local17 = 0;
        }
        let local34 = local17;
        const local39 = x - local17;
        ArrayUtils.fillRange(local27, x - size, local39, outlineColor);
        const local57 = local17 + x;
        let local60 = -local17;
        ArrayUtils.fillRange(local27, local39, local57, fillColor);
        ArrayUtils.fillRange(local27, local57, x + size, outlineColor);
        while (local19 > local10) {
            local23 += 2;
            local13 += local23;
            local21 += 2;
            local60 += local21;
            if (local60 >= 0 && local34 >= 1) {
                Rasterizer.circleOutline[local34] = local10;
                local34--;
                local60 -= local34 << 1;
            }
            local10++;
            if (local13 >= 0) {
                local19--;
                if (local19 >= local17) {
                    const local126 = Rasterizer.pixels[y + local19];
                    const local131 = x + local10;
                    const local138 = Rasterizer.pixels[y - local19];
                    const local143 = x - local10;
                    ArrayUtils.fillRange(local126, local143, local131, outlineColor);
                    ArrayUtils.fillRange(local138, local143, local131, outlineColor);
                } else {
                    const local163 = Rasterizer.pixels[local19 + y];
                    const local167 = Rasterizer.circleOutline[local19];
                    const local174 = Rasterizer.pixels[y - local19];
                    const local178 = local10 + x;
                    const local182 = x - local167;
                    const local186 = local167 + x;
                    const local191 = x - local10;
                    ArrayUtils.fillRange(local163, local191, local182, outlineColor);
                    ArrayUtils.fillRange(local163, local182, local186, fillColor);
                    ArrayUtils.fillRange(local163, local186, local178, outlineColor);
                    ArrayUtils.fillRange(local174, local191, local182, outlineColor);
                    ArrayUtils.fillRange(local174, local182, local186, fillColor);
                    ArrayUtils.fillRange(local174, local186, local178, outlineColor);
                }
                local13 -= local19 << 1;
            }
            const local240 = Rasterizer.pixels[y + local10];
            const local247 = Rasterizer.pixels[y - local10];
            const local251 = local19 + x;
            const local256 = x - local19;
            if (local17 <= local10) {
                ArrayUtils.fillRange(local240, local256, local251, outlineColor);
                ArrayUtils.fillRange(local247, local256, local251, outlineColor);
            } else {
                const local286 = local10 > local34 ? Rasterizer.circleOutline[local10] : local34;
                const local290 = local286 + x;
                const local294 = x - local286;
                ArrayUtils.fillRange(local240, local256, local294, outlineColor);
                ArrayUtils.fillRange(local240, local294, local290, fillColor);
                ArrayUtils.fillRange(local240, local290, local251, outlineColor);
                ArrayUtils.fillRange(local247, local256, local294, outlineColor);
                ArrayUtils.fillRange(local247, local294, local290, fillColor);
                ArrayUtils.fillRange(local247, local290, local251, outlineColor);
            }
        }
    }

    static rasterCircleClamped(
        x: number,
        y: number,
        size: number,
        fillColor: number,
        outlineColor: number,
        outlineWidth: number,
    ) {
        Rasterizer.initCircleOutline(size);
        let local9 = size - outlineWidth;
        let local15 = size;
        let local17 = 0;
        let local20 = -size;
        if (local9 < 0) {
            local9 = 0;
        }
        let local29 = local9;
        if (Rasterizer.startY <= y && y <= Rasterizer.heightMask) {
            const local40 = Rasterizer.pixels[y];
            const local48 = clamp(x - size, Rasterizer.startX, Rasterizer.widthMask);
            const local56 = clamp(size + x, Rasterizer.startX, Rasterizer.widthMask);
            const local67 = clamp(x - local9, Rasterizer.startX, Rasterizer.widthMask);
            const local77 = clamp(x + local9, Rasterizer.startX, Rasterizer.widthMask);
            ArrayUtils.fillRange(local40, local48, local67, outlineColor);
            ArrayUtils.fillRange(local40, local67, local77, fillColor);
            ArrayUtils.fillRange(local40, local77, local56, outlineColor);
        }
        let local98 = -local9;
        let local100 = -1;
        let local102 = -1;
        while (local17 < local15) {
            local100 += 2;
            local98 += local100;
            local102 += 2;
            if (local98 >= 0 && local29 >= 1) {
                local29--;
                local98 -= local29 << 1;
                Rasterizer.circleOutline[local29] = local17;
            }
            local17++;
            local20 += local102;
            if (local20 >= 0) {
                local15--;
                local20 -= local15 << 1;
                const local154 = y - local15;
                const local159 = y + local15;
                if (Rasterizer.startY <= local159 && local154 <= Rasterizer.heightMask) {
                    if (local15 >= local9) {
                        const local186 = clamp(
                            x + local17,
                            Rasterizer.startX,
                            Rasterizer.widthMask,
                        );
                        const local194 = clamp(
                            x - local17,
                            Rasterizer.startX,
                            Rasterizer.widthMask,
                        );
                        if (Rasterizer.heightMask >= local159) {
                            ArrayUtils.fillRange(
                                Rasterizer.pixels[local159],
                                local194,
                                local186,
                                outlineColor,
                            );
                        }
                        if (local154 >= Rasterizer.startY) {
                            ArrayUtils.fillRange(
                                Rasterizer.pixels[local154],
                                local194,
                                local186,
                                outlineColor,
                            );
                        }
                    } else {
                        const local226 = Rasterizer.circleOutline[local15];
                        const local237 = clamp(
                            x + local17,
                            Rasterizer.startX,
                            Rasterizer.widthMask,
                        );
                        const local245 = clamp(
                            x - local17,
                            Rasterizer.startX,
                            Rasterizer.widthMask,
                        );
                        const local254 = clamp(
                            x + local226,
                            Rasterizer.startX,
                            Rasterizer.widthMask,
                        );
                        const local262 = clamp(
                            x - local226,
                            Rasterizer.startX,
                            Rasterizer.widthMask,
                        );
                        if (Rasterizer.heightMask >= local159) {
                            const local274 = Rasterizer.pixels[local159];
                            ArrayUtils.fillRange(local274, local245, local262, outlineColor);
                            ArrayUtils.fillRange(local274, local262, local254, fillColor);
                            ArrayUtils.fillRange(local274, local254, local237, outlineColor);
                        }
                        if (Rasterizer.startY <= local154) {
                            const local300 = Rasterizer.pixels[local154];
                            ArrayUtils.fillRange(local300, local245, local262, outlineColor);
                            ArrayUtils.fillRange(local300, local262, local254, fillColor);
                            ArrayUtils.fillRange(local300, local254, local237, outlineColor);
                        }
                    }
                }
            }
            const local322 = y + local17;
            const local327 = y - local17;
            if (Rasterizer.startY <= local322 && Rasterizer.heightMask >= local327) {
                const local337 = local15 + x;
                const local342 = x - local15;
                if (local337 >= Rasterizer.startX && Rasterizer.widthMask >= local342) {
                    const local359 = clamp(local337, Rasterizer.startX, Rasterizer.widthMask);
                    const local365 = clamp(local342, Rasterizer.startX, Rasterizer.widthMask);
                    if (local17 >= local9) {
                        if (Rasterizer.heightMask >= local322) {
                            ArrayUtils.fillRange(
                                Rasterizer.pixels[local322],
                                local365,
                                local359,
                                outlineColor,
                            );
                        }
                        if (Rasterizer.startY <= local327) {
                            ArrayUtils.fillRange(
                                Rasterizer.pixels[local327],
                                local365,
                                local359,
                                outlineColor,
                            );
                        }
                    } else {
                        const local415 =
                            local29 >= local17 ? local29 : Rasterizer.circleOutline[local17];
                        const local424 = clamp(
                            x + local415,
                            Rasterizer.startX,
                            Rasterizer.widthMask,
                        );
                        const local432 = clamp(
                            x - local415,
                            Rasterizer.startX,
                            Rasterizer.widthMask,
                        );
                        if (Rasterizer.heightMask >= local322) {
                            const local440 = Rasterizer.pixels[local322];
                            ArrayUtils.fillRange(local440, local365, local432, outlineColor);
                            ArrayUtils.fillRange(local440, local432, local424, fillColor);
                            ArrayUtils.fillRange(local440, local424, local359, outlineColor);
                        }
                        if (Rasterizer.startY <= local327) {
                            const local469 = Rasterizer.pixels[local327];
                            ArrayUtils.fillRange(local469, local365, local432, outlineColor);
                            ArrayUtils.fillRange(local469, local432, local424, fillColor);
                            ArrayUtils.fillRange(local469, local424, local359, outlineColor);
                        }
                    }
                }
            }
        }
    }

    static rasterEllipseFill(
        x: number,
        y: number,
        sizeX: number,
        sizeY: number,
        fillColor: number,
    ) {
        if (sizeX === sizeY) {
            Rasterizer.rasterCircleFill(x, y, sizeX, fillColor);
        } else if (
            Rasterizer.startX <= x - sizeX &&
            Rasterizer.widthMask >= x + sizeX &&
            y - sizeY >= Rasterizer.startY &&
            Rasterizer.heightMask >= y + sizeY
        ) {
            Rasterizer.rasterEllipseFill0(x, y, sizeX, sizeY, fillColor);
        } else {
            Rasterizer.rasterEllipseFillClamped(x, y, sizeX, sizeY, fillColor);
        }
    }

    static rasterEllipseFill0(
        x: number,
        y: number,
        sizeX: number,
        sizeY: number,
        fillColor: number,
    ) {
        ArrayUtils.fillRange(Rasterizer.pixels[y], x - sizeX, sizeX + x, fillColor);
        let local20 = 0;
        let local22 = sizeY;
        const local26 = sizeX * sizeX;
        const local34 = sizeY * sizeY;
        const local38 = local26 << 1;
        const local42 = sizeY << 1;
        const local46 = local34 << 1;
        let local54 = local34 - local38 * (local42 - 1);
        let local63 = local46 + (1 - local42) * local26;
        const local67 = local26 << 2;
        let local75 = local46 * 3;
        let local83 = local38 * ((sizeY << 1) - 3);
        const local87 = local34 << 2;
        let local93 = local87;
        let local99 = (sizeY - 1) * local67;
        while (local22 > 0) {
            if (local63 < 0) {
                while (local63 < 0) {
                    local20++;
                    local63 += local75;
                    local54 += local93;
                    local93 += local87;
                    local75 += local87;
                }
            }
            local22--;
            if (local54 < 0) {
                local54 += local93;
                local63 += local75;
                local75 += local87;
                local93 += local87;
                local20++;
            }
            const local150 = y - local22;
            local63 += -local99;
            const local159 = x + local20;
            local99 -= local67;
            const local167 = local22 + y;
            local54 += -local83;
            local83 -= local67;
            const local181 = x - local20;
            ArrayUtils.fillRange(Rasterizer.pixels[local150], local181, local159, fillColor);
            ArrayUtils.fillRange(Rasterizer.pixels[local167], local181, local159, fillColor);
        }
    }

    static rasterEllipseFillClamped(
        x: number,
        y: number,
        sizeX: number,
        sizeY: number,
        fillColor: number,
    ) {
        let local7 = sizeY;
        let local9 = 0;
        const local21 = sizeY * sizeY;
        const local25 = sizeX * sizeX;
        const local29 = local25 << 1;
        const local33 = local21 << 1;
        const local37 = sizeY << 1;
        let local46 = local21 - (local37 - 1) * local29;
        let local56 = (1 - local37) * local25 + local33;
        const local60 = local25 << 2;
        const local64 = local21 << 2;
        let local72 = local33 * 3;
        let local78 = local64;
        let local86 = ((sizeY << 1) - 3) * local29;
        if (y >= Rasterizer.startY && Rasterizer.heightMask >= y) {
            const local109 = clamp(x + sizeX, Rasterizer.startX, Rasterizer.widthMask);
            const local117 = clamp(x - sizeX, Rasterizer.startX, Rasterizer.widthMask);
            ArrayUtils.fillRange(Rasterizer.pixels[y], local117, local109, fillColor);
        }
        let local131 = local60 * (sizeY - 1);
        while (local7 > 0) {
            if (local56 < 0) {
                while (local56 < 0) {
                    local56 += local72;
                    local46 += local78;
                    local78 += local64;
                    local72 += local64;
                    local9++;
                }
            }
            local7--;
            if (local46 < 0) {
                local46 += local78;
                local78 += local64;
                local56 += local72;
                local9++;
                local72 += local64;
            }
            local56 += -local131;
            const local198 = y - local7;
            local46 += -local86;
            local131 -= local60;
            const local211 = local7 + y;
            local86 -= local60;
            if (local211 >= Rasterizer.startY && Rasterizer.heightMask >= local198) {
                const local229 = clamp(local9 + x, Rasterizer.startX, Rasterizer.widthMask);
                const local237 = clamp(x - local9, Rasterizer.startX, Rasterizer.widthMask);
                if (Rasterizer.startY <= local198) {
                    ArrayUtils.fillRange(
                        Rasterizer.pixels[local198],
                        local237,
                        local229,
                        fillColor,
                    );
                }
                if (local211 <= Rasterizer.heightMask) {
                    ArrayUtils.fillRange(
                        Rasterizer.pixels[local211],
                        local237,
                        local229,
                        fillColor,
                    );
                }
            }
        }
    }

    static rasterCircleFill(x: number, y: number, size: number, fillColor: number) {
        if (
            x - size >= Rasterizer.startX &&
            Rasterizer.widthMask >= x + size &&
            y - size >= Rasterizer.startY &&
            y + size <= Rasterizer.heightMask
        ) {
            Rasterizer.rasterCircleFill0(x, y, size, fillColor);
        } else {
            Rasterizer.rasterCircleFillClamped(x, y, size, fillColor);
        }
    }

    static rasterCircleFill0(x: number, y: number, size: number, fillColor: number) {
        ArrayUtils.fillRange(Rasterizer.pixels[y], x - size, size + x, fillColor);
        let local20 = 0;
        let local33 = size;
        let local36 = -size;
        let local38 = -1;
        while (local33 > local20) {
            local38 += 2;
            local20++;
            local36 += local38;
            if (local36 >= 0) {
                local33--;
                local36 -= local33 << 1;
                const local69 = Rasterizer.pixels[y - local33];
                const local76 = Rasterizer.pixels[y + local33];
                const local80 = x - local20;
                const local84 = x + local20;
                ArrayUtils.fillRange(local76, local80, local84, fillColor);
                ArrayUtils.fillRange(local69, local80, local84, fillColor);
            }
            const local101 = x + local33;
            const local106 = x - local33;
            const local112 = Rasterizer.pixels[y + local20];
            const local118 = Rasterizer.pixels[y - local20];
            ArrayUtils.fillRange(local112, local106, local101, fillColor);
            ArrayUtils.fillRange(local118, local106, local101, fillColor);
        }
    }

    static rasterCircleFillClamped(x: number, y: number, size: number, fillColor: number) {
        let local3 = 0;
        let local14 = size;
        let local16 = -1;
        let local19 = -size;
        let local27 = clamp(size + x, Rasterizer.startX, Rasterizer.widthMask);
        let local35 = clamp(x - size, Rasterizer.startX, Rasterizer.widthMask);
        ArrayUtils.fillRange(Rasterizer.pixels[y], local35, local27, fillColor);
        while (local14 > local3) {
            local16 += 2;
            local19 += local16;
            if (local19 > 0) {
                local14--;
                local19 -= local14 << 1;
                const local72 = y - local14;
                const local76 = local14 + y;
                if (local76 >= Rasterizer.startY && local72 <= Rasterizer.heightMask) {
                    let local98 = clamp(x + local3, Rasterizer.startX, Rasterizer.widthMask);
                    let local106 = clamp(x - local3, Rasterizer.startX, Rasterizer.widthMask);
                    if (Rasterizer.heightMask >= local76) {
                        ArrayUtils.fillRange(
                            Rasterizer.pixels[local76],
                            local106,
                            local98,
                            fillColor,
                        );
                    }
                    if (Rasterizer.startY <= local72) {
                        ArrayUtils.fillRange(
                            Rasterizer.pixels[local72],
                            local106,
                            local98,
                            fillColor,
                        );
                    }
                }
            }
            local3++;
            const local138 = y - local3;
            const local142 = y + local3;
            if (Rasterizer.startY <= local142 && local138 <= Rasterizer.heightMask) {
                const local166 = clamp(x + local14, Rasterizer.startX, Rasterizer.widthMask);
                const local174 = clamp(x - local14, Rasterizer.startX, Rasterizer.widthMask);
                if (local142 <= Rasterizer.heightMask) {
                    ArrayUtils.fillRange(
                        Rasterizer.pixels[local142],
                        local174,
                        local166,
                        fillColor,
                    );
                }
                if (Rasterizer.startY <= local138) {
                    ArrayUtils.fillRange(
                        Rasterizer.pixels[local138],
                        local174,
                        local166,
                        fillColor,
                    );
                }
            }
        }
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

    override renderOutline(width: number, height: number): void {
        const x0 = (this.x0 * width) >> 12;
        const x1 = (this.x1 * width) >> 12;
        const y0 = (this.y0 * height) >> 12;
        const y1 = (this.y1 * height) >> 12;
        Rasterizer.rasterLine(x0, x1, y0, y1, this.outlineColor);
    }
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

    override renderOutline(width: number, height: number): void {
        const x0 = (width * this.x0) >> 12;
        const y0 = (height * this.y0) >> 12;
        const x1 = (width * this.x1) >> 12;
        const y1 = (height * this.y1) >> 12;
        const x2 = (width * this.x2) >> 12;
        const y2 = (height * this.y2) >> 12;
        const x3 = (width * this.x3) >> 12;
        const y3 = (height * this.y3) >> 12;
        Rasterizer.rasterBezierCurve(x0, y0, x1, y1, x2, y2, x3, y3, this.outlineColor);
    }
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

    override render(width: number, height: number): void {
        const x0 = (this.x0 * width) >> 12;
        const x1 = (this.x1 * width) >> 12;
        const y0 = (this.y0 * height) >> 12;
        const y1 = (this.y1 * height) >> 12;
        Rasterizer.rasterRectangle(
            x0,
            x1,
            y0,
            y1,
            this.fillColor,
            this.outlineColor,
            this.outlineWidth,
        );
    }

    override renderFill(width: number, height: number): void {
        const x0 = (this.x0 * width) >> 12;
        const x1 = (this.x1 * width) >> 12;
        const y0 = (this.y0 * height) >> 12;
        const y1 = (this.y1 * height) >> 12;
        Rasterizer.rasterRectangleFill(x0, x1, y0, y1, this.fillColor);
    }

    override renderOutline(width: number, height: number): void {
        const x0 = (this.x0 * width) >> 12;
        const x1 = (this.x1 * width) >> 12;
        const y0 = (this.y0 * height) >> 12;
        const y1 = (this.y1 * height) >> 12;
        Rasterizer.rasterRectangleOutline(x0, x1, y0, y1, this.outlineColor, this.outlineWidth);
    }
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

    override render(width: number, height: number): void {
        const x = (this.x * width) >> 12;
        const y = (this.y * height) >> 12;
        const sizeX = (this.sizeX * width) >> 12;
        const sizeY = (this.sizeY * height) >> 12;
        Rasterizer.rasterEllipse(
            x,
            y,
            sizeX,
            sizeY,
            this.fillColor,
            this.outlineColor,
            this.outlineWidth,
        );
    }

    override renderFill(width: number, height: number): void {
        const x = (this.x * width) >> 12;
        const y = (this.y * height) >> 12;
        const sizeX = (this.sizeX * width) >> 12;
        const sizeY = (this.sizeY * height) >> 12;
        Rasterizer.rasterEllipseFill(x, y, sizeX, sizeY, this.fillColor);
    }

    override renderOutline(width: number, height: number): void {}
}
