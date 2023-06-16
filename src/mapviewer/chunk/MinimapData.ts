import { CacheInfo } from "../CacheInfo";

export type MinimapData = {
    regionX: number;
    regionY: number;
    plane: number;
    cacheInfo: CacheInfo;

    minimapBlob: Blob;
};
