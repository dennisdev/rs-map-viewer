import { NpcSpawn } from "../../../mapviewer/data/npc/NpcSpawn";
import { AnimationFrames } from "../AnimationFrames";
import { NpcSpawnGroup } from "./NpcSpawnGroup";

export type NpcData = {
    id: number;
    tileX: number;
    tileY: number;
    level: number;
    idleAnim: AnimationFrames;
    walkAnim: AnimationFrames | undefined;
};

export function createNpcDatas(groups: NpcSpawnGroup[]): NpcData[] {
    const npcs: NpcData[] = [];

    for (const group of groups) {
        for (const spawn of group.spawns) {
            npcs.push(createNpcData(group, spawn));
        }
    }

    return npcs;
}

export function createNpcData(group: NpcSpawnGroup, spawn: NpcSpawn): NpcData {
    const tileX = spawn.x % 64;
    const tileY = spawn.y % 64;
    const level = spawn.level;
    return {
        id: spawn.id,
        tileX,
        tileY,
        level,
        idleAnim: group.idleAnim,
        walkAnim: group.walkAnim,
    };
}
