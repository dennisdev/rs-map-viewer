precision highp float;

layout(std140, column_major) uniform;

in vec4 v_color;
in vec2 v_texCoord;
flat in uint v_texId;
flat in float v_texAnimated;
flat in vec4 v_interactId;
flat in vec4 v_interactRegionId;
in float v_fogAmount;

uniform SceneUniforms {
    mat4 u_viewProjMatrix;
    mat4 u_viewMatrix;
    mat4 u_projectionMatrix;
    vec4 u_skyColor;
    vec2 u_cameraPos;
    float u_renderDistance;
    float u_fogDepth;
};

uniform highp vec2 u_regionPos;
uniform highp float u_brightness;
uniform highp float u_colorBanding;

uniform highp sampler2DArray u_textures;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec4 interactId;
layout(location = 2) out vec4 interactRegionId;

void main() {
    vec4 textureColor = texture(u_textures, vec3(v_texCoord, v_texId)).bgra;
    fragColor = pow(textureColor, vec4(vec3(u_brightness), 1.0)) * 
        vec4(round(v_color.rgb * u_colorBanding) / u_colorBanding, v_color.a);
    if ((v_texId == 0u && fragColor.a < 0.01) || (v_texAnimated < 0.5 && textureColor.a < 0.5) || (v_texAnimated > 0.5 && textureColor.a < 0.1)) {
        discard;
    }
    fragColor = mix(fragColor, u_skyColor, v_fogAmount);
    interactId = v_interactId;
    interactRegionId = v_interactRegionId;
}
