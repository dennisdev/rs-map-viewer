import { ApiType } from "./ApiType";
import { Archive } from "./Archive";
import { CacheFiles } from "./CacheFiles";
import { CacheIndex, CacheIndexDat, CacheIndexDat2, LegacyCacheIndex } from "./CacheIndex";
import { CacheType } from "./CacheType";
import { MemoryStore } from "./store/MemoryStore";

export class CacheSystem<A extends ApiType = ApiType.SYNC> {
    static loadIndicesFromStore(cacheType: "dat" | "dat2", store: MemoryStore) {
        return store.indexFiles.map((indexFile, id) => {
            if (!indexFile) {
                return undefined;
            }
            if (cacheType === "dat") {
                return CacheIndexDat.fromStore(id, store, indexFile);
            } else {
                return CacheIndexDat2.fromStore(id, store);
            }
        });
    }

    static loadLegacy(cacheFiles: CacheFiles): CacheSystem {
        const configData = cacheFiles.files.get("config");
        if (!configData) {
            throw new Error("Missing config file");
        }
        const configArchive = Archive.decodeOld(0, new Int8Array(configData), true);

        const configIndex = new LegacyCacheIndex(0, [configArchive]);

        return new CacheSystem([configIndex]);
    }

    static fromFiles(
        cacheType: CacheType,
        cacheFiles: CacheFiles,
        indicesToLoad: number[] = [],
    ): CacheSystem {
        switch (cacheType) {
            case "legacy":
                return CacheSystem.loadLegacy(cacheFiles);
            case "dat":
            case "dat2":
                const store = MemoryStore.fromFiles(cacheFiles, indicesToLoad);
                const indices = CacheSystem.loadIndicesFromStore(cacheType, store);
                return new CacheSystem(indices);
        }
        throw new Error("Not implemented");
    }

    constructor(readonly indices: (CacheIndex<A> | undefined)[]) {}

    indexExists(indexId: number): boolean {
        return !!this.indices[indexId];
    }

    getIndex(indexId: number): CacheIndex<A> {
        const index = this.indices[indexId];
        if (!index) {
            throw new Error("Index not found: " + indexId);
        }
        return index;
    }
}
