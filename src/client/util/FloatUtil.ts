export class FloatUtil {
    static float: Float32Array = new Float32Array(1);
    static integer: Int32Array = new Int32Array(FloatUtil.float.buffer);

    static floatToIntBits(n: number): number {
        FloatUtil.float[0] = n;
        return FloatUtil.integer[0];
    }

    static intToFloatBits(n: number): number {
        FloatUtil.integer[0] = n;
        return FloatUtil.float[0];
    }

    static packFloat11(v: number): number {
        return 1024 - Math.round(v / (1 / 64));
    }
    
    static unpackFloat11(v: number): number {
        return 16 - v / 64;
    }
    
    // 0-1, 1/63 decimal precision
    static packFloat6(v: number): number {
        return Math.round(v / (1 / 63));
    }
    
    static unpackFloat6(v: number): number {
        return v / 63;
    }
}
