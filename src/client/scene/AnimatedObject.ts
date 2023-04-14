import { Renderable } from "./Renderable";

export class AnimatedObject extends Renderable {
    offsetX: number = 0;
    offsetY: number = 0;

    constructor(
        public id: number,
        public type: number,
        public rotation: number,
        public plane: number,
        public tileX: number,
        public tileY: number,
        public animationId: number,
        public randomStartFrame: boolean,
    ) {
        super();
    }
}
