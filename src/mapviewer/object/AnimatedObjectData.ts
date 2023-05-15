import { DrawCommand } from "../buffer/RenderBuffer";
import { DrawRange } from "../chunk/DrawRange";
import { AnimatedObjectGroup } from "./AnimatedObjectGroup";
import { AnimatedSceneObject } from "./AnimatedSceneObject";

export type AnimatedObjectData = {
    drawRangeIndex: number;
    drawRangeAlphaIndex: number;

    drawRangeInteractIndex: number;
    drawRangeInteractAlphaIndex: number;

    frames: DrawRange[];
    framesAlpha: DrawRange[] | undefined;

    animationId: number;
    randomStart: boolean;
};

export function createAnimatedObjectDataArray(
    groups: AnimatedObjectGroup[],
    drawCommands: DrawCommand[],
    drawCommandsAlpha: DrawCommand[],
    drawCommandsInteract: DrawCommand[],
    drawCommandsInteractAlpha: DrawCommand[]
): AnimatedObjectData[] {
    const objects: AnimatedObjectData[] = [];

    for (const group of groups) {
        for (const object of group.objects) {
            objects.push(
                createAnimatedObjectData(
                    group,
                    object,
                    drawCommands,
                    drawCommandsAlpha,
                    drawCommandsInteract,
                    drawCommandsInteractAlpha
                )
            );
        }
    }

    return objects;
}

export function createAnimatedObjectData(
    group: AnimatedObjectGroup,
    object: AnimatedSceneObject,
    drawCommands: DrawCommand[],
    drawCommandsAlpha: DrawCommand[],
    drawCommandsInteract: DrawCommand[],
    drawCommandsInteractAlpha: DrawCommand[]
): AnimatedObjectData {
    const drawRangeIndex = drawCommands.length;
    drawCommands.push({
        offset: 0,
        elements: 0,
        datas: [object],
    });

    const drawRangeAlphaIndex = drawCommandsAlpha.length;
    if (group.framesAlpha) {
        drawCommandsAlpha.push({
            offset: 0,
            elements: 0,
            datas: [object],
        });
    }

    const drawRangeInteractIndex = drawCommandsInteract.length;
    drawCommandsInteract.push({
        offset: 0,
        elements: 0,
        datas: [object],
    });

    const drawRangeInteractAlphaIndex = drawCommandsInteractAlpha.length;
    if (group.framesAlpha) {
        drawCommandsInteractAlpha.push({
            offset: 0,
            elements: 0,
            datas: [object],
        });
    }

    return {
        drawRangeIndex,
        drawRangeAlphaIndex,

        drawRangeInteractIndex,
        drawRangeInteractAlphaIndex,

        animationId: group.animationId,
        randomStart: object.animatedObject.randomStartFrame,
        frames: group.frames,
        framesAlpha: group.framesAlpha,
    };
}
