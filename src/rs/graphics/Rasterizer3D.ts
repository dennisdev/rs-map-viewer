import { nextPow2 } from "../../util/MathUtil";
import { HSL_RGB_MAP } from "../util/ColorUtil";
import { Rasterizer2D } from "./Rasterizer2D";

export class Rasterizer3D {
    static lowMem = false;
    static rasterClipEnable: boolean = false;
    static rasterGouraudLowRes: boolean = true;
    static rasterAlpha: number = 0;

    static rasterClipY: Int32Array = new Int32Array(1024);

    static endX: number = 0;
    static endY: number = 0;

    static centerX: number = 0;
    static centerY: number = 0;

    static viewportLeft: number = 0;
    static viewportRight: number = 0;
    static viewportTop: number = 0;
    static viewportBottom: number = 0;

    static setClip() {
        Rasterizer3D.setRasterClip(
            Rasterizer2D.xClipStart,
            Rasterizer2D.yClipStart,
            Rasterizer2D.xClipEnd,
            Rasterizer2D.yClipEnd,
        );
    }

    static setRasterClip(
        xClipStart: number,
        yClipStart: number,
        xClipEnd: number,
        yClipEnd: number,
    ) {
        Rasterizer3D.endX = xClipEnd - xClipStart;
        Rasterizer3D.endY = yClipEnd - yClipStart;
        Rasterizer3D.calculateViewport();

        if (Rasterizer3D.endY > Rasterizer3D.rasterClipY.length) {
            Rasterizer3D.rasterClipY = new Int32Array(nextPow2(Rasterizer3D.endY));
        }

        let v = xClipStart + Rasterizer2D.width * yClipStart;
        for (let i = 0; i < Rasterizer3D.endY; i++) {
            Rasterizer3D.rasterClipY[i] = v;
            v += Rasterizer2D.width;
        }
    }

    static calculateViewport() {
        Rasterizer3D.centerX = (Rasterizer3D.endX / 2) | 0;
        Rasterizer3D.centerY = (Rasterizer3D.endY / 2) | 0;
        Rasterizer3D.viewportLeft = -Rasterizer3D.centerX;
        Rasterizer3D.viewportRight = Rasterizer3D.endX - Rasterizer3D.centerX;
        Rasterizer3D.viewportTop = -Rasterizer3D.centerY;
        Rasterizer3D.viewportBottom = Rasterizer3D.endY - Rasterizer3D.centerY;
    }

    static setViewport(x: number, y: number) {
        const offset = Rasterizer3D.rasterClipY[0];
        const i_136_ = (offset / Rasterizer2D.width) | 0;
        const i_137_ = offset - i_136_ * Rasterizer2D.width;
        Rasterizer3D.centerX = x - i_137_;
        Rasterizer3D.centerY = y - i_136_;
        Rasterizer3D.viewportLeft = -Rasterizer3D.centerX;
        Rasterizer3D.viewportRight = Rasterizer3D.endX - Rasterizer3D.centerX;
        Rasterizer3D.viewportTop = -Rasterizer3D.centerY;
        Rasterizer3D.viewportBottom = Rasterizer3D.endY - Rasterizer3D.centerY;
    }

