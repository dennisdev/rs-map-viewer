import { ObjectDefinition } from "../fs/definition/ObjectDefinition";
import { Renderable } from "./Renderable";

export interface SceneObject {
    def: ObjectDefinition;
    type: number;
    sceneX: number;
    sceneY: number;
    sceneHeight: number;
    tag: bigint;
}

export class FloorDecoration implements SceneObject {
    constructor(
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public renderable: Renderable,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition
    ) {}
}

export class WallObject implements SceneObject {
    constructor(
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public renderable0: Renderable | undefined,
        public renderable1: Renderable | undefined,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition
    ) {}
}

export class WallDecoration implements SceneObject {
    constructor(
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public renderable0: Renderable,
        public renderable1: Renderable | undefined,
        public offsetX: number,
        public offsetY: number,
        public tag: bigint,
        public type: number,
        public def: ObjectDefinition
    ) {}
}

export class GameObject implements SceneObject {
    constructor(
        public plane: number,
        public sceneX: number,
        public sceneY: number,
        public sceneHeight: number,
        public renderable: Renderable,
        public startX: number,
        public startY: number,
        public endX: number,
        public endY: number,
        public tag: bigint,
        public flags: number,
        public type: number,
        public def: ObjectDefinition
    ) {}
}
