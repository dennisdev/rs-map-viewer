import { BasTypeLoader, DummyBasTypeLoader } from "../../config/bastype/BasTypeLoader";
import {
    DatFloorTypeLoader,
    FloorTypeLoader,
    OverlayFloorTypeLoader,
} from "../../config/floortype/FloorTypeLoader";
import { LocTypeLoader } from "../../config/loctype/LocTypeLoader";
import { NpcTypeLoader } from "../../config/npctype/NpcTypeLoader";
import { ObjTypeLoader } from "../../config/objtype/ObjTypeLoader";
import { SeqTypeLoader } from "../../config/seqtype/SeqTypeLoader";
import { VarBitTypeLoader } from "../../config/vartype/bit/VarBitTypeLoader";
import { MapFileIndex } from "../../map/MapFileIndex";
import { ModelLoader } from "../../model/ModelLoader";
import { SeqFrameLoader } from "../../model/seq/SeqFrameLoader";
import { IndexedSprite } from "../../sprite/IndexedSprite";
import { TextureLoader } from "../../texture/TextureLoader";
import { ApiType } from "../ApiType";
import { Archive } from "../Archive";
import { CacheIndex } from "../CacheIndex";
import { CacheInfo } from "../CacheInfo";
import { CacheSystem } from "../CacheSystem";
import { IndexType } from "../IndexType";
import { CacheLoaderFactory } from "./CacheLoaderFactory";

export class LegacyCacheLoaderFactory implements CacheLoaderFactory {
    configIndex: CacheIndex;
    configArchive: Archive;

    floTypeLoader?: OverlayFloorTypeLoader;

    constructor(
        readonly cacheInfo: CacheInfo,
        readonly cacheSystem: CacheSystem,
    ) {
        this.configIndex = cacheSystem.getIndex(IndexType.DAT.configs);
        this.configArchive = this.configIndex.getArchive(0);
        // this.mediaArchive = this.configIndex.getArchive(ConfigType.DAT.media);
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
        return {
            load: () => {
                throw new Error("Method not implemented.");
            },
        };
    }

    getLocTypeLoader(): LocTypeLoader {
        throw new Error("Method not implemented.");
    }

    getNpcTypeLoader(): NpcTypeLoader {
        throw new Error("Method not implemented.");
    }

    getObjTypeLoader(): ObjTypeLoader {
        throw new Error("Method not implemented.");
    }

    getSeqTypeLoader(): SeqTypeLoader {
        throw new Error("Method not implemented.");
    }

    getBasTypeLoader(): BasTypeLoader {
        return new DummyBasTypeLoader(this.cacheInfo);
    }

    getTextureLoader(): TextureLoader {
        throw new Error("Method not implemented.");
    }

    getModelLoader(): ModelLoader {
        throw new Error("Method not implemented.");
    }

    getSeqFrameLoader(): SeqFrameLoader {
        throw new Error("Method not implemented.");
    }

    getMapFileIndex(): MapFileIndex {
        throw new Error("Method not implemented.");
    }

    getMapIndex(): CacheIndex<ApiType.SYNC> {
        throw new Error("Method not implemented.");
    }

    getMapScenes(): IndexedSprite[] {
        return [];
    }
}
