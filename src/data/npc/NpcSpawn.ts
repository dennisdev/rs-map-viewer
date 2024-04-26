import { CacheInfo } from "../../rs/cache/CacheInfo";
import npcSpawns2004Url from "./npc-spawns-2004.json?url";
import npcSpawns2009Url from "./npc-spawns-2009.json?url";
import npcSpawnsOsrsUrl from "./npc-spawns-osrs.json?url";

export interface NpcSpawn {
    id: number;
    name?: string;
    x: number;
    y: number;
    level: number;
}

export function getNpcSpawnsUrl(cacheInfo: CacheInfo): string {
    if (cacheInfo.game === "oldschool") {
        return npcSpawnsOsrsUrl;
    } else if (cacheInfo.revision > 474) {
        return npcSpawns2009Url;
    } else {
        return npcSpawns2004Url;
    }
}

export async function fetchNpcSpawns(url: string): Promise<NpcSpawn[]> {
    const response = await fetch(url);
    return await response.json();
}

export function fetchOsrsNpcSpawns(): Promise<NpcSpawn[]> {
    return fetchNpcSpawns(npcSpawnsOsrsUrl);
}

export function fetchLegacyNpcSpawns(): Promise<NpcSpawn[]> {
    return fetchNpcSpawns(npcSpawns2004Url);
}

export function getMapNpcSpawns(
    spawns: NpcSpawn[],
    maxLevel: number,
    mapX: number,
    mapY: number,
): NpcSpawn[] {
    return spawns.filter((obj) => {
        const npcMapX = (obj.x / 64) | 0;
        const npcMapY = (obj.y / 64) | 0;
        return mapX === npcMapX && mapY === npcMapY && obj.level <= maxLevel;
    });
}
