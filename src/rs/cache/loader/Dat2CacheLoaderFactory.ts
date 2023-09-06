import {
    ArchiveOverlayFloorTypeLoader,
    ArchiveUnderlayFloorTypeLoader,
    FloorTypeLoader,
    OverlayFloorTypeLoader,
} from "../../config/floortype/FloorTypeLoader";
import {
    ArchiveLocTypeLoader,
    IndexLocTypeLoader,
    LocTypeLoader,
} from "../../config/loctype/LocTypeLoader";
import {
    ArchiveNpcTypeLoader,
    IndexNpcTypeLoader,
    NpcTypeLoader,
} from "../../config/npctype/NpcTypeLoader";
import {
    ArchiveObjTypeLoader,
    IndexObjTypeLoader,
    ObjTypeLoader,
} from "../../config/objtype/ObjTypeLoader";
import {
    ArchiveSeqTypeLoader,
    IndexSeqTypeLoader,
    SeqTypeLoader,
} from "../../config/seqtype/SeqTypeLoader";
import {
    ArchiveVarBitTypeLoader,
    IndexVarBitTypeLoader,
    VarBitTypeLoader,
} from "../../config/vartype/bit/VarBitTypeLoader";
import { Dat2MapIndex, MapFileIndex } from "../../map/MapFileIndex";
import { TextureLoader } from "../../texture/TextureLoader";
import { IndexModelLoader, ModelLoader } from "../../model/ModelLoader";
import { IndexSeqBaseLoader, SeqBaseLoader } from "../../model/seq/SeqBaseLoader";
import { Dat2SeqFrameLoader, SeqFrameLoader } from "../../model/seq/SeqFrameLoader";
import { ApiType } from "../ApiType";
import { CacheIndex } from "../CacheIndex";
import { CacheInfo } from "../CacheInfo";
import { CacheSystem } from "../CacheSystem";
import { CacheType } from "../CacheType";
import { ConfigType } from "../ConfigType";
import { IndexType } from "../IndexType";
import { CacheLoaderFactory } from "./CacheLoaderFactory";
import { SpriteTextureLoader } from "../../texture/SpriteTextureLoader";
import { OldProceduralTextureLoader } from "../../texture/OldProceduralTextureLoader";
import { ProceduralTextureLoader } from "../../texture/ProceduralTextureLoader";
import { IndexedSprite } from "../../sprite/IndexedSprite";
import { GraphicsDefaults } from "../../config/defaults/GraphicsDefaults";
import { SpriteLoader } from "../../sprite/SpriteLoader";
import { MapSceneTypeLoader } from "../../config/mapscenetype/MapSceneTypeLoader";
import {
    ArchiveBasTypeLoader,
    BasTypeLoader,
    DummyBasTypeLoader,
} from "../../config/bastype/BasTypeLoader";
import { IndexSkeletalSeqLoader, SkeletalSeqLoader } from "../../model/skeletal/SkeletalSeqLoader";
import { ArchiveQuestTypeLoader, QuestTypeLoader } from "../../config/questtype/QuestTypeLoader";

export class Dat2CacheLoaderFactory implements CacheLoaderFactory {
    constructor(
        readonly cacheInfo: CacheInfo,
        readonly cacheType: CacheType,
        readonly cacheSystem: CacheSystem,
    ) {}

    isIndexConfigs(): boolean {
        return this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 488;
    }

    getUnderlayTypeLoader(): FloorTypeLoader {
        const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
        const underlaysArchive = configIndex.getArchive(ConfigType.DAT2.underlays);
        return new ArchiveUnderlayFloorTypeLoader(this.cacheInfo, underlaysArchive);
    }

    getOverlayTypeLoader(): OverlayFloorTypeLoader {
        const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
        const overlaysArchive = configIndex.getArchive(ConfigType.DAT2.overlays);
        return new ArchiveOverlayFloorTypeLoader(this.cacheInfo, overlaysArchive);
    }

    getVarBitTypeLoader(): VarBitTypeLoader {
        if (this.isIndexConfigs()) {
            const varbitsIndex = this.cacheSystem.getIndex(IndexType.RS2.varbits);
            return new IndexVarBitTypeLoader(this.cacheInfo, varbitsIndex);
        } else {
            const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
            const varbitsArchive = configIndex.getArchive(ConfigType.DAT2.varbits);
            return new ArchiveVarBitTypeLoader(this.cacheInfo, varbitsArchive);
        }
    }

    getLocTypeLoader(): LocTypeLoader {
        if (this.isIndexConfigs()) {
            const locsIndex = this.cacheSystem.getIndex(IndexType.RS2.locs);
            return new IndexLocTypeLoader(this.cacheInfo, locsIndex);
        } else {
            const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
            const locsArchive = configIndex.getArchive(ConfigType.DAT2.locs);
            return new ArchiveLocTypeLoader(this.cacheInfo, locsArchive);
        }
    }

    getNpcTypeLoader(): NpcTypeLoader {
        if (this.isIndexConfigs()) {
            const npcIndex = this.cacheSystem.getIndex(IndexType.RS2.npcs);
            return new IndexNpcTypeLoader(this.cacheInfo, npcIndex);
        } else {
            const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
            const npcsArchive = configIndex.getArchive(ConfigType.DAT2.npcs);
            return new ArchiveNpcTypeLoader(this.cacheInfo, npcsArchive);
        }
    }

