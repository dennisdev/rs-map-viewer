export const SINE = new Int32Array(2048);
export const COSINE = new Int32Array(2048);

for (let i = 0; i < 2048; i++) {
    SINE[i] = (65536.0 * Math.sin(i * 0.0030679615)) | 0;
    COSINE[i] = (65536.0 * Math.cos(i * 0.0030679615)) | 0;
}

export function brightenRgb(rgb: number, brightness: number) {
    let r = (rgb >> 16) / 256.0;
    let g = (rgb >> 8 & 255) / 256.0;
    let b = (rgb & 255) / 256.0;
    r = Math.pow(r, brightness);
    g = Math.pow(g, brightness);
    b = Math.pow(b, brightness);
    const newR = (r * 256.0) | 0;
    const newG = (g * 256.0) | 0;
    const newB = (b * 256.0) | 0;
    return (newR << 16) | (newG << 8) | newB;
}

function buildPalette(brightness: number, var2: number, var3: number): Int32Array {
    const palette = new Int32Array(0xFFFF);

    let paletteIndex = var2 * 128;

    for (let var5 = var2; var5 < var3; var5++) {
        let var6 = (var5 >> 3) / 64.0 + 0.0078125;
        let var8 = (var5 & 7) / 8.0 + 0.0625;

        for (let var10 = 0; var10 < 128; var10++) {
            const var11 = var10 / 128.0;
            let var13 = var11;
            let var15 = var11;
            let var17 = var11;
            if (var8 != 0.0) {
                let var19: number;
                if (var11 < 0.5) {
                    var19 = var11 * (1.0 + var8);
                } else {
                    var19 = var11 + var8 - var11 * var8;
                }

                const var21 = 2.0 * var11 - var19;
                let var23 = var6 + 0.3333333333333333;
                if (var23 > 1.0) {
                    var23--;
                }

                let var27 = var6 - 0.3333333333333333;
                if (var27 < 0.0) {
                    var27++;
                }

                if (6.0 * var23 < 1.0) {
                    var13 = var21 + (var19 - var21) * 6.0 * var23;
                } else if (2.0 * var23 < 1.0) {
                    var13 = var19;
                } else if (3.0 * var23 < 2.0) {
                    var13 = var21 + (var19 - var21) * (0.6666666666666666 - var23) * 6.0;
                } else {
                    var13 = var21;
                }

                if (6.0 * var6 < 1.0) {
                    var15 = var21 + (var19 - var21) * 6.0 * var6;
                } else if (2.0 * var6 < 1.0) {
                    var15 = var19;
                } else if (3.0 * var6 < 2.0) {
                    var15 = var21 + (var19 - var21) * (0.6666666666666666 - var6) * 6.0;
                } else {
                    var15 = var21;
                }

                if (6.0 * var27 < 1.0) {
                    var17 = var21 + (var19 - var21) * 6.0 * var27;
                } else if (2.0 * var27 < 1.0) {
                    var17 = var19;
                } else if (3.0 * var27 < 2.0) {
                    var17 = var21 + (var19 - var21) * (0.6666666666666666 - var27) * 6.0;
                } else {
                    var17 = var21;
                }
            }

            const r = (var13 * 256.0) | 0;
            const g = (var15 * 256.0) | 0;
            const b = (var17 * 256.0) | 0;
            const rgb = (r << 16) + (g << 8) + b;

            let newRgb = brightenRgb(rgb, brightness);
            if (newRgb == 0) {
                newRgb = 1;
            }

            palette[paletteIndex++] = brightenRgb(rgb, brightness);
        }
    }

    return palette;
}

export const HSL_RGB_MAP = buildPalette(0.9, 0, 512);

console.log(HSL_RGB_MAP);

export class Client {

}
