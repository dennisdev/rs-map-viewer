export class Rasterizer2D {
    static pixels: Int32Array;

    static width: number;
    static height: number;

    static xClipStart: number;
    static yClipStart: number;
    static xClipEnd: number;
    static yClipEnd: number;

    static setRaster(pixels: Int32Array, width: number, height: number) {
        Rasterizer2D.pixels = pixels;
        Rasterizer2D.width = width;
        Rasterizer2D.height = height;
        Rasterizer2D.setClip(0, 0, width, height);
    }

    static setClip(x: number, y: number, width: number, height: number) {
        if (x < 0) {
            x = 0;
        }

        if (y < 0) {
            y = 0;
        }

        if (width > Rasterizer2D.width) {
            width = Rasterizer2D.width;
        }

        if (height > Rasterizer2D.height) {
            height = Rasterizer2D.height;
        }

        Rasterizer2D.xClipStart = x;
        Rasterizer2D.yClipStart = y;
        Rasterizer2D.xClipEnd = width;
        Rasterizer2D.yClipEnd = height;
    }

    static fillRectangle(x: number, y: number, width: number, height: number, rgb: number) {
        if (x < Rasterizer2D.xClipStart) {
            width -= Rasterizer2D.xClipStart - x;
            x = Rasterizer2D.xClipStart;
        }

        if (y < Rasterizer2D.yClipStart) {
            height -= Rasterizer2D.yClipStart - y;
            y = Rasterizer2D.yClipStart;
        }

        if (x + width > Rasterizer2D.xClipEnd) {
            width = Rasterizer2D.xClipEnd - x;
        }

        if (height + y > Rasterizer2D.yClipEnd) {
            height = Rasterizer2D.yClipEnd - y;
        }

        const widthOffset = Rasterizer2D.width - width;
        let offset = x + Rasterizer2D.width * y;

        for (let h = -height; h < 0; h++) {
            for (let w = -width; w < 0; w++) {
                Rasterizer2D.pixels[offset++] = rgb;
            }

            offset += widthOffset;
        }
    }
}
