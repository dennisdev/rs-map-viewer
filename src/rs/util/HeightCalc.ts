import { COSINE } from "../MathConstants";

function interpolate(i: number, i_4_: number, i_5_: number, freq: number): number {
    const i_8_ = (65536 - COSINE[(i_5_ * 1024) / freq]) >> 1;
    return ((i_8_ * i_4_) >> 16) + (((65536 - i_8_) * i) >> 16);
}

function noise(x: number, y: number): number {
    let n = y * 57 + x;
    n = (n << 13) ^ n;
    const n2 = (Math.imul(n, Math.imul(Math.imul(n, n), 15731) + 789221) + 1376312589) & 0x7fffffff;
    return (n2 >> 19) & 0xff;
}

function smoothedNoise1(x: number, y: number): number {
    const corners =
        noise(x - 1, y - 1) + noise(x + 1, y - 1) + noise(x - 1, y + 1) + noise(x + 1, y + 1);
    const sides = noise(x - 1, y) + noise(x + 1, y) + noise(x, y - 1) + noise(x, y + 1);
    const center = noise(x, y);
    return ((center / 4) | 0) + ((sides / 8) | 0) + ((corners / 16) | 0);
}

function interpolateNoise(x: number, y: number, freq: number): number {
    const i_23_ = (x / freq) | 0;
    const i_24_ = x & (freq - 1);
    const i_25_ = (y / freq) | 0;
    const i_26_ = y & (freq - 1);
    const i_27_ = smoothedNoise1(i_23_, i_25_);
    const i_28_ = smoothedNoise1(i_23_ + 1, i_25_);
    const i_29_ = smoothedNoise1(i_23_, i_25_ + 1);
    const i_30_ = smoothedNoise1(i_23_ + 1, i_25_ + 1);
    const i_31_ = interpolate(i_27_, i_28_, i_24_, freq);
    const i_32_ = interpolate(i_29_, i_30_, i_24_, freq);
    return interpolate(i_31_, i_32_, i_26_, freq);
}

export function generateHeight(x: number, y: number) {
    let n =
        interpolateNoise(x + 45365, y + 91923, 4) -
        128 +
        ((interpolateNoise(x + 10294, y + 37821, 2) - 128) >> 1) +
        ((interpolateNoise(x, y, 1) - 128) >> 2);
    n = ((0.3 * n) | 0) + 35;
    if (n < 10) {
        n = 10;
    } else if (n > 60) {
        n = 60;
    }
    return n;
}
