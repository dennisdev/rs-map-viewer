// https://stackoverflow.com/a/17309861
vec3 hslToRgb(int hsl, float brightness) {
    const float onethird = 1.0 / 3.0;
    const float twothird = 2.0 / 3.0;
    const float rcpsixth = 6.0;

    float hue = float(hsl >> 10) / 64.0 + 0.0078125;
    float sat = float((hsl >> 7) & 0x7) / 8.0 + 0.0625;
    float lum = float(hsl & 0x7f) / 128.0;

    vec3 xt = vec3(
        rcpsixth * (hue - twothird),
        0.0,
        rcpsixth * (1.0 - hue)
    );

    xt = mix(xt, vec3(
        0.0,
        rcpsixth * (twothird - hue),
        rcpsixth * (hue - onethird)
    ), when_lt(hue, twothird));

    xt = mix(xt, vec3(
        rcpsixth * (onethird - hue),
        rcpsixth * hue,
        0.0
    ), when_lt(hue, onethird));

    // if (hue < twothird) {
    //     xt.r = 0.0;
    //     xt.g = rcpsixth * (twothird - hue);
    //     xt.b = rcpsixth * (hue      - onethird);
    // }

    // if (hue < onethird) {
    //     xt.r = rcpsixth * (onethird - hue);
    //     xt.g = rcpsixth * hue;
    //     xt.b = 0.0;
    // }

    xt = min( xt, 1.0 );

    float sat2   =  2.0 * sat;
    float satinv =  1.0 - sat;
    float luminv =  1.0 - lum;
    float lum2m1 = (2.0 * lum) - 1.0;
    vec3  ct     = (sat2 * xt) + satinv;

    // vec3 rgb;
    // if (lum >= 0.5)
    //      rgb = (luminv * ct) + lum2m1;
    // else rgb =  lum    * ct;

    vec3 rgb = mix((luminv * ct) + lum2m1, lum * ct, when_lt(lum, 0.5));

    return pow(rgb, vec3(brightness));
}
