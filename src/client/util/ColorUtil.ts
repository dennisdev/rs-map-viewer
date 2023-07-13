export function buildPalette(
    brightness: number,
    var2: number,
    var3: number
): Int32Array {
    const palette = new Int32Array(0xffff);

    let paletteIndex = var2 * 128;

    for (let var5 = var2; var5 < var3; var5++) {
        let var6 = (var5 >> 3) / 64.0 + 0.0078125;
        let var8 = (var5 & 7) / 8.0 + 0.0625;

        for (let var10 = 0; var10 < 128; var10++) {
            const var11 = var10 / 128.0;
            let var13 = var11;
            let var15 = var11;
            let var17 = var11;
            if (var8 !== 0.0) {
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
                    var13 =
                        var21 +
                        (var19 - var21) * (0.6666666666666666 - var23) * 6.0;
                } else {
                    var13 = var21;
                }

                if (6.0 * var6 < 1.0) {
                    var15 = var21 + (var19 - var21) * 6.0 * var6;
                } else if (2.0 * var6 < 1.0) {
                    var15 = var19;
                } else if (3.0 * var6 < 2.0) {
                    var15 =
                        var21 +
                        (var19 - var21) * (0.6666666666666666 - var6) * 6.0;
                } else {
                    var15 = var21;
                }

                if (6.0 * var27 < 1.0) {
                    var17 = var21 + (var19 - var21) * 6.0 * var27;
                } else if (2.0 * var27 < 1.0) {
                    var17 = var19;
                } else if (3.0 * var27 < 2.0) {
                    var17 =
                        var21 +
                        (var19 - var21) * (0.6666666666666666 - var27) * 6.0;
                } else {
                    var17 = var21;
                }
            }

            const r = (var13 * 256.0) | 0;
            const g = (var15 * 256.0) | 0;
            const b = (var17 * 256.0) | 0;
            const rgb = (r << 16) + (g << 8) + b;

            let newRgb = brightenRgb(rgb, brightness);
            if (newRgb === 0) {
                newRgb = 1;
            }

            palette[paletteIndex++] = brightenRgb(rgb, brightness);
        }
    }

    return palette;
}

export const HSL_RGB_MAP = buildPalette(0.9, 0, 512);

export function brightenRgb(rgb: number, brightness: number) {
    let r = (rgb >> 16) / 256.0;
    let g = ((rgb >> 8) & 255) / 256.0;
    let b = (rgb & 255) / 256.0;
    r = Math.pow(r, brightness);
    g = Math.pow(g, brightness);
    b = Math.pow(b, brightness);
    const newR = (r * 256.0) | 0;
    const newG = (g * 256.0) | 0;
    const newB = (b * 256.0) | 0;
    return (newR << 16) | (newG << 8) | newB;
}

export function packHsl(hue: number, saturation: number, lightness: number) {
    if (lightness > 179) {
        saturation = (saturation / 2) | 0;
    }

    if (lightness > 192) {
        saturation = (saturation / 2) | 0;
    }

    if (lightness > 217) {
        saturation = (saturation / 2) | 0;
    }

    if (lightness > 243) {
        saturation = (saturation / 2) | 0;
    }

    return ((saturation / 32) << 7) + ((hue / 4) << 10) + ((lightness / 2) | 0);
}

export function rgbToHsl(rgb: number): number {
    const r = ((rgb >> 16) & 255) / 256.0;
    const g = ((rgb >> 8) & 255) / 256.0;
    const b = (rgb & 255) / 256.0;

    let minRgb = r;
    if (g < r) {
        minRgb = g;
    }
    if (b < minRgb) {
        minRgb = b;
    }

    let maxRgb = r;
    if (g > r) {
        maxRgb = g;
    }
    if (b > maxRgb) {
        maxRgb = b;
    }

    let hueTemp = 0.0;
    let sat = 0.0;
    const light = (minRgb + maxRgb) / 2.0;
    if (minRgb !== maxRgb) {
        if (light < 0.5) {
            sat = (maxRgb - minRgb) / (minRgb + maxRgb);
        }

        if (light >= 0.5) {
            sat = (maxRgb - minRgb) / (2.0 - maxRgb - minRgb);
        }

        if (maxRgb === r) {
            hueTemp = (g - b) / (maxRgb - minRgb);
        } else if (maxRgb === g) {
            hueTemp = 2.0 + (b - r) / (maxRgb - minRgb);
        } else if (maxRgb === b) {
            hueTemp = 4.0 + (r - g) / (maxRgb - minRgb);
        }
    }

    hueTemp /= 6.0;

    const hue = (hueTemp * 256.0) | 0;
    let saturation = (sat * 256.0) | 0;
    let lightness = (light * 256.0) | 0;
    if (saturation < 0) {
        saturation = 0;
    } else if (saturation > 255) {
        saturation = 255;
    }

    if (lightness < 0) {
        lightness = 0;
    } else if (lightness > 255) {
        lightness = 255;
    }

    return packHsl(hue, saturation, lightness);
}

export function adjustUnderlayLight(hsl: number, light: number) {
    if (hsl === -1) {
        return 12345678;
    } else {
        light = ((hsl & 127) * light) >> 7;
        if (light < 2) {
            light = 2;
        } else if (light > 126) {
            light = 126;
        }

        return (hsl & 0xff80) + light;
    }
}

export function adjustOverlayLight(hsl: number, light: number) {
    if (hsl === -2) {
        return 12345678;
    } else if (hsl === -1) {
        if (light < 2) {
            light = 2;
        } else if (light > 126) {
            light = 126;
        }

        return light;
    } else {
        light = ((hsl & 127) * light) >> 7;
        if (light < 2) {
            light = 2;
        } else if (light > 126) {
            light = 126;
        }

        return (hsl & 0xff80) + light;
    }
}
