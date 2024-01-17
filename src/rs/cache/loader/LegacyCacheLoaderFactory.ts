import { BasTypeLoader, DummyBasTypeLoader } from "../../config/bastype/BasTypeLoader";
import {
    DatFloorTypeLoader,
    FloorTypeLoader,
    OverlayFloorTypeLoader,
} from "../../config/floortype/FloorTypeLoader";
import { DatLocTypeLoader, LocTypeLoader } from "../../config/loctype/LocTypeLoader";
import { DatNpcTypeLoader, NpcTypeLoader } from "../../config/npctype/NpcTypeLoader";
import { DatObjTypeLoader, ObjTypeLoader } from "../../config/objtype/ObjTypeLoader";
import { QuestTypeLoader } from "../../config/questtype/QuestTypeLoader";
import { DatSeqTypeLoader, SeqTypeLoader } from "../../config/seqtype/SeqTypeLoader";
import { DummyVarBitTypeLoader, VarBitTypeLoader } from "../../config/vartype/bit/VarBitTypeLoader";
import { Dat2MapIndex } from "../../map/MapFileIndex";
import { LegacyMapFileLoader, MapFileLoader } from "../../map/MapFileLoader";
import { LegacyModelLoader } from "../../model/ModelLoader";
import { LegacySeqFrameLoader, SeqFrameLoader } from "../../model/seq/SeqFrameLoader";
import { SkeletalSeqLoader } from "../../model/skeletal/SkeletalSeqLoader";
import { IndexedSprite } from "../../sprite/IndexedSprite";
import { DatTextureLoader } from "../../texture/DatTextureLoader";
import { TextureLoader } from "../../texture/TextureLoader";
import { Archive } from "../Archive";
import { CacheIndex } from "../CacheIndex";
import { CacheInfo } from "../CacheInfo";
import { CacheSystem } from "../CacheSystem";
import { IndexType } from "../IndexType";
import { CacheLoaderFactory } from "./CacheLoaderFactory";
import { loadMapFunctions, loadMapScenes } from "./DatCacheLoaderFactory";

export class LegacyCacheLoaderFactory implements CacheLoaderFactory {
    configIndex: CacheIndex;
    configArchive: Archive;

    mediaIndex: CacheIndex;
    mediaArchive: Archive;

    textureIndex: CacheIndex;
    textureArchive: Archive;

    modelIndex: CacheIndex;
    modelArchive: Archive;

    mapIndex: CacheIndex;

    floTypeLoader?: OverlayFloorTypeLoader;

    constructor(
        readonly cacheInfo: CacheInfo,
        readonly cacheSystem: CacheSystem,
    ) {
        this.configIndex = cacheSystem.getIndex(IndexType.LEGACY.configs);
        this.configArchive = this.configIndex.getArchive(0);

        this.mediaIndex = cacheSystem.getIndex(IndexType.LEGACY.media);
        this.mediaArchive = this.mediaIndex.getArchive(0);

        this.textureIndex = cacheSystem.getIndex(IndexType.LEGACY.textures);
        this.textureArchive = this.textureIndex.getArchive(0);

        this.modelIndex = cacheSystem.getIndex(IndexType.LEGACY.models);
        this.modelArchive = this.modelIndex.getArchive(0);

        this.mapIndex = cacheSystem.getIndex(IndexType.LEGACY.maps);
    }

    getFloTypeLoader(): OverlayFloorTypeLoader {
        if (!this.floTypeLoader) {
            this.floTypeLoader = DatFloorTypeLoader.load(this.cacheInfo, this.configArchive);
        }
        return this.floTypeLoader;
    }

    getUnderlayTypeLoader(): FloorTypeLoader {
        return this.getFloTypeLoader();
    }

    getOverlayTypeLoader(): OverlayFloorTypeLoader {
        return this.getFloTypeLoader();
    }

    getVarBitTypeLoader(): VarBitTypeLoader {
        return new DummyVarBitTypeLoader(this.cacheInfo);
    }

    getLocTypeLoader(): LocTypeLoader {
        return DatLocTypeLoader.load(this.cacheInfo, this.configArchive);
    }

    getNpcTypeLoader(): NpcTypeLoader {
        return DatNpcTypeLoader.load(this.cacheInfo, this.configArchive);
    }

    getObjTypeLoader(): ObjTypeLoader {
        return DatObjTypeLoader.load(this.cacheInfo, this.configArchive);
    }

    getSeqTypeLoader(): SeqTypeLoader {
        return DatSeqTypeLoader.load(this.cacheInfo, this.configArchive);
    }

    getBasTypeLoader(): BasTypeLoader {
        return new DummyBasTypeLoader(this.cacheInfo);
    }

    getQuestTypeLoader(): QuestTypeLoader | undefined {
        return undefined;
    }

    getTextureLoader(): TextureLoader {
        const animatedTextureIds = [DatTextureLoader.WATER_DROPLETS_TEXTURE_ID, 24];
        return new DatTextureLoader(this.textureArchive, animatedTextureIds);
    }

    getModelLoader(): LegacyModelLoader {
        return LegacyModelLoader.load(this.modelArchive);
    }

    getSeqFrameLoader(): SeqFrameLoader {
        return LegacySeqFrameLoader.load(this.modelArchive);
    }

    getSkeletalSeqLoader(): SkeletalSeqLoader | undefined {
        return undefined;
    }

    getMapFileLoader(): MapFileLoader {
        return new LegacyMapFileLoader(this.mapIndex, new Dat2MapIndex(this.mapIndex));
    }

    getMapScenes(): IndexedSprite[] {
        return loadMapScenes(this.mediaArchive);
    }

    getMapFunctions(): IndexedSprite[] {
        return loadMapFunctions(this.mediaArchive);
    }
}