    static rasterGouraud(
        y0: number,
        y1: number,
        y2: number,
        x0: number,
        x1: number,
        x2: number,
        hsl0: number,
        hsl1: number,
        hsl2: number,
    ) {
        let var9 = x1 - x0;
        let var10 = y1 - y0;
        let var11 = x2 - x0;
        let var12 = y2 - y0;
        let var13 = hsl1 - hsl0;
        let var14 = hsl2 - hsl0;
        let var15: number;
        if (y2 !== y1) {
            var15 = (((x2 - x1) << 14) / (y2 - y1)) | 0;
        } else {
            var15 = 0;
        }

        let var16: number;
        if (y0 !== y1) {
            var16 = ((var9 << 14) / var10) | 0;
        } else {
            var16 = 0;
        }

        let var17: number;
        if (y0 !== y2) {
            var17 = ((var11 << 14) / var12) | 0;
        } else {
            var17 = 0;
        }

        const var18 = var9 * var12 - var11 * var10;
        if (var18 !== 0) {
            const var19 = (((var13 * var12 - var14 * var10) << 8) / var18) | 0;
            const var20 = (((var14 * var9 - var13 * var11) << 8) / var18) | 0;
            if (y0 <= y1 && y0 <= y2) {
                if (y0 < Rasterizer3D.endY) {
                    if (y1 > Rasterizer3D.endY) {
                        y1 = Rasterizer3D.endY;
                    }

                    if (y2 > Rasterizer3D.endY) {
                        y2 = Rasterizer3D.endY;
                    }

                    hsl0 = var19 + ((hsl0 << 8) - x0 * var19);
                    if (y1 < y2) {
                        x2 = x0 <<= 14;
                        if (y0 < 0) {
                            x2 -= y0 * var17;
                            x0 -= y0 * var16;
                            hsl0 -= y0 * var20;
                            y0 = 0;
                        }

                        x1 <<= 14;
                        if (y1 < 0) {
                            x1 -= var15 * y1;
                            y1 = 0;
                        }

                        if ((y0 !== y1 && var17 < var16) || (y0 === y1 && var17 > var15)) {
                            y2 -= y1;
                            y1 -= y0;
                            y0 = Rasterizer3D.rasterClipY[y0];

                            while (true) {
                                --y1;
                                if (y1 < 0) {
                                    while (true) {
                                        --y2;
                                        if (y2 < 0) {
                                            return;
                                        }

                                        Rasterizer3D.rasterGouraudLine(
                                            Rasterizer2D.pixels,
                                            y0,
                                            x2 >> 14,
                                            x1 >> 14,
                                            hsl0,
                                            var19,
                                        );
                                        x2 += var17;
                                        x1 += var15;
                                        hsl0 += var20;
                                        y0 += Rasterizer2D.width;
                                    }
                                }

                                Rasterizer3D.rasterGouraudLine(
                                    Rasterizer2D.pixels,
                                    y0,
                                    x2 >> 14,
                                    x0 >> 14,
                                    hsl0,
                                    var19,
                                );
                                x2 += var17;
                                x0 += var16;
                                hsl0 += var20;
                                y0 += Rasterizer2D.width;
                            }
                        } else {
                            y2 -= y1;
                            y1 -= y0;
                            y0 = Rasterizer3D.rasterClipY[y0];

                            while (true) {
                                --y1;
                                if (y1 < 0) {
                                    while (true) {
                                        --y2;
                                        if (y2 < 0) {
                                            return;
                                        }

                                        Rasterizer3D.rasterGouraudLine(
                                            Rasterizer2D.pixels,
                                            y0,
                                            x1 >> 14,
                                            x2 >> 14,
                                            hsl0,
                                            var19,
                                        );
                                        x2 += var17;
                                        x1 += var15;
                                        hsl0 += var20;
                                        y0 += Rasterizer2D.width;
                                    }
                                }

                                Rasterizer3D.rasterGouraudLine(
                                    Rasterizer2D.pixels,
                                    y0,
                                    x0 >> 14,
                                    x2 >> 14,
                                    hsl0,
                                    var19,
                                );
                                x2 += var17;
                                x0 += var16;
                                hsl0 += var20;
                                y0 += Rasterizer2D.width;
                            }
                        }
                    } else {
                        x1 = x0 <<= 14;
                        if (y0 < 0) {
                            x1 -= y0 * var17;
                            x0 -= y0 * var16;
                            hsl0 -= y0 * var20;
                            y0 = 0;
                        }

                        x2 <<= 14;
                        if (y2 < 0) {
                            x2 -= var15 * y2;
                            y2 = 0;
                        }

                        if ((y0 !== y2 && var17 < var16) || (y0 === y2 && var15 > var16)) {
                            y1 -= y2;
                            y2 -= y0;
                            y0 = Rasterizer3D.rasterClipY[y0];

                            while (true) {
                                --y2;
                                if (y2 < 0) {
                                    while (true) {
                                        --y1;
                                        if (y1 < 0) {
                                            return;
                                        }

                                        Rasterizer3D.rasterGouraudLine(
                                            Rasterizer2D.pixels,
                                            y0,
                                            x2 >> 14,
                                            x0 >> 14,
                                            hsl0,
                                            var19,
                                        );
                                        x2 += var15;
                                        x0 += var16;
                                        hsl0 += var20;
                                        y0 += Rasterizer2D.width;
                                    }
                                }

                                Rasterizer3D.rasterGouraudLine(
                                    Rasterizer2D.pixels,
                                    y0,
                                    x1 >> 14,
                                    x0 >> 14,
                                    hsl0,
                                    var19,
                                );
                                x1 += var17;
                                x0 += var16;
                                hsl0 += var20;
                                y0 += Rasterizer2D.width;
                            }
                        } else {
                            y1 -= y2;
                            y2 -= y0;
                            y0 = Rasterizer3D.rasterClipY[y0];

                            while (true) {
                                --y2;
                                if (y2 < 0) {
                                    while (true) {
                                        --y1;
                                        if (y1 < 0) {
                                            return;
                                        }

                                        Rasterizer3D.rasterGouraudLine(
                                            Rasterizer2D.pixels,
                                            y0,
                                            x0 >> 14,
                                            x2 >> 14,
                                            hsl0,
                                            var19,
                                        );
                                        x2 += var15;
                                        x0 += var16;
                                        hsl0 += var20;
                                        y0 += Rasterizer2D.width;
                                    }
                                }

                                Rasterizer3D.rasterGouraudLine(
                                    Rasterizer2D.pixels,
                                    y0,
                                    x0 >> 14,
                                    x1 >> 14,
                                    hsl0,
                                    var19,
                                );
                                x1 += var17;
                                x0 += var16;
                                hsl0 += var20;
                                y0 += Rasterizer2D.width;
                            }
                        }
                    }
                }
            } else if (y1 <= y2) {
                if (y1 < Rasterizer3D.endY) {
                    if (y2 > Rasterizer3D.endY) {
                        y2 = Rasterizer3D.endY;
                    }

                    if (y0 > Rasterizer3D.endY) {
                        y0 = Rasterizer3D.endY;
                    }

                    hsl1 = var19 + ((hsl1 << 8) - var19 * x1);
                    if (y2 < y0) {
                        x0 = x1 <<= 14;
                        if (y1 < 0) {
                            x0 -= var16 * y1;
                            x1 -= var15 * y1;
                            hsl1 -= var20 * y1;
                            y1 = 0;
                        }

                        x2 <<= 14;
                        if (y2 < 0) {
                            x2 -= var17 * y2;
                            y2 = 0;
                        }

                        if ((y2 !== y1 && var16 < var15) || (y2 === y1 && var16 > var17)) {
                            y0 -= y2;
                            y2 -= y1;
                            y1 = Rasterizer3D.rasterClipY[y1];

                            while (true) {
                                --y2;
                                if (y2 < 0) {
                                    while (true) {
                                        --y0;
                                        if (y0 < 0) {
                                            return;
                                        }

                                        Rasterizer3D.rasterGouraudLine(
                                            Rasterizer2D.pixels,
                                            y1,
                                            x0 >> 14,
                                            x2 >> 14,
                                            hsl1,
                                            var19,
                                        );
                                        x0 += var16;
                                        x2 += var17;
                                        hsl1 += var20;
                                        y1 += Rasterizer2D.width;
                                    }
                                }

                                Rasterizer3D.rasterGouraudLine(
                                    Rasterizer2D.pixels,
                                    y1,
                                    x0 >> 14,
                                    x1 >> 14,
                                    hsl1,
                                    var19,
                                );
                                x0 += var16;
                                x1 += var15;
                                hsl1 += var20;
                                y1 += Rasterizer2D.width;
                            }
                        } else {
                            y0 -= y2;
                            y2 -= y1;
                            y1 = Rasterizer3D.rasterClipY[y1];

                            while (true) {
                                --y2;
                                if (y2 < 0) {
                                    while (true) {
                                        --y0;
                                        if (y0 < 0) {
                                            return;
                                        }

                                        Rasterizer3D.rasterGouraudLine(
                                            Rasterizer2D.pixels,
                                            y1,
                                            x2 >> 14,
                                            x0 >> 14,
                                            hsl1,
                                            var19,
                                        );
                                        x0 += var16;
                                        x2 += var17;
                                        hsl1 += var20;
                                        y1 += Rasterizer2D.width;
                                    }
                                }

                                Rasterizer3D.rasterGouraudLine(
                                    Rasterizer2D.pixels,
                                    y1,
                                    x1 >> 14,
                                    x0 >> 14,
                                    hsl1,
                                    var19,
                                );
                                x0 += var16;
                                x1 += var15;
                                hsl1 += var20;
                                y1 += Rasterizer2D.width;
                            }
                        }
                    } else {
                        x2 = x1 <<= 14;
                        if (y1 < 0) {
                            x2 -= var16 * y1;
                            x1 -= var15 * y1;
                            hsl1 -= var20 * y1;
                            y1 = 0;
                        }

                        x0 <<= 14;
                        if (y0 < 0) {
                            x0 -= y0 * var17;
                            y0 = 0;
                        }

                        if (var16 < var15) {
                            y2 -= y0;
                            y0 -= y1;
                            y1 = Rasterizer3D.rasterClipY[y1];

                            while (true) {
                                --y0;
                                if (y0 < 0) {
                                    while (true) {
                                        --y2;
                                        if (y2 < 0) {
                                            return;
                                        }

                                        Rasterizer3D.rasterGouraudLine(
                                            Rasterizer2D.pixels,
                                            y1,
                                            x0 >> 14,
                                            x1 >> 14,
                                            hsl1,
                                            var19,
                                        );
                                        x0 += var17;
                                        x1 += var15;
                                        hsl1 += var20;
                                        y1 += Rasterizer2D.width;
                                    }
                                }

                                Rasterizer3D.rasterGouraudLine(
                                    Rasterizer2D.pixels,
                                    y1,
                                    x2 >> 14,
                                    x1 >> 14,
                                    hsl1,
                                    var19,
                                );
                                x2 += var16;
                                x1 += var15;
                                hsl1 += var20;
                                y1 += Rasterizer2D.width;
                            }
                        } else {
                            y2 -= y0;
                            y0 -= y1;
                            y1 = Rasterizer3D.rasterClipY[y1];

                            while (true) {
                                --y0;
                                if (y0 < 0) {
                                    while (true) {
                                        --y2;
                                        if (y2 < 0) {
                                            return;
                                        }

                                        Rasterizer3D.rasterGouraudLine(
                                            Rasterizer2D.pixels,
                                            y1,
                                            x1 >> 14,
                                            x0 >> 14,
                                            hsl1,
                                            var19,
                                        );
                                        x0 += var17;
                                        x1 += var15;
                                        hsl1 += var20;
                                        y1 += Rasterizer2D.width;
                                    }
                                }

                                Rasterizer3D.rasterGouraudLine(
                                    Rasterizer2D.pixels,
                                    y1,
                                    x1 >> 14,
                                    x2 >> 14,
                                    hsl1,
                                    var19,
                                );
                                x2 += var16;
                                x1 += var15;
                                hsl1 += var20;
                                y1 += Rasterizer2D.width;
                            }
                        }
                    }
                }
            } else if (y2 < Rasterizer3D.endY) {
                if (y0 > Rasterizer3D.endY) {
                    y0 = Rasterizer3D.endY;
                }

                if (y1 > Rasterizer3D.endY) {
                    y1 = Rasterizer3D.endY;
                }

                hsl2 = var19 + ((hsl2 << 8) - x2 * var19);
                if (y0 < y1) {
                    x1 = x2 <<= 14;
                    if (y2 < 0) {
                        x1 -= var15 * y2;
                        x2 -= var17 * y2;
                        hsl2 -= var20 * y2;
                        y2 = 0;
                    }

                    x0 <<= 14;
                    if (y0 < 0) {
                        x0 -= y0 * var16;
                        y0 = 0;
                    }

                    if (var15 < var17) {
                        y1 -= y0;
                        y0 -= y2;
                        y2 = Rasterizer3D.rasterClipY[y2];

                        while (true) {
                            --y0;
                            if (y0 < 0) {
                                while (true) {
                                    --y1;
                                    if (y1 < 0) {
                                        return;
                                    }

                                    Rasterizer3D.rasterGouraudLine(
                                        Rasterizer2D.pixels,
                                        y2,
                                        x1 >> 14,
                                        x0 >> 14,
                                        hsl2,
                                        var19,
                                    );
                                    x1 += var15;
                                    x0 += var16;
                                    hsl2 += var20;
                                    y2 += Rasterizer2D.width;
                                }
                            }

                            Rasterizer3D.rasterGouraudLine(
                                Rasterizer2D.pixels,
                                y2,
                                x1 >> 14,
                                x2 >> 14,
                                hsl2,
                                var19,
                            );
                            x1 += var15;
                            x2 += var17;
                            hsl2 += var20;
                            y2 += Rasterizer2D.width;
                        }
                    } else {
                        y1 -= y0;
                        y0 -= y2;
                        y2 = Rasterizer3D.rasterClipY[y2];

                        while (true) {
                            --y0;
                            if (y0 < 0) {
                                while (true) {
                                    --y1;
                                    if (y1 < 0) {
                                        return;
                                    }

                                    Rasterizer3D.rasterGouraudLine(
                                        Rasterizer2D.pixels,
                                        y2,
                                        x0 >> 14,
                                        x1 >> 14,
                                        hsl2,
                                        var19,
                                    );
                                    x1 += var15;
                                    x0 += var16;
                                    hsl2 += var20;
                                    y2 += Rasterizer2D.width;
                                }
                            }

                            Rasterizer3D.rasterGouraudLine(
                                Rasterizer2D.pixels,
                                y2,
                                x2 >> 14,
                                x1 >> 14,
                                hsl2,
                                var19,
                            );
                            x1 += var15;
                            x2 += var17;
                            hsl2 += var20;
                            y2 += Rasterizer2D.width;
                        }
                    }
                } else {
                    x0 = x2 <<= 14;
                    if (y2 < 0) {
                        x0 -= var15 * y2;
                        x2 -= var17 * y2;
                        hsl2 -= var20 * y2;
                        y2 = 0;
                    }

                    x1 <<= 14;
                    if (y1 < 0) {
                        x1 -= var16 * y1;
                        y1 = 0;
                    }

                    if (var15 < var17) {
                        y0 -= y1;
                        y1 -= y2;
                        y2 = Rasterizer3D.rasterClipY[y2];

                        while (true) {
                            --y1;
                            if (y1 < 0) {
                                while (true) {
                                    --y0;
                                    if (y0 < 0) {
                                        return;
                                    }

                                    Rasterizer3D.rasterGouraudLine(
                                        Rasterizer2D.pixels,
                                        y2,
                                        x1 >> 14,
                                        x2 >> 14,
                                        hsl2,
                                        var19,
                                    );
                                    x1 += var16;
                                    x2 += var17;
                                    hsl2 += var20;
                                    y2 += Rasterizer2D.width;
                                }
                            }

                            Rasterizer3D.rasterGouraudLine(
                                Rasterizer2D.pixels,
                                y2,
                                x0 >> 14,
                                x2 >> 14,
                                hsl2,
                                var19,
                            );
                            x0 += var15;
                            x2 += var17;
                            hsl2 += var20;
                            y2 += Rasterizer2D.width;
                        }
                    } else {
                        y0 -= y1;
                        y1 -= y2;
                        y2 = Rasterizer3D.rasterClipY[y2];

                        while (true) {
                            --y1;
                            if (y1 < 0) {
                                while (true) {
                                    --y0;
                                    if (y0 < 0) {
                                        return;
                                    }

                                    Rasterizer3D.rasterGouraudLine(
                                        Rasterizer2D.pixels,
                                        y2,
                                        x2 >> 14,
                                        x1 >> 14,
                                        hsl2,
                                        var19,
                                    );
                                    x1 += var16;
                                    x2 += var17;
                                    hsl2 += var20;
                                    y2 += Rasterizer2D.width;
                                }
                            }

                            Rasterizer3D.rasterGouraudLine(
                                Rasterizer2D.pixels,
                                y2,
                                x2 >> 14,
                                x0 >> 14,
                                hsl2,
                                var19,
                            );
                            x0 += var15;
                            x2 += var17;
                            hsl2 += var20;
                            y2 += Rasterizer2D.width;
                        }
                    }
                }
            }
        }
    }

