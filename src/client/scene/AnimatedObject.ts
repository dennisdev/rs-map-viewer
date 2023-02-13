import { Renderable } from "./Renderable";
import { SceneObject } from "./Scene";

export class AnimatedObject extends Renderable {
    offsetX: number = 0;
    offsetY: number = 0;

    sceneObject?: SceneObject;

    constructor(
        public id: number,
        public type: number,
        public rotation: number,
        public plane: number,
        public tileX: number,
        public tileY: number,
        public animationId: number,
        public randomAnimStartFrame: boolean,
    ) {
        super();
    }
}
