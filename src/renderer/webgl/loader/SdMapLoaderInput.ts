export type SdMapLoaderInput = {
    mapX: number;
    mapY: number;

    maxLevel: number;
    loadObjs: boolean;
    loadNpcs: boolean;

    smoothTerrain: boolean;

    minimizeDrawCalls: boolean;

    loadedTextureIds: Set<number>;
};
