import { ByteBuffer } from "../../util/ByteBuffer";
import { Archive } from "../Archive";
import { CacheInfo } from "../Types";
import { NpcDefinition } from "../definition/NpcDefinition";
import {
    ArchiveDefinitionLoader,
    BaseDefinitionLoader,
    CachedDefinitionLoader,
    DefinitionLoader,
} from "./DefinitionLoader";

export type NpcLoader = DefinitionLoader<NpcDefinition>;

export class NpcDat2Loader extends ArchiveDefinitionLoader<NpcDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, NpcDefinition, cacheInfo);
    }
}

export class CachedNpcDat2Loader extends CachedDefinitionLoader<NpcDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(new NpcDat2Loader(archive, cacheInfo));
    }
}

export class NpcDatLoader extends BaseDefinitionLoader<NpcDefinition> {
    static load(configArchive: Archive, cacheInfo: CacheInfo): NpcDatLoader {
        const dataFile = configArchive.getFileNamed("npc.dat");
        const indexFile = configArchive.getFileNamed("npc.idx");
        if (!dataFile) {
            throw new Error("loc.dat not found");
        }
        if (!indexFile) {
            throw new Error("loc.idx not found");
        }
        const indexBuffer = new ByteBuffer(indexFile.data);
        const npcCount = indexBuffer.readUnsignedShort();

        const dataOffsets = new Int32Array(npcCount);

        let offset = indexBuffer.offset;
        for (let i = 0; i < npcCount; i++) {
            dataOffsets[i] = offset;
            offset += indexBuffer.readUnsignedShort();
        }

        return new NpcDatLoader(
            cacheInfo,
            npcCount,
            new ByteBuffer(dataFile.data),
            dataOffsets
        );
    }

    constructor(
        cacheInfo: CacheInfo,
        public npcCount: number,
        private dataBuffer: ByteBuffer,
        private dataOffsets: Int32Array
    ) {
        super(NpcDefinition, cacheInfo);
    }

    override getDataBuffer(id: number): ByteBuffer | undefined {
        if (id < 0 || id >= this.dataOffsets.length) {
            return undefined;
        }
        this.dataBuffer.offset = this.dataOffsets[id];
        return this.dataBuffer;
    }
}

export class CachedNpcDatLoader extends CachedDefinitionLoader<NpcDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(NpcDatLoader.load(archive, cacheInfo));
    }
}
