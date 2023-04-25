precision mediump float;

layout(std140, column_major) uniform;

in vec4 v_color;
in vec2 v_texCoord;
flat in uint v_texId;
flat in float v_texAnimated;
flat in float v_loadAlpha;
flat in vec4 v_interactId;

uniform highp float u_brightness;
uniform highp float u_colorBanding;

uniform highp sampler2DArray u_textures;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec4 interactId;

void main() {
    vec4 textureColor = texture(u_textures, vec3(v_texCoord, v_texId)).bgra;
    fragColor = pow(textureColor, vec4(vec3(u_brightness), 1.0)) * 
        vec4(round(v_color.rgb * u_colorBanding) / u_colorBanding, v_color.a) * v_loadAlpha;
    interactId = v_interactId;
    if ((v_texId == uint(0) && fragColor.a < 0.01) || (v_texAnimated < 0.5 && textureColor.a < 0.5)) {
        discard;
    }
}