    getObjTypeLoader(): ObjTypeLoader {
        if (this.isIndexConfigs()) {
            const objIndex = this.cacheSystem.getIndex(IndexType.RS2.objs);
            return new IndexObjTypeLoader(this.cacheInfo, objIndex);
        } else {
            const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
            const objsArchive = configIndex.getArchive(ConfigType.DAT2.objs);
            return new ArchiveObjTypeLoader(this.cacheInfo, objsArchive);
        }
    }

    getSeqTypeLoader(): SeqTypeLoader {
        if (this.isIndexConfigs()) {
            const seqIndex = this.cacheSystem.getIndex(IndexType.RS2.seqs);
            return new IndexSeqTypeLoader(this.cacheInfo, seqIndex);
        } else {
            const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
            const seqsArchive = configIndex.getArchive(ConfigType.DAT2.seqs);
            return new ArchiveSeqTypeLoader(this.cacheInfo, seqsArchive);
        }
    }

    getBasTypeLoader(): BasTypeLoader {
        if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 530) {
            const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
            try {
                const basArchive = configIndex.getArchive(ConfigType.RS2.bas);
                return new ArchiveBasTypeLoader(this.cacheInfo, basArchive);
            } catch (e) {
                console.error("Failed to load bastype archive", e);
            }
        }
        return new DummyBasTypeLoader(this.cacheInfo);
    }

    getQuestTypeLoader(): QuestTypeLoader | undefined {
        const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
        if (
            this.cacheInfo.game === "runescape" &&
            configIndex.archiveExists(ConfigType.RS2.quests)
        ) {
            try {
                const questArchive = configIndex.getArchive(ConfigType.RS2.quests);
                return new ArchiveQuestTypeLoader(this.cacheInfo, questArchive);
            } catch (e) {
                console.error("Failed to load questtype archive", e);
            }
        }
        return undefined;
    }

    getTextureLoader(): TextureLoader {
        const textureIndex = this.cacheSystem.getIndex(IndexType.DAT2.textures);
        const spriteIndex = this.cacheSystem.getIndex(IndexType.DAT2.sprites);
        if (
            this.cacheInfo.game === "oldschool" ||
            (this.cacheInfo.game === "runescape" && this.cacheInfo.revision < 474)
        ) {
            return SpriteTextureLoader.load(textureIndex, spriteIndex);
        } else if (this.cacheSystem.indexExists(IndexType.RS2.materials)) {
            // materials starting 499 or 500

            // removed in 629
            const hasAlphaMaterialField = this.cacheInfo.revision < 629;
            // after 534
            const hasAlphaOperation = this.cacheInfo.revision >= 537;

            const materialIndex = this.cacheSystem.getIndex(IndexType.RS2.materials);

            return ProceduralTextureLoader.load(
                hasAlphaMaterialField,
                hasAlphaOperation,
                materialIndex,
                textureIndex,
                spriteIndex,
            );
        } else {
            return OldProceduralTextureLoader.load(textureIndex, spriteIndex);
        }
    }

    getModelLoader(): ModelLoader {
        const modelIndex = this.cacheSystem.getIndex(IndexType.DAT2.models);
        return new IndexModelLoader(modelIndex);
    }

    getSeqBaseLoader(): SeqBaseLoader {
        const index = this.cacheSystem.getIndex(IndexType.DAT2.skeletons);
        return new IndexSeqBaseLoader(this.cacheInfo, index);
    }

    getSeqFrameLoader(): SeqFrameLoader {
        const index = this.cacheSystem.getIndex(IndexType.DAT2.animations);
        return new Dat2SeqFrameLoader(this.cacheInfo, index, this.getSeqBaseLoader());
    }

    getSkeletalSeqLoader(): SkeletalSeqLoader | undefined {
        const index = this.cacheSystem.getIndex(IndexType.DAT2.animations);
        return new IndexSkeletalSeqLoader(index, this.getSeqBaseLoader());
    }

    getMapFileIndex(): MapFileIndex {
        const mapIndex = this.cacheSystem.getIndex(IndexType.DAT2.maps);
        return new Dat2MapIndex(mapIndex);
    }

    getMapIndex(): CacheIndex<ApiType.SYNC> {
        return this.cacheSystem.getIndex(IndexType.DAT2.maps);
    }

    getMapScenes(): IndexedSprite[] {
        const configIndex = this.cacheSystem.getIndex(IndexType.DAT2.configs);
        const spriteIndex = this.cacheSystem.getIndex(IndexType.DAT2.sprites);

        if (
            this.cacheInfo.game === "runescape" &&
            configIndex.archiveExists(ConfigType.RS2.mapScenes)
        ) {
            const mapScenesArchive = configIndex.getArchive(ConfigType.RS2.mapScenes);
            const mapSceneTypeLoader = new MapSceneTypeLoader(this.cacheInfo, mapScenesArchive);

            const mapSceneSprites = new Array<IndexedSprite>(mapScenesArchive.lastFileId);
            for (const id of mapScenesArchive.fileIds) {
                const mapScene = mapSceneTypeLoader.load(id);
                if (mapScene.spriteId === -1) {
                    continue;
                }
                const sprite = SpriteLoader.loadIntoIndexedSprite(spriteIndex, mapScene.spriteId);
                if (sprite) {
                    mapSceneSprites[id] = sprite;
                }
            }

            return mapSceneSprites;
        } else {
            const graphicDefaults = GraphicsDefaults.load(this.cacheInfo, this.cacheSystem);
            if (graphicDefaults.mapScenes === -1) {
                return [];
            }
            const mapScenes = SpriteLoader.loadIntoIndexedSprites(
                spriteIndex,
                graphicDefaults.mapScenes,
            );
            if (!mapScenes) {
                throw new Error("Failed to load map scenes");
            }

            return mapScenes;
        }
    }
}
