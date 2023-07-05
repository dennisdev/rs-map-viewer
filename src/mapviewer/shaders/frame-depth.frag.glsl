precision highp float;

uniform highp sampler2D u_depth;

uniform float u_far;

out vec4 fragColor;

void main() {
    ivec2 fragCoord = ivec2(gl_FragCoord.xy);
    float depth = texelFetch(u_depth, fragCoord, 0).x;

    float n = 0.1; //near plane
    float f = u_far; //far plane
    float z = (2.0 * n) / (f + n - depth * (f - n));

    fragColor = vec4(z, z, z, 1.0);
}
