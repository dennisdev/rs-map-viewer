import { AnimationDefinition } from "../../client/fs/definition/AnimationDefinition";

export class AnimatedObject {
    drawRangeIndex: number;
    drawRangeAlphaIndex: number;

    drawRangeInteractIndex: number;
    drawRangeInteractAlphaIndex: number;

    frames: number[][];
    framesAlpha: number[][] | undefined;

    animationDef?: AnimationDefinition;

    frame: number = 0;

    cycleStart: number = 0;

    constructor(
        drawRangeIndex: number,
        drawRangeAlphaIndex: number,
        drawRangeInteractIndex: number,
        drawRangeInteractAlphaIndex: number,
        frames: number[][],
        framesAlpha: number[][] | undefined,
        animationDef: AnimationDefinition,
        cycle: number,
        randomStart: boolean
    ) {
        this.drawRangeIndex = drawRangeIndex;
        this.drawRangeAlphaIndex = drawRangeAlphaIndex;
        this.drawRangeInteractIndex = drawRangeInteractIndex;
        this.drawRangeInteractAlphaIndex = drawRangeInteractAlphaIndex;
        this.frames = frames;
        this.framesAlpha = framesAlpha;
        this.animationDef = animationDef;
        this.cycleStart = cycle - 1;

        if (randomStart && animationDef.frameStep !== -1) {
            this.frame = Math.floor(
                Math.random() * animationDef.frameIds.length
            );
            this.cycleStart -= Math.floor(
                Math.random() * animationDef.frameLengths[this.frame]
            );
        }
    }

    update(cycle: number): number {
        if (!this.animationDef) {
            return 0;
        }

        let elapsed = cycle - this.cycleStart;
        if (elapsed > 100 && this.animationDef.frameStep > 0) {
            elapsed = 100;
        }

        while (elapsed > this.animationDef.frameLengths[this.frame]) {
            elapsed -= this.animationDef.frameLengths[this.frame];
            this.frame++;
            if (this.frame >= this.animationDef.frameLengths.length) {
                this.frame -= this.animationDef.frameStep;
                if (
                    this.frame < 0 ||
                    this.frame >= this.animationDef.frameLengths.length
                ) {
                    this.frame = 0;
                    this.cycleStart = cycle - 1;
                    this.animationDef = undefined;
                    return 0;
                }
                continue;
            }
        }

        this.cycleStart = cycle - elapsed;
        return this.frame;
    }
}
