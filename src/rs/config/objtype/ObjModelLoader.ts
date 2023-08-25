import { Model } from "../../model/Model";
import { ModelLoader } from "../../model/ModelLoader";
import { TextureLoader } from "../../texture/TextureLoader";
import { ObjTypeLoader } from "./ObjTypeLoader";

export class ObjModelLoader {
    modelCache: Map<number, Model>;

    constructor(
        readonly objTypeLoader: ObjTypeLoader,
        readonly modelLoader: ModelLoader,
        readonly textureLoader: TextureLoader,
    ) {
        this.objTypeLoader = objTypeLoader;
        this.modelLoader = modelLoader;
        this.textureLoader = textureLoader;
        this.modelCache = new Map();
    }

    getModel(id: number, count: number): Model | undefined {
        if (id === -1) {
            return undefined;
        }

        const objType = this.objTypeLoader.load(id);
        if (objType.model === undefined) {
            return undefined;
        }
        if (objType.countObj && count > 1) {
            let countId = -1;
            for (let i = 0; i < 10; i++) {
                if (count >= objType.countCo[i] && objType.countCo[i] !== 0) {
                    countId = objType.countObj[i];
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

        const modelData = this.modelLoader.getModel(objType.model);
        if (!modelData) {
            return undefined;
        }

        if (objType.resizeX !== 128 || objType.resizeY !== 128 || objType.resizeZ !== 128) {
            modelData.resize(objType.resizeX, objType.resizeY, objType.resizeZ);
        }

        if (objType.recolorFrom) {
            const retexture =
                objType.cacheInfo.game === "runescape" && objType.cacheInfo.revision <= 377;
            for (let i = 0; i < objType.recolorFrom.length; i++) {
                modelData.recolor(objType.recolorFrom[i], objType.recolorTo[i]);
                if (retexture) {
                    modelData.retexture(objType.recolorFrom[i], objType.recolorTo[i]);
                }
            }
        }

        if (objType.retextureFrom) {
            for (let i = 0; i < objType.retextureFrom.length; i++) {
                modelData.retexture(objType.retextureFrom[i], objType.retextureTo[i]);
            }
        }

        model = modelData.light(
            this.textureLoader,
            objType.ambient + 64,
            objType.contrast + 768,
            -50,
            -10,
            -50,
        );
        this.modelCache.set(id, model);
        return model;
    }

    clearCache() {
        this.modelCache.clear();
    }
}
