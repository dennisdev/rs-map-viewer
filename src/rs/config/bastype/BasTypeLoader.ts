import { Archive } from "../../cache/Archive";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, DummyTypeLoader, TypeLoader } from "../TypeLoader";
import { BasType } from "./BasType";

export type BasTypeLoader = TypeLoader<BasType>;

export class DummyBasTypeLoader extends DummyTypeLoader<BasType> {
    constructor(cacheInfo: CacheInfo) {
        super(cacheInfo, BasType);
    }
}

export class ArchiveBasTypeLoader extends ArchiveTypeLoader<BasType> {
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(BasType, cacheInfo, archive);
    }
}
