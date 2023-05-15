import { ModelData } from "../../../model/ModelData";
import { IndexSync } from "../../Index";
import { StoreSync } from "../../Store";

export interface ModelLoader {
    getModel(id: number): ModelData | undefined;
}

export class IndexModelLoader implements ModelLoader {
    modelIndex: IndexSync<StoreSync>;

    constructor(modelIndex: IndexSync<StoreSync>) {
        this.modelIndex = modelIndex;
    }

    getModel(id: number): ModelData | undefined {
        const file = this.modelIndex.getFile(id, 0);
        return file && ModelData.decode(file.data);
    }
}

export class CachedModelLoader extends IndexModelLoader {
    cache: Map<number, ModelData>;

    constructor(modelIndex: IndexSync<StoreSync>) {
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
