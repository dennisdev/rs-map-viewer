import { ModelData } from "../../../model/ModelData";
import { GenericIndex } from "../../Index";

export interface ModelLoader {
    getModel(id: number): ModelData | undefined;
}

export class IndexModelLoader implements ModelLoader {
    modelIndex: GenericIndex;

    constructor(modelIndex: GenericIndex) {
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

export class CachedModelLoader extends IndexModelLoader {
    cache: Map<number, ModelData>;

    constructor(modelIndex: GenericIndex) {
        super(modelIndex);
        this.cache = new Map();
    }

    getModel(id: number): ModelData | undefined {
        let model = this.cache.get(id);
        if (!model) {
            model = super.getModel(id);
            if (model) {
                this.cache.set(id, model);
            }
        }
        return model;
    }
}
