import { ByteBuffer } from "../../util/ByteBuffer";
import { Archive } from "../Archive";
import { CacheInfo } from "../Types";
import { ItemDefinition } from "../definition/ItemDefinition";
import {
    ArchiveDefinitionLoader,
    BaseDefinitionLoader,
    CachedDefinitionLoader,
    DefinitionLoader,
} from "./DefinitionLoader";

export type ItemLoader = DefinitionLoader<ItemDefinition>;

export class ItemDat2Loader extends ArchiveDefinitionLoader<ItemDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, ItemDefinition, cacheInfo);
    }
}

export class CachedItemDat2Loader extends CachedDefinitionLoader<ItemDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(new ItemDat2Loader(archive, cacheInfo));
    }
}

export class ItemDatLoader extends BaseDefinitionLoader<ItemDefinition> {
    static load(configArchive: Archive, cacheInfo: CacheInfo): ItemDatLoader {
        const dataFile = configArchive.getFileNamed("obj.dat");
        const indexFile = configArchive.getFileNamed("obj.idx");
        if (!dataFile) {
            throw new Error("obj.dat not found");
        }
        if (!indexFile) {
            throw new Error("obj.idx not found");
        }
        const indexBuffer = new ByteBuffer(indexFile.data);
        const itemCount = indexBuffer.readUnsignedShort();

        const dataOffsets = new Int32Array(itemCount);

        let offset = indexBuffer.offset;
        for (let i = 0; i < itemCount; i++) {
            dataOffsets[i] = offset;
            offset += indexBuffer.readUnsignedShort();
        }

        return new ItemDatLoader(
            cacheInfo,
            itemCount,
            new ByteBuffer(dataFile.data),
            dataOffsets
        );
    }

    constructor(
        cacheInfo: CacheInfo,
        public itemCount: number,
        private dataBuffer: ByteBuffer,
        private dataOffsets: Int32Array
    ) {
        super(ItemDefinition, cacheInfo);
    }

    override getDataBuffer(id: number): ByteBuffer | undefined {
        if (id < 0 || id >= this.dataOffsets.length) {
            return undefined;
        }
        this.dataBuffer.offset = this.dataOffsets[id];
        return this.dataBuffer;
    }
}

export class CachedItemDatLoader extends CachedDefinitionLoader<ItemDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(ItemDatLoader.load(archive, cacheInfo));
    }
}
