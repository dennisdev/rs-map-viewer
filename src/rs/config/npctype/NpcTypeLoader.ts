import { Archive } from "../../cache/Archive";
import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import {
    ArchiveTypeLoader,
    IndexTypeLoader,
    IndexedDatTypeLoader,
    TypeLoader,
} from "../TypeLoader";
import { NpcType } from "./NpcType";

export type NpcTypeLoader = TypeLoader<NpcType>;

export class DatNpcTypeLoader {
    static load(cacheInfo: CacheInfo, configArchive: Archive): NpcTypeLoader {
        return IndexedDatTypeLoader.load(NpcType, cacheInfo, configArchive, "npc");
    }
}

export class ArchiveNpcTypeLoader extends ArchiveTypeLoader<NpcType> implements NpcTypeLoader {
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(NpcType, cacheInfo, archive);
    }
}

export class IndexNpcTypeLoader extends IndexTypeLoader<NpcType> implements NpcTypeLoader {
    constructor(cacheInfo: CacheInfo, index: CacheIndex) {
        super(NpcType, cacheInfo, index, 7);
    }
}
