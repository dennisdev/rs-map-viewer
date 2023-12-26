struct Vertex {
    vec3 pos;
    vec4 color;
    vec2 texCoord;
    uint textureId;
    uint priority;
};

Vertex decodeVertex(uint v0, uint v1, uint v2, float brightness) {
    float x = float(int((v0 >> 17u) & 0x7FFFu) - 0x4000);
    float u = unpackFloat11(((v0 >> 11u) & 0x3Fu) | ((v2 & 0x1Fu) << 6u));
    float v = unpackFloat11(v0 & 0x7FFu);

    float y = -float(int((v1) & 0x7FFFu) - 0x4000);
    int hsl = int((v1 >> 15u) & 0xFFFFu);
    float isTextured = float((v1 >> 31) & 0x1u);
    float textureId = float(((hsl >> 7) | int(((v2 >> 5u) & 0x1u) << 9u)) + 1) * isTextured;

    float z = float(int((v2 >> 17u) & 0x7FFFu) - 0x4000);
    float alpha = float((v2 >> 9u) & 0xFFu) / 255.0;
    uint priority = ((v2 >> 6u) & 0x7u);

    vec4 color = when_eq(textureId, 0.0) * vec4(hslToRgb(hsl, brightness), alpha)
        + when_neq(textureId, 0.0) * vec4(vec3(float(hsl & 0x7F) / 127.0), alpha);

    return Vertex(vec3(x, y, z), color, vec2(u, v), uint(textureId), priority);
}
