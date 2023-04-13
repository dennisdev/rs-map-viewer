import { AnimationDefinition } from "../fs/definition/AnimationDefinition";
import { ObjectDefinition } from "../fs/definition/ObjectDefinition";
import { AnimationFrameMapLoader } from "../fs/loader/AnimationFrameMapLoader";
import { AnimationLoader } from "../fs/loader/AnimationLoader";
import { ModelLoader } from "../fs/loader/ModelLoader";
import { Model } from "../model/Model";
import { ModelData } from "../model/ModelData";
import { ObjectType } from "./ObjectType";

export type ContourGroundInfo = {
    heightMap: Int32Array[];
    sceneX: number;
    sceneHeight: number;
    sceneY: number;
};

export class ObjectModelLoader {
    static mergeObjectModelsCache: ModelData[] = new Array(4);

    modelLoader: ModelLoader;

    animationLoader: AnimationLoader;

    animationFrameMapLoader: AnimationFrameMapLoader;

    modelDataCache: Map<number, ModelData>;

    modelCache: Map<number, Model | ModelData>;

    constructor(modelLoader: ModelLoader, animationLoader: AnimationLoader, animationFrameMapLoader: AnimationFrameMapLoader) {
        this.modelLoader = modelLoader;
        this.animationLoader = animationLoader;
        this.modelDataCache = new Map();
        this.modelCache = new Map();
        this.animationFrameMapLoader = animationFrameMapLoader;
    }

    getModelData(id: number, mirrored: boolean): ModelData | undefined {
        let key = id;
        if (mirrored) {
            key += 0x10000;
        }
        let model = this.modelDataCache.get(key);
        if (!model) {
            model = this.modelLoader.getModel(id);
            if (model) {
                if (mirrored) {
                    model.mirror();
                }
                this.modelDataCache.set(key, model);
            }
        }
        return model;
    }

    getObjectModelData(def: ObjectDefinition, type: number, rotation: number): ModelData | undefined {
        let model: ModelData | undefined;
        const isDiagonalObject = type === ObjectType.OBJECT_DIAGIONAL;
        if (isDiagonalObject) {
            type = ObjectType.OBJECT;
        }
        if (!def.objectTypes) {
            if (type !== ObjectType.OBJECT) {
                return undefined;
            }

            if (!def.objectModels) {
                return undefined;
            }

            const isMirrored = def.isRotated;

            const modelCount = def.objectModels.length;

            for (let i = 0; i < modelCount; i++) {
                let modelId = def.objectModels[i];

                model = this.getModelData(modelId, isMirrored);
                if (!model) {
                    return undefined;
                }

                if (modelCount > 1) {
                    ObjectModelLoader.mergeObjectModelsCache[i] = model;
                }
            }

            if (modelCount > 1) {
                model = ModelData.merge(ObjectModelLoader.mergeObjectModelsCache, modelCount);
            }
        } else {
            let index = -1;

            for (let i = 0; i < def.objectTypes.length; i++) {
                if (def.objectTypes[i] === type) {
                    index = i;
                    break;
                }
            }

            if (index === -1) {
                return undefined;
            }

            let modelId = def.objectModels[index];
            const isMirrored = def.isRotated !== rotation > 3;

            model = this.getModelData(modelId, isMirrored);
        }

        if (!model) {
            return undefined;
        }

        const hasResize = def.modelSizeX !== 128 || def.modelSizeHeight !== 128 || def.modelSizeY !== 128;

        const hasOffset = def.offsetX !== 0 || def.offsetHeight !== 0 || def.offsetY !== 0;

        const copy = ModelData.copyFrom(model, true, rotation === 0 && !hasResize && !hasOffset && !isDiagonalObject, !def.recolorFrom, !def.retextureFrom);

        if (type === ObjectType.WALL_DECORATION_INSIDE && rotation > 3) {
            copy.rotate(256);
            copy.translate(45, 0, -45);
        } else if (isDiagonalObject) {
            copy.rotate(256);
        }

        rotation &= 3;
        if (rotation === 1) {
            copy.rotate90();
        } else if (rotation === 2) {
            copy.rotate180();
        } else if (rotation === 3) {
            copy.rotate270();
        }

        if (def.recolorFrom) {
            for (let i = 0; i < def.recolorFrom.length; i++) {
                copy.recolor(def.recolorFrom[i], def.recolorTo[i]);
            }
        }

        if (def.retextureFrom) {
            for (let i = 0; i < def.retextureFrom.length; i++) {
                copy.retexture(def.retextureFrom[i], def.retextureTo[i]);
            }
        }

        if (hasResize) {
            copy.resize(def.modelSizeX, def.modelSizeHeight, def.modelSizeY);
        }

        if (hasOffset) {
            copy.translate(def.offsetX, def.offsetHeight, def.offsetY);
        }

        return copy;
    }

