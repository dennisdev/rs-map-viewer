import {getMapCoordinates, getMapSquareId} from "../rs/map/MapFileIndex";

const borderSize = 6;

export const getMapAndTile = (mapId: number, tileId: number): number => {
    const mapCoordinates = getMapCoordinates(mapId);

    const mapX = mapCoordinates.mapX & 0xFFFF;
    const mapY = mapCoordinates.mapY & 0xFFFF;

    const packedTileId =
        (BigInt(mapX) << 48n) | (BigInt(mapY) << 32n) | (BigInt(tileId >> 8) << 16n) | BigInt(tileId & 0xFF);

    return Number(packedTileId);
};



export const getWorldTileId = (worldX: number, worldY: number): number => {
    const mapX = Math.floor(worldX / 64);
    const mapY = Math.floor(worldY / 64);
    const tileX = (worldX % 64) + borderSize;
    const tileY = (worldY % 64) + borderSize;

    const packedTileId =
        (BigInt(mapX & 0xFFFF) << 48n) | (BigInt(mapY & 0xFFFF) << 32n) | (BigInt(tileX & 0xFFFF) << 16n) | BigInt(tileY & 0xFFFF);

    return Number(packedTileId);
};

export const getWorldTileIdFromLocal = (mapId: number, tileX: number, tileY: number): bigint => {
    const mapCoordinates = getMapCoordinates(mapId);

    const mapX = BigInt(mapCoordinates.mapX) & 0xFFFFn;
    const mapY = BigInt(mapCoordinates.mapY) & 0xFFFFn;
    const shiftedMapX = mapX << 32n;
    const shiftedMapY = mapY << 16n;

    return shiftedMapX | shiftedMapY | BigInt(tileX & 0xFFFF) << 16n | BigInt(tileY & 0xFFFF);
};

