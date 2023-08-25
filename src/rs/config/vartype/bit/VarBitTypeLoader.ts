import { Archive } from "../../../cache/Archive";
import { CacheIndex } from "../../../cache/CacheIndex";
import { CacheInfo } from "../../../cache/CacheInfo";
import { ArchiveTypeLoader, DatTypeLoader, IndexTypeLoader, TypeLoader } from "../../TypeLoader";
import { VarBitType } from "./VarBitType";

export type VarBitTypeLoader = TypeLoader<VarBitType>;

export class DatVarBitTypeLoader {
    static load(cacheInfo: CacheInfo, configArchive: Archive): VarBitTypeLoader {
        return DatTypeLoader.load(VarBitType, cacheInfo, configArchive, "varbit");
    }
}

export class ArchiveVarBitTypeLoader
    extends ArchiveTypeLoader<VarBitType>
    implements VarBitTypeLoader
{
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(VarBitType, cacheInfo, archive);
    }
}

export class IndexVarBitTypeLoader extends IndexTypeLoader<VarBitType> implements VarBitTypeLoader {
    constructor(cacheInfo: CacheInfo, index: CacheIndex) {
        super(VarBitType, cacheInfo, index, 10);
    }
}
