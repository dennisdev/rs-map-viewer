precision mediump float;

layout(std140, column_major) uniform;

in vec4 v_color;
in vec2 v_texCoord;
flat in uint v_texId;
flat in float v_loadAlpha;

uniform highp float u_brightness;
uniform highp float u_colorBanding;

uniform highp sampler2DArray u_textures;

out vec4 fragColor;

void main() {
    fragColor = pow(texture(u_textures, vec3(v_texCoord, v_texId)).bgra, vec4(vec3(u_brightness), 1.0)) * 
        vec4(round(v_color.rgb * u_colorBanding) / u_colorBanding, v_color.a) * v_loadAlpha;
    if (fragColor.a < 0.01) {
        discard;
    }
}
