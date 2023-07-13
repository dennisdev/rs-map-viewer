import { CacheInfo } from "../../client/fs/Types";

export type MinimapData = {
    regionX: number;
    regionY: number;
    plane: number;
    cacheInfo: CacheInfo;

    minimapBlob: Blob;
};
