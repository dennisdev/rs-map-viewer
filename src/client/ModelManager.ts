import { File } from "./fs/File";
import { IndexSync } from "./fs/Index";
import { MemoryStore } from "./fs/MemoryStore";
import { ModelData } from "./model/ModelData";

export class ModelManager {
    private readonly index: IndexSync<MemoryStore>;

    private readonly fileCache: Map<number, Int8Array>;

    constructor(index: IndexSync<MemoryStore>) {
        this.index = index;
        this.fileCache = new Map();
    }

    isLoaded(id: number): boolean {
        return this.fileCache.has(id);
    }

    async loadFile(id: number): Promise<Int8Array | undefined> {
        if (this.isLoaded(id)) {
            return this.fileCache.get(id);
        }
        const file = await this.index.getFile(id, 0);
        if (!file) {
            return undefined;
        }
        const data = file.data;
        this.fileCache.set(id, data);
        return data;
    }

    async getModel(id: number): Promise<ModelData | undefined> {
        const cached = this.fileCache.get(id);
        if (cached) {
            return ModelData.decode(cached);
        }
        const data = await this.loadFile(id);
        if (!data) {
            return undefined;
        }
        return ModelData.decode(data);
    }

    getModelSync(id: number): ModelData | undefined {
        if (!this.isLoaded(id)) {
            this.loadFile(id);
        }
        const data = this.fileCache.get(id);
        if (!data) {
            return undefined;
        }
        return ModelData.decode(data);
    }
}
