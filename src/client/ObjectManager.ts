import { Archive } from "./fs/Archive";
import { ObjectDefinition } from "./fs/definition/ObjectDefinition";
import { Model } from "./model/Model";
import { ModelData } from "./model/ModelData";
import { Renderable } from "./scene/Renderable";

export class ObjectManager {
    private readonly archive: Archive;

    // TODO: Use jagex collections
    private definitionCache: Map<number, ObjectDefinition>;

    modelDataCache: Map<number, ModelData>;

    modelTypeCache: Map<number, ModelData | Model>;

    modelCache: Map<number, Model>;

    // This shared array is used for combining the object models to minimize allocations
    objectModels: ModelData[];

    constructor(archive: Archive) {
        this.archive = archive;
        this.definitionCache = new Map();
        this.modelDataCache = new Map();
        this.modelTypeCache = new Map();
        this.modelCache = new Map();
        this.objectModels = [];
    }
}
