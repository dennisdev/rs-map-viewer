import { Archive } from "../../cache/Archive";
import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import {
    ArchiveTypeLoader,
    IndexTypeLoader,
    IndexedDatTypeLoader,
    TypeLoader,
} from "../TypeLoader";
import { ObjType } from "./ObjType";

export type ObjTypeLoader = TypeLoader<ObjType>;

export class DatObjTypeLoader {
    static load(cacheInfo: CacheInfo, configArchive: Archive): ObjTypeLoader {
        return IndexedDatTypeLoader.load(ObjType, cacheInfo, configArchive, "obj");
    }
}

export class ArchiveObjTypeLoader extends ArchiveTypeLoader<ObjType> implements ObjTypeLoader {
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(ObjType, cacheInfo, archive);
    }
}

export class IndexObjTypeLoader extends IndexTypeLoader<ObjType> implements ObjTypeLoader {
    constructor(cacheInfo: CacheInfo, index: CacheIndex) {
        super(ObjType, cacheInfo, index);
    }
}
