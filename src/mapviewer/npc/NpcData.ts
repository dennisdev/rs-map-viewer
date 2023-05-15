import { AnimationFrames } from "../chunk/AnimationFrames";
import { NpcSpawn } from "./NpcSpawn";
import { NpcSpawnGroup } from "./NpcSpawnGroup";

export type NpcData = {
    id: number;
    tileX: number;
    tileY: number;
    plane: number;
    idleAnim: AnimationFrames;
    walkAnim: AnimationFrames | undefined;
};

export function createNpcDataArray(groups: NpcSpawnGroup[]): NpcData[] {
    const npcs: NpcData[] = [];

    for (const group of groups) {
        for (const spawn of group.npcSpawns) {
            npcs.push(createNpcData(group, spawn));
        }
    }

    return npcs;
}

export function createNpcData(group: NpcSpawnGroup, spawn: NpcSpawn): NpcData {
    const tileX = spawn.x % 64;
    const tileY = spawn.y % 64;
    const plane = spawn.p;
    return {
        id: spawn.id,
        tileX,
        tileY,
        plane,
        idleAnim: group.idleAnim,
        walkAnim: group.walkAnim,
    };
}
