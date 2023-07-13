import { ByteBuffer } from "../../util/ByteBuffer";
import { Archive } from "../Archive";
import { CacheInfo } from "../Types";
import { ObjectDefinition } from "../definition/ObjectDefinition";
import {
    ArchiveDefinitionLoader,
    BaseDefinitionLoader,
    CachedDefinitionLoader,
    DefinitionLoader,
} from "./DefinitionLoader";

export type ObjectLoader = DefinitionLoader<ObjectDefinition>;

export class ObjectDat2Loader extends ArchiveDefinitionLoader<ObjectDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(archive, ObjectDefinition, cacheInfo);
    }
}

export class CachedObjectDat2Loader extends CachedDefinitionLoader<ObjectDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(new ObjectDat2Loader(archive, cacheInfo));
    }
}

export class ObjectDatLoader extends BaseDefinitionLoader<ObjectDefinition> {
    static load(configArchive: Archive, cacheInfo: CacheInfo): ObjectDatLoader {
        const dataFile = configArchive.getFileNamed("loc.dat");
        const indexFile = configArchive.getFileNamed("loc.idx");
        if (!dataFile) {
            throw new Error("loc.dat not found");
        }
        if (!indexFile) {
            throw new Error("loc.idx not found");
        }
        const indexBuffer = new ByteBuffer(indexFile.data);
        const objectCount = indexBuffer.readUnsignedShort();

        const dataOffsets = new Int32Array(objectCount);

        let offset = indexBuffer.offset;
        for (let i = 0; i < objectCount; i++) {
            dataOffsets[i] = offset;
            offset += indexBuffer.readUnsignedShort();
        }

        return new ObjectDatLoader(
            cacheInfo,
            objectCount,
            new ByteBuffer(dataFile.data),
            dataOffsets
        );
    }

    constructor(
        cacheInfo: CacheInfo,
        public objectCount: number,
        private dataBuffer: ByteBuffer,
        private dataOffsets: Int32Array
    ) {
        super(ObjectDefinition, cacheInfo);
    }

    override getDataBuffer(id: number): ByteBuffer | undefined {
        if (id < 0 || id >= this.dataOffsets.length) {
            return undefined;
        }
        this.dataBuffer.offset = this.dataOffsets[id];
        return this.dataBuffer;
    }
}

export class CachedObjectDatLoader extends CachedDefinitionLoader<ObjectDefinition> {
    constructor(archive: Archive, cacheInfo: CacheInfo) {
        super(ObjectDatLoader.load(archive, cacheInfo));
    }
}
