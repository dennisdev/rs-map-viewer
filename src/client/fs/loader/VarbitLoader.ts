import { ByteBuffer } from "../../util/ByteBuffer";
import { Archive } from "../Archive";
import { CacheInfo } from "../Types";
import { VarbitDefinition } from "../definition/VarbitDefinition";
import {
    ArchiveDefinitionLoader,
    CachedDefinitionLoader,
    DefinitionLoader,
} from "./DefinitionLoader";

export type VarbitLoader = DefinitionLoader<VarbitDefinition>;

export class VarbitDat2Loader extends ArchiveDefinitionLoader<VarbitDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, VarbitDefinition, cacheInfo);
    }
}

export class CachedVarbitDat2Loader extends CachedDefinitionLoader<VarbitDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(new VarbitDat2Loader(archive, cacheInfo));
    }
}

export class VarbitDatLoader implements DefinitionLoader<VarbitDefinition> {
    varbits: VarbitDefinition[];

    static load(configArchive: Archive, cacheInfo: CacheInfo): VarbitDatLoader {
        const file = configArchive.getFileNamed("varbit.dat");
        if (!file) {
            throw new Error("varbit.dat not found");
        }
        const buffer = new ByteBuffer(file.data);

        const count = buffer.readUnsignedShort();
        const varbits = new Array<VarbitDefinition>(count);
        for (let i = 0; i < count; i++) {
            const varbit = (varbits[i] = new VarbitDefinition(i, cacheInfo));
            varbit.decode(buffer);
            varbit.post();
        }

        return new VarbitDatLoader(varbits);
    }

    constructor(varbits: VarbitDefinition[]) {
        this.varbits = varbits;
    }

    getDefinition(id: number): VarbitDefinition {
        return this.varbits[id];
    }

    resetCache(): void {}
}
