export type NpcSpawn = {
    id: number,
    x: number,
    y: number,
    p: number,
    size: number,
};

export async function fetchNpcSpawns(): Promise<NpcSpawn[]> {
    const response = await fetch('/NPCList_OSRS-min.json');
    return await response.json();
}
