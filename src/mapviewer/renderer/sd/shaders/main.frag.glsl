#version 300 es

precision highp float;

layout(std140, column_major) uniform;

// Per frame
uniform SceneUniforms {
    mat4 u_viewProjMatrix;
    mat4 u_viewMatrix;
    mat4 u_projectionMatrix;
    vec4 u_skyColor;
    vec2 u_cameraPos;
    float u_renderDistance;
    float u_fogDepth;
    float u_currentTime;
    float u_brightness;
    float u_colorBanding;
};

uniform highp sampler2DArray u_textures;

in vec4 v_color;
in vec2 v_texCoord;
flat in uint v_texId;
flat in float v_texAnimated;
in float v_fogAmount;
flat in vec4 v_interactId;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec4 interactId;

void main() {
    vec4 textureColor = texture(u_textures, vec3(v_texCoord, v_texId)).bgra;
    fragColor = pow(textureColor, vec4(vec3(u_brightness), 1.0)) * 
        vec4(round(v_color.rgb * u_colorBanding) / u_colorBanding, v_color.a);
#ifdef DISCARD_ALPHA
    if ((v_texId == 0u && fragColor.a < 0.01) || (v_texAnimated < 0.5 && textureColor.a < 0.5) || (v_texAnimated > 0.5 && textureColor.a < 0.1)) {
        discard;
    }
#endif
    fragColor = mix(fragColor, u_skyColor, v_fogAmount);
    interactId = v_interactId;
}
