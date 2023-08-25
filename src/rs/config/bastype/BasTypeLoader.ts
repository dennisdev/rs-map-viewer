import { Archive } from "../../cache/Archive";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, TypeLoader } from "../TypeLoader";
import { BasType } from "./BasType";

export type BasTypeLoader = TypeLoader<BasType>;

export class DummyBasTypeLoader implements BasTypeLoader {
    constructor(readonly cacheInfo: CacheInfo) {}

    load(id: number): BasType {
        return new BasType(id, this.cacheInfo);
    }
}

export class ArchiveBasTypeLoader extends ArchiveTypeLoader<BasType> {
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(BasType, cacheInfo, archive);
    }
}
