import { Archive } from "../../cache/Archive";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, DatTypeLoader, TypeLoader } from "../TypeLoader";
import { FloorType } from "./FloorType";
import { OverlayFloorType } from "./OverlayFloorType";
import { UnderlayFloorType } from "./UnderlayFloorType";

export type FloorTypeLoader = TypeLoader<FloorType>;

export type UnderlayFloorTypeLoader = TypeLoader<UnderlayFloorType>;
export type OverlayFloorTypeLoader = TypeLoader<OverlayFloorType>;

export class ArchiveUnderlayFloorTypeLoader
    extends ArchiveTypeLoader<UnderlayFloorType>
    implements UnderlayFloorTypeLoader
{
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(UnderlayFloorType, cacheInfo, archive);
    }
}

export class ArchiveOverlayFloorTypeLoader
    extends ArchiveTypeLoader<OverlayFloorType>
    implements OverlayFloorTypeLoader
{
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(OverlayFloorType, cacheInfo, archive);
    }
}

export class DatFloorTypeLoader {
    static load(cacheInfo: CacheInfo, configArchive: Archive): OverlayFloorTypeLoader {
        return DatTypeLoader.load(OverlayFloorType, cacheInfo, configArchive, "flo");
    }
}
