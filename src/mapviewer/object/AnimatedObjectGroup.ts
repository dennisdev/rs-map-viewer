import { RegionLoader } from "../../client/RegionLoader";
import { ObjectDefinition } from "../../client/fs/definition/ObjectDefinition";
import { TextureLoader } from "../../client/fs/loader/TextureLoader";
import { ObjectModelLoader } from "../../client/fs/loader/model/ObjectModelLoader";
import { RenderBuffer, addModelAnimFrame } from "../buffer/RenderBuffer";
import { DrawRange } from "../chunk/DrawRange";
import { AnimatedSceneObject } from "./AnimatedSceneObject";

export type AnimatedObjectGroup = {
    animationId: number;
    frames: DrawRange[];
    framesAlpha: DrawRange[] | undefined;
    objects: AnimatedSceneObject[];
};

function getAnimatedModelKey(
    id: number,
    type: number,
    rotation: number,
    animationId: number
): bigint {
    // BigInt(tileX & 0x7F) | BigInt(tileY & 0x7F) << 7n | BigInt(entityType & 3) << 14n | BigInt(id) << 17n;
    return (
        BigInt(id) |
        (BigInt(type) << 16n) |
        (BigInt(rotation) << 21n) |
        (BigInt(animationId) << 24n)
    );
}

export function createAnimatedObjectGroups(
    regionLoader: RegionLoader,
    objectModelLoader: ObjectModelLoader,
    textureLoader: TextureLoader,
    renderBuf: RenderBuffer,
    animatedObjects: AnimatedSceneObject[]
): AnimatedObjectGroup[] {
    const uniqueObjectsMap: Map<bigint, AnimatedSceneObject[]> = new Map();

    for (const object of animatedObjects) {
        const animatedObject = object.animatedObject;
        const key = getAnimatedModelKey(
            animatedObject.id,
            animatedObject.type,
            animatedObject.rotation,
            animatedObject.animationId
        );

        const uniqueObjects = uniqueObjectsMap.get(key);
        if (uniqueObjects) {
            uniqueObjects.push(object);
        } else {
            uniqueObjectsMap.set(key, [object]);
        }
    }

    const groups: AnimatedObjectGroup[] = [];
    for (const objects of uniqueObjectsMap.values()) {
        const { animatedObject, sceneObject } = objects[0];

        const animDef = objectModelLoader.animationLoader.getDefinition(
            animatedObject.animationId
        );
        if (!animDef.frameIds) {
            continue;
        }

        let defTransform: ObjectDefinition | undefined = sceneObject.def;
        if (sceneObject.def.transforms) {
            defTransform = defTransform.transform(
                regionLoader.varpManager,
                regionLoader.objectLoader
            );
        }
        if (!defTransform) {
            continue;
        }
        const frames: DrawRange[] = [];
        let framesAlpha: DrawRange[] = [];
        let alphaFrameCount = 0;
        for (let i = 0; i < animDef.frameIds.length; i++) {
            const model = objectModelLoader.getObjectModelAnimated(
                defTransform,
                animatedObject.type,
                animatedObject.rotation,
                animatedObject.animationId,
                i
            );
            if (model) {
                frames.push(
                    addModelAnimFrame(textureLoader, renderBuf, model, false)
                );
                const alphaFrame = addModelAnimFrame(
                    textureLoader,
                    renderBuf,
                    model,
                    true
                );
                if (alphaFrame[1] > 0) {
                    alphaFrameCount++;
                }
                framesAlpha.push(alphaFrame);
            }
        }
        if (frames.length > 0) {
            groups.push({
                animationId: animatedObject.animationId,
                frames,
                framesAlpha: alphaFrameCount > 0 ? framesAlpha : undefined,
                objects: objects,
            });
        }
    }

    return groups;
}
