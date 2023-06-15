export class Rasterizer2D {
    public static pixels: Int32Array;

    public static width: number;
    public static height: number;

    public static xClipStart: number;
    public static yClipStart: number;
    public static xClipEnd: number;
    public static yClipEnd: number;

    static setRaster(pixels: Int32Array, width: number, height: number) {
        Rasterizer2D.pixels = pixels;
        Rasterizer2D.width = width;
        Rasterizer2D.height = height;
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
}
