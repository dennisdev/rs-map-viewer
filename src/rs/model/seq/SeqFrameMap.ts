import { SeqFrame } from "./SeqFrame";

export class SeqFrameMap {
    constructor(readonly frames: SeqFrame[]) {}

    hasAlphaTransform(frame: number) {
        return this.frames[frame].hasAlphaTransform;
    }
}
