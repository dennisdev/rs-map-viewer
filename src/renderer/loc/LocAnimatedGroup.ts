import { AnimationFrames } from "../AnimationFrames";
import { SceneLocEntity } from "./SceneLocEntity";

export type LocAnimatedGroup = {
    anim: AnimationFrames;
    locs: SceneLocEntity[];
};
