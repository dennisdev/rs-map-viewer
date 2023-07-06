import { CacheInfo } from "../../client/fs/CacheInfo";

export type MinimapData = {
    regionX: number;
    regionY: number;
    plane: number;
    cacheInfo: CacheInfo;

    minimapBlob: Blob;
};
