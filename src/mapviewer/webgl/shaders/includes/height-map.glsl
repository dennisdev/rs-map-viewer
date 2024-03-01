const int sceneBorderSize = 6;
const int tileSize = 128;
const int tileSizeShift = 7;

int getTileHeight(int x, int z, uint plane) {
    return texelFetch(u_heightMap, ivec3(sceneBorderSize + x, sceneBorderSize + z, plane), 0).r * 8;
}

float getHeightInterp(vec2 pos, uint plane) {
    ivec2 ipos = ivec2(pos);
    int tileX = ipos.x >> tileSizeShift;
    int tileZ = ipos.y >> tileSizeShift;
    int offsetX = ipos.x & (tileSize - 1);
    int offsetZ = ipos.y & (tileSize - 1);
    int h00 = getTileHeight(tileX, tileZ, plane);
    int h10 = getTileHeight(tileX + 1, tileZ, plane);
    int h01 = getTileHeight(tileX, tileZ + 1, plane);
    int h11 = getTileHeight(tileX + 1, tileZ + 1, plane);
    int delta0 = (h00 * (tileSize - offsetX) + h10 * offsetX) >> tileSizeShift;
    int delta1 = (h01 * (tileSize - offsetX) + h11 * offsetX) >> tileSizeShift;
    return float((delta0 * (tileSize - offsetZ) + delta1 * offsetZ) >> tileSizeShift);
}
