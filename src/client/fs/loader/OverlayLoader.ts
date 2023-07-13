import { Archive } from "../Archive";
import { CacheInfo } from "../Types";
import { FloorDefinition } from "../definition/floor/FloorDefinition";
import { OverlayDefinition } from "../definition/floor/OverlayDefinition";
import {
    ArchiveDefinitionLoader,
    CachedDefinitionLoader,
    DefinitionLoader,
} from "./DefinitionLoader";

export type OverlayLoader = DefinitionLoader<OverlayDefinition>;

export class OverlayDat2Loader extends ArchiveDefinitionLoader<OverlayDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, OverlayDefinition, cacheInfo);
    }
}

export class CachedOverlayDat2Loader extends CachedDefinitionLoader<OverlayDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(new OverlayDat2Loader(archive, cacheInfo));
    }
}

export type FloorLoader = DefinitionLoader<FloorDefinition>;

export class FloorDatLoader implements DefinitionLoader<OverlayDefinition> {
    floors: OverlayDefinition[];

    static load(configArchive: Archive, cacheInfo: CacheInfo): FloorDatLoader {
        const file = configArchive.getFileNamed("flo.dat");
        if (!file) {
            throw new Error("flo.dat not found");
        }
        const buffer = file.getDataAsBuffer();

        const count = buffer.readUnsignedShort();
        const overlays = new Array<OverlayDefinition>(count);
        for (let i = 0; i < count; i++) {
            const overlay = (overlays[i] = new OverlayDefinition(i, cacheInfo));
            overlay.decode(buffer);
            overlay.post();
        }

        return new FloorDatLoader(overlays);
    }

    constructor(floors: OverlayDefinition[]) {
        this.floors = floors;
    }

    getDefinition(id: number): OverlayDefinition {
        return this.floors[id];
    }

    resetCache(): void {}
}
