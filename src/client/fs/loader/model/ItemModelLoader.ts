import { ItemLoader } from "../ItemLoader";
import { ModelLoader } from "./ModelLoader";
import { Model } from "../../../model/Model";

export class ItemModelLoader {
    itemLoader: ItemLoader;

    modelLoader: ModelLoader;

    modelCache: Map<number, Model>;

    constructor(itemLoader: ItemLoader, modelLoader: ModelLoader) {
        this.itemLoader = itemLoader;
        this.modelLoader = modelLoader;
        this.modelCache = new Map();
    }

    getModel(id: number, count: number): Model | undefined {
        if (id === -1) {
            return undefined;
        }

        const def = this.itemLoader.getDefinition(id);
        if (def.inventoryModel === undefined) {
            return undefined;
        }
        if (def.countObj && count > 1) {
            let countId = -1;
            for (let i = 0; i < 10; i++) {
                if (count >= def.countCo[i] && def.countCo[i] !== 0) {
                    countId = def.countObj[i];
                }
            }

            if (countId !== -1) {
                return this.getModel(countId, 1);
            }
        }

        let model = this.modelCache.get(id);
        if (model) {
            return model;
        }

        const modelData = this.modelLoader.getModel(def.inventoryModel);
        if (!modelData) {
            return undefined;
        }

        if (def.resizeX !== 128 || def.resizeY !== 128 || def.resizeZ !== 128) {
            modelData.resize(def.resizeX, def.resizeY, def.resizeZ);
        }

        if (def.recolorFrom) {
            for (let i = 0; i < def.recolorFrom.length; i++) {
                modelData.recolor(def.recolorFrom[i], def.recolorTo[i]);
            }
        }

        if (def.retextureFrom) {
            for (let i = 0; i < def.retextureFrom.length; i++) {
                modelData.retexture(def.retextureFrom[i], def.retextureTo[i]);
            }
        }

        model = modelData.light(
            def.ambient + 64,
            def.contrast + 768,
            -50,
            -10,
            -50
        );
        this.modelCache.set(id, model);
        return model;
    }
}
