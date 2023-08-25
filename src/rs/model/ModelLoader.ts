import { CacheIndex } from "../cache/CacheIndex";
import { ModelData } from "./ModelData";

export interface ModelLoader {
    getModel(id: number): ModelData | undefined;
}

export class IndexModelLoader implements ModelLoader {
    modelIndex: CacheIndex;

    constructor(modelIndex: CacheIndex) {
        this.modelIndex = modelIndex;
    }

    getModel(id: number): ModelData | undefined {
        try {
            const file = this.modelIndex.getFile(id, 0);
            return file && ModelData.decode(file.data);
        } catch (e) {
            console.error("Failed loading model file", id, e);
            return undefined;
        }
    }
}