    getObjectModel(def: ObjectDefinition, type: number, rotation: number, contourGroundInfo?: ContourGroundInfo): Model | ModelData | undefined {
        // if (def.animationId !== -1) {
        //     return this.getObjectModelAnimated(def, type, rotation);
        //     // return undefined;
        // }

        let key: number;
        if (def.objectTypes) {
            key = rotation + (type << 3) + (def.id << 10);
        } else {
            key = rotation + (def.id << 10);
        }

        let model = this.modelCache.get(key);
        if (!model) {
            const modelData = this.getObjectModelData(def, type, rotation);
            if (!modelData) {
                return undefined;
            }

            if (!def.mergeNormals) {
                model = modelData.light(def.ambient + 64, def.contrast + 768, -50, -10, -50);
            } else {
                modelData.ambient = def.ambient + 64;
                modelData.contrast = def.contrast + 768;
                modelData.calculateVertexNormals();

                model = modelData;
            }

            this.modelCache.set(key, model);
        }

        if (def.mergeNormals) {
            model = (model as ModelData).copy();
        }

        if (def.contouredGround >= 0 && contourGroundInfo) {
            model = model.contourGround(contourGroundInfo.heightMap, contourGroundInfo.sceneX, contourGroundInfo.sceneHeight, contourGroundInfo.sceneY, true, def.contouredGround);
        }

        return model;
    }

    getObjectModelAnimated(def: ObjectDefinition, type: number, rotation: number, animationId: number, frame: number): Model | undefined {
        let key: number;
        if (def.objectTypes) {
            key = rotation + (type << 3) + (def.id << 10);
        } else {
            key = rotation + (def.id << 10);
        }

        let model = this.modelCache.get(key);
        if (!model) {
            const modelData = this.getObjectModelData(def, type, rotation);
            if (!modelData) {
                return undefined;
            }

            model = modelData.light(def.ambient + 64, def.contrast + 768, -50, -10, -50);

            this.modelCache.set(key, model);
        // } else if (model instanceof Model) {
        //     return model;
        } else if (model instanceof ModelData) {
            throw new Error('Model is not lit');
        }

        if (animationId === -1) {
            return model;
        }

        const anim = this.animationLoader.getDefinition(animationId);
        if (anim) {
            model = this.transformObjectModel(model, anim, frame, rotation);
        }

        // if (def.contouredGround >= 0) {
        //     model = model.contourGround(heightMap, sceneX, sceneHeight, sceneY, true, def.contouredGround);
        // }

        return model;
    }

    transformObjectModel(model: Model, anim: AnimationDefinition, frame: number, rotation: number): Model {
        if (anim.isAnimMaya()) {
            return model;
        }
        if (!anim.frameIds || anim.frameIds.length === 0) {
            return model;
        }
        // frame = Math.round(Math.random() * anim.frameIds.length);
        // if (anim.frameIds.length === 9) {
        //     console.log(anim);
        // }
        frame = anim.frameIds[frame];
        const animFrameMap = this.animationFrameMapLoader.getFrameMap(frame >> 16);
        frame &= 0xFFFF;

        if (animFrameMap) {
            model = Model.copyAnimated(model, !animFrameMap.hasAlphaTransform(frame));

            rotation &= 3;
            if (rotation === 1) {
                model.rotate270();
            } else if (rotation === 2) {
                model.rotate180();
            } else if (rotation === 3) {
                model.rotate90();
            }

            // console.log('animate', !!model.vertexLabels)

            model.animate(animFrameMap.frames[frame]);

            if (rotation === 1) {
                model.rotate90();
            } else if (rotation === 2) {
                model.rotate180();
            } else if (rotation === 3) {
                model.rotate270();
            }
        }

        return model;
    }
}
