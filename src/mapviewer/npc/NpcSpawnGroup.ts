import { NpcDefinition } from "../../client/fs/definition/NpcDefinition";
import { TextureLoader } from "../../client/fs/loader/TextureLoader";
import { NpcModelLoader } from "../../client/fs/loader/model/NpcModelLoader";
import { RenderBuffer, addModelAnimFrame } from "../buffer/RenderBuffer";
import { AnimationFrames } from "../chunk/AnimationFrames";
import { DrawRange } from "../chunk/DrawRange";
import { NpcSpawn } from "./NpcSpawn";

export type NpcSpawnGroup = {
    idleAnim: AnimationFrames;
    walkAnim: AnimationFrames | undefined;
    npcSpawns: NpcSpawn[];
};

export function addNpcAnimationFrames(
    npcModelLoader: NpcModelLoader,
    textureLoader: TextureLoader,
    renderBuf: RenderBuffer,
    def: NpcDefinition,
    animationId: number
): AnimationFrames | undefined {
    if (animationId === -1) {
        return undefined;
    }

    const animDef = npcModelLoader.animationLoader.getDefinition(animationId);
    if (!animDef.frameIds) {
        return undefined;
    }

    const frames: DrawRange[] = [];
    const framesAlpha: DrawRange[] = [];
    let alphaFrameCount = 0;
    for (let i = 0; i < animDef.frameIds.length; i++) {
        const model = npcModelLoader.getModel(def, animationId, i);
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
        } else {
            frames.push([0, 0, 0]);
        }
    }

    if (frames.length === 0) {
        return undefined;
    }

    return {
        frames,
        framesAlpha: alphaFrameCount > 0 ? framesAlpha : undefined,
    };
}

export function createNpcSpawnGroups(
    npcModelLoader: NpcModelLoader,
    textureLoader: TextureLoader,
    renderBuf: RenderBuffer,
    npcs: NpcSpawn[]
): NpcSpawnGroup[] {
    const idNpcSpawnsMap: Map<number, NpcSpawn[]> = new Map();

    for (const spawn of npcs) {
        const spawns = idNpcSpawnsMap.get(spawn.id);
        if (spawns) {
            spawns.push(spawn);
        } else {
            idNpcSpawnsMap.set(spawn.id, [spawn]);
        }
    }

    const groups: NpcSpawnGroup[] = [];
    for (const spawns of idNpcSpawnsMap.values()) {
        const def = npcModelLoader.npcLoader.getDefinition(spawns[0].id);

        const idleAnim = addNpcAnimationFrames(
            npcModelLoader,
            textureLoader,
            renderBuf,
            def,
            def.idleSequence
        );
        const walkAnim =
            def.idleSequence !== def.walkSequence
                ? addNpcAnimationFrames(
                      npcModelLoader,
                      textureLoader,
                      renderBuf,
                      def,
                      def.walkSequence
                  )
                : idleAnim;

        if (idleAnim) {
            // console.log(def, def.transform(npcModelLoader.varpManager, npcModelLoader.npcLoader), idleAnim);
            groups.push({
                idleAnim,
                walkAnim,
                npcSpawns: spawns,
            });
        }
    }
    return groups;
}
