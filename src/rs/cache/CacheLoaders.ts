import { CacheSystem } from "./CacheSystem";
import { CacheLoaderFactory, getCacheLoaderFactory } from "./loader/CacheLoaderFactory";
import { BasTypeLoader } from "../config/bastype/BasTypeLoader";
import { LocTypeLoader } from "../config/loctype/LocTypeLoader";
import { NpcTypeLoader } from "../config/npctype/NpcTypeLoader";
import { ObjTypeLoader } from "../config/objtype/ObjTypeLoader";
import { SeqTypeLoader } from "../config/seqtype/SeqTypeLoader";
import { VarManager } from "../config/vartype/VarManager";
import { MapFileIndex } from "../map/MapFileIndex";
import { SeqFrameLoader } from "../model/seq/SeqFrameLoader";
import { TextureLoader } from "../texture/TextureLoader";
import { LoadedCache } from "../../util/Caches";

export class CacheLoaders {
    // Cache
    cacheSystem!: CacheSystem;
    loaderFactory!: CacheLoaderFactory;

    textureLoader!: TextureLoader;
    seqTypeLoader!: SeqTypeLoader;
    seqFrameLoader!: SeqFrameLoader;

    locTypeLoader!: LocTypeLoader;
    objTypeLoader!: ObjTypeLoader;
    npcTypeLoader!: NpcTypeLoader;

    basTypeLoader!: BasTypeLoader;

    varManager!: VarManager;

    mapFileIndex!: MapFileIndex;

    constructor(cache: LoadedCache) {
        this.cacheSystem = CacheSystem.fromFiles(cache.type, cache.files);
        this.loaderFactory = getCacheLoaderFactory(cache.info, this.cacheSystem);

        this.textureLoader = this.loaderFactory.getTextureLoader();
        this.seqTypeLoader = this.loaderFactory.getSeqTypeLoader();
        this.seqFrameLoader = this.loaderFactory.getSeqFrameLoader();
        this.locTypeLoader = this.loaderFactory.getLocTypeLoader();
        this.objTypeLoader = this.loaderFactory.getObjTypeLoader();
        this.npcTypeLoader = this.loaderFactory.getNpcTypeLoader();
        this.basTypeLoader = this.loaderFactory.getBasTypeLoader();

        this.varManager = new VarManager(this.loaderFactory.getVarBitTypeLoader());
        const questTypeLoader = this.loaderFactory.getQuestTypeLoader();
        if (questTypeLoader) {
            this.varManager.setQuestsCompleted(questTypeLoader);
        }

        this.mapFileIndex = this.loaderFactory.getMapFileIndex();
    }
}