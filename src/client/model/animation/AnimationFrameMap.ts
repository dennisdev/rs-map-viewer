import { AnimationFrame } from "./AnimationFrame";

export class AnimationFrameMap {
    constructor(public frames: AnimationFrame[]) {}

    hasAlphaTransform(frame: number) {
        return this.frames[frame].hasAlphaTransform;
    }
}
