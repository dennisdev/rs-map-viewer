import { Model } from "../../client/model/Model";
import { ModelHashBuffer, getModelHash } from "../buffer/ModelHashBuffer";
import { DrawData } from "../buffer/RenderBuffer";

export type SceneModel = {
    model: Model;
    lowDetail: boolean;
    sceneHeight: number;
} & DrawData;

export function groupModels(
    modelDataBuf: ModelHashBuffer,
    sceneModels: SceneModel[]
): SceneModel[][] {
    const modelMap: Map<number, SceneModel[]> = new Map();

    const modelHashMap: Map<Model, number> = new Map();

    for (const sceneModel of sceneModels) {
        const model = sceneModel.model;

        if (model.faceCount === 0) {
            continue;
        }

        let hash = modelHashMap.get(model);
        if (hash === undefined) {
            hash = getModelHash(modelDataBuf, model);

            modelHashMap.set(model, hash);
        }

        const models = modelMap.get(hash);
        if (models) {
            models.push(sceneModel);
        } else {
            modelMap.set(hash, [sceneModel]);
        }
    }

    return Array.from(modelMap.values());
}