    static rasterGouraudLine(
        pixels: Int32Array,
        offset: number,
        startX: number,
        endX: number,
        hslIndex: number,
        grad: number,
    ) {
        if (Rasterizer3D.rasterClipEnable) {
            if (endX > this.endX) {
                endX = this.endX;
            }

            if (startX < 0) {
                startX = 0;
            }
        }

        if (startX >= endX) {
            return;
        }

        offset += startX;
        hslIndex += startX * grad;

        if (Rasterizer3D.rasterGouraudLowRes) {
            throw new Error("Not implemented");
        } else {
            let loops = endX - startX;
            if (Rasterizer3D.rasterAlpha === 0) {
                do {
                    pixels[offset++] = HSL_RGB_MAP[hslIndex >> 8];
                    hslIndex += grad;
                    --loops;
                } while (loops > 0);
            } else {
                const srcAlpha = Rasterizer3D.rasterAlpha;
                const dstAlpha = 256 - Rasterizer3D.rasterAlpha;

                do {
                    let color = HSL_RGB_MAP[hslIndex >> 8];
                    hslIndex += grad;
                    color =
                        (((dstAlpha * (color & 0xff00)) >> 8) & 0xff00) +
                        (((dstAlpha * (color & 0xff00ff)) >> 8) & 0xff00ff);
                    const src = pixels[offset];
                    pixels[offset++] =
                        ((((src & 0xff00ff) * srcAlpha) >> 8) & 0xff00ff) +
                        (((srcAlpha * (src & 0xff00)) >> 8) & 0xff00) +
                        color;
                    --loops;
                } while (loops > 0);
            }
        }
    }
}
