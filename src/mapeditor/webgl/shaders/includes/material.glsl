struct Material {
    int animU;
    int animV;
    float alphaCutOff;
};

Material getMaterial(uint textureId) {
    ivec4 data = texelFetch(u_materials, ivec2(textureId, 0), 0);

    Material material;
    material.animU = data.r;
    material.animV = data.g;
    material.alphaCutOff = float(data.b & 0xFF) / 255.0;

    return material;
}
