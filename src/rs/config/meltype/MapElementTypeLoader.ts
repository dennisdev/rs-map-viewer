import { Archive } from "../../cache/Archive";
import { CacheInfo } from "../../cache/CacheInfo";
import { ArchiveTypeLoader, TypeLoader } from "../TypeLoader";
import { MapElementType } from "./MapElementType";

export type MapElementTypeLoader = TypeLoader<MapElementType>;

export class ArchiveMapElementTypeLoader
    extends ArchiveTypeLoader<MapElementType>
    implements MapElementTypeLoader
{
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(MapElementType, cacheInfo, archive);
    }
}
