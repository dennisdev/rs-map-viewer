import { FloorTypeLoader, OverlayFloorTypeLoader } from "../../config/floortype/FloorTypeLoader";
import { LocTypeLoader } from "../../config/loctype/LocTypeLoader";
import { NpcTypeLoader } from "../../config/npctype/NpcTypeLoader";
import { ObjTypeLoader } from "../../config/objtype/ObjTypeLoader";
import { SeqTypeLoader } from "../../config/seqtype/SeqTypeLoader";
import { VarBitTypeLoader } from "../../config/vartype/bit/VarBitTypeLoader";
import { MapFileIndex } from "../../map/MapFileIndex";
import { TextureLoader } from "../../texture/TextureLoader";
import { ModelLoader } from "../../model/ModelLoader";
import { SeqFrameLoader } from "../../model/seq/SeqFrameLoader";
import { CacheIndex } from "../CacheIndex";
import { CacheInfo } from "../CacheInfo";
import { CacheSystem } from "../CacheSystem";
import { detectCacheType } from "../CacheType";
import { Dat2CacheLoaderFactory } from "./Dat2CacheLoaderFactory";
import { DatCacheLoaderFactory } from "./DatCacheLoaderFactory";
import { IndexedSprite } from "../../sprite/IndexedSprite";
import { LegacyCacheLoaderFactory } from "./LegacyCacheLoaderFactory";
import { BasTypeLoader } from "../../config/bastype/BasTypeLoader";

export interface CacheLoaderFactory {
    getUnderlayTypeLoader(): FloorTypeLoader;
    getOverlayTypeLoader(): OverlayFloorTypeLoader;

    getVarBitTypeLoader(): VarBitTypeLoader;

    getLocTypeLoader(): LocTypeLoader;
    getNpcTypeLoader(): NpcTypeLoader;
    getObjTypeLoader(): ObjTypeLoader;

    getSeqTypeLoader(): SeqTypeLoader;

    getBasTypeLoader(): BasTypeLoader;

    getTextureLoader(): TextureLoader;

    getModelLoader(): ModelLoader;
    getSeqFrameLoader(): SeqFrameLoader;

    getMapFileIndex(): MapFileIndex;
    getMapIndex(): CacheIndex;

    getMapScenes(): IndexedSprite[];
}

export function getCacheLoaderFactory(
    cacheInfo: CacheInfo,
    cacheSystem: CacheSystem,
): CacheLoaderFactory {
    const cacheType = detectCacheType(cacheInfo);
    switch (cacheType) {
        case "legacy":
            return new LegacyCacheLoaderFactory(cacheInfo, cacheSystem);
        case "dat":
            return new DatCacheLoaderFactory(cacheInfo, cacheType, cacheSystem);
        case "dat2":
            return new Dat2CacheLoaderFactory(cacheInfo, cacheType, cacheSystem);
    }
    throw new Error("Not implemented");
}
