import { AnimationFrames } from "../AnimationFrames";

export type LocAnimatedData = {
    drawRangeIndex: number;
    drawRangeAlphaIndex: number;

    drawRangeLodIndex: number;
    drawRangeLodAlphaIndex: number;

    drawRangeInteractIndex: number;
    drawRangeInteractAlphaIndex: number;

    drawRangeInteractLodIndex: number;
    drawRangeInteractLodAlphaIndex: number;

    anim: AnimationFrames;

    seqId: number;
    randomStart: boolean;
};
