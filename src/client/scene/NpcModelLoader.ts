import { AnimationDefinition } from "../fs/definition/AnimationDefinition";
import { NpcDefinition } from "../fs/definition/NpcDefinition";
import { AnimationFrameMapLoader } from "../fs/loader/AnimationFrameMapLoader";
import { AnimationLoader } from "../fs/loader/AnimationLoader";
import { ModelLoader } from "../fs/loader/ModelLoader";
import { NpcLoader } from "../fs/loader/NpcLoader";
import { Model } from "../model/Model";
import { ModelData } from "../model/ModelData";
import { VarpManager } from "../VarpManager";

export class NpcModelLoader {
    varpManager: VarpManager;

    modelLoader: ModelLoader;

    animationLoader: AnimationLoader;

    animationFrameMapLoader: AnimationFrameMapLoader;

    npcLoader: NpcLoader;

    modelCache: Map<number, Model>;

    constructor(
        varpManager: VarpManager,
        modelLoader: ModelLoader,
        animationLoader: AnimationLoader,
        animationFrameMapLoader: AnimationFrameMapLoader,
        npcLoader: NpcLoader
    ) {
        this.varpManager = varpManager;
        this.modelLoader = modelLoader;
        this.animationLoader = animationLoader;
        this.animationFrameMapLoader = animationFrameMapLoader;
        this.npcLoader = npcLoader;
        this.modelCache = new Map();
    }

    getModel(
        def: NpcDefinition,
        animationId: number,
        frame: number
    ): Model | undefined {
        if (def.transforms) {
            const transformed = def.transform(this.varpManager, this.npcLoader);
            if (!transformed) {
                return undefined;
            }
            return this.getModel(transformed, animationId, frame);
        }

        let model = this.modelCache.get(def.id);
        if (!model) {
            const models = new Array<ModelData>(def.modelIds.length);
            for (let i = 0; i < models.length; i++) {
                const modelData = this.modelLoader.getModel(def.modelIds[i]);
                if (modelData) {
                    models[i] = modelData;
                }
            }

            const merged = ModelData.merge(models, models.length);

            if (def.recolorFrom) {
                for (let i = 0; i < def.recolorFrom.length; i++) {
                    merged.recolor(def.recolorFrom[i], def.recolorTo[i]);
                }
            }

            if (def.retextureFrom) {
                for (let i = 0; i < def.retextureFrom.length; i++) {
                    merged.retexture(def.retextureFrom[i], def.retextureTo[i]);
                }
            }

            model = merged.light(
                def.ambient + 64,
                def.contrast * 5 + 850,
                -30,
                -50,
                -30
            );

            this.modelCache.set(def.id, model);
        }

        const anim = this.animationLoader.getDefinition(animationId);
        if (anim && animationId !== -1 && frame !== -1) {
            model = this.transformNpcModel(model, anim, frame);
        }

        if (def.widthScale !== 128 || def.heightScale !== 128) {
            model.scale(def.widthScale, def.heightScale, def.widthScale);
        }

        return model;
    }

    transformNpcModel(
        model: Model,
        anim: AnimationDefinition,
        frame: number
    ): Model {
        if (anim.isAnimMaya()) {
            return model;
        }
        if (!anim.frameIds || anim.frameIds.length === 0) {
            return model;
        }

        frame = anim.frameIds[frame];
        const animFrameMap = this.animationFrameMapLoader.getFrameMap(
            frame >> 16
        );
        frame &= 0xffff;

        if (animFrameMap) {
            model = Model.copyAnimated(
                model,
                !animFrameMap.hasAlphaTransform(frame)
            );

            model.animate(animFrameMap.frames[frame]);
        }

        return model;
    }
}
