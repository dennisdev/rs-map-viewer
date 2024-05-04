#version 300 es

precision highp float;

uniform highp sampler2DArray u_textures;

in vec4 v_color;
in vec2 v_texCoord;
flat in uint v_texId;

out vec4 fragColor;

void main() {
    vec4 textureColor = texture(u_textures, vec3(v_texCoord, v_texId)).bgra;
    fragColor = v_color * textureColor;
}
