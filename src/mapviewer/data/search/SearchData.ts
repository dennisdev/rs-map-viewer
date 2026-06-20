// Unified search data for the teleporter: combines OSRS locations and NPC
// spawns with the transport-graph teleports. Locations ship a tile position;
// NPCs only carry a location *name*, so we resolve each NPC to a position via
// the location index (exact name/alias match, falling back to longest substring
// match on descriptive strings like "Outside the Tower of Life").

export interface LocationEntry {
    name: string;
    region?: string;
    position: { x: number; y: number };
    /** Polygon vertices for locations that cover an area (nil for point locations). */
    polygon?: { x: number; y: number }[];
}

export interface NpcSearchEntry {
    name: string;
    aliases: string[];
    /** Distinct places this NPC name can be found, resolved from all-locations. */
    locations: LocationEntry[];
}

export interface SearchData {
    locations: LocationEntry[];
    npcs: NpcSearchEntry[];
}

interface RawLocation {
    name: string;
    aliases?: string[];
    region?: string;
    position?: { x: number; y: number };
    polygon?: {
        raw?: string;
        vertices?: { x: number; y: number }[];
        centroid?: { x: number; y: number };
    };
}

interface RawNpc {
    name: string;
    aliases?: string[];
    location?: string;
    /** Direct spawn coordinate present on most NPC entries. */
    position?: { x: number; y: number };
}

function isUsableName(name: string): boolean {
    // Drop junk names (e.g. "? ? ? ?") — require >= 2 alphanumerics.
    return name.replace(/[^A-Za-z0-9]/g, "").length >= 2;
}

export function buildSearchData(rawLocs: RawLocation[], rawNpcs: RawNpc[]): SearchData {
    // Exact name/alias index + a longest-name-first list for substring fallback.
    const byKey = new Map<string, LocationEntry>();
    const locsWithPos: LocationEntry[] = [];
    const bySubstring: { lower: string; entry: LocationEntry; len: number }[] = [];

    for (const rl of rawLocs) {
        const polygon = rl.polygon?.vertices?.length ? rl.polygon.vertices : undefined;
        // Skip locations with neither a point position nor a polygon area.
        if (!rl.position && !polygon) {
            continue;
        }
        const position = rl.position ?? rl.polygon!.centroid ?? polygonCentroid(polygon!);
        const entry: LocationEntry = {
            name: rl.name,
            region: rl.region,
            position,
            polygon,
        };
        locsWithPos.push(entry);
        for (const key of [rl.name, ...(rl.aliases ?? [])]) {
            byKey.set(key.toLowerCase(), entry);
        }
        bySubstring.push({ lower: rl.name.toLowerCase(), entry, len: rl.name.length });
    }
    bySubstring.sort((a, b) => b.len - a.len);

    const resolve = (locStr?: string): LocationEntry | undefined => {
        if (!locStr) {
            return undefined;
        }
        const s = locStr.toLowerCase();
        const exact = byKey.get(s);
        if (exact) {
            return exact;
        }
        for (const candidate of bySubstring) {
            // Avoid trivial short matches dominating descriptive strings.
            if (candidate.len >= 4 && s.includes(candidate.lower)) {
                return candidate.entry;
            }
        }
        return undefined;
    };

    // Group NPCs by name, merging aliases and resolved positions.
    const groups = new Map<
        string,
        { name: string; aliases: Set<string>; pos: Map<string, LocationEntry> }
    >();
    for (const rn of rawNpcs) {
        const name = rn.name?.trim();
        if (!name || !isUsableName(name)) {
            continue;
        }
        const key = name.toLowerCase();
        let group = groups.get(key);
        if (!group) {
            group = { name, aliases: new Set(), pos: new Map() };
            groups.set(key, group);
        }
        // Prefer the NPC's direct spawn coordinate when present (most entries
        // carry one); otherwise resolve the location string via the index.
        if (rn.position) {
            const p = rn.position;
            group.pos.set(`${p.x},${p.y}`, {
                name: rn.location?.trim() || name,
                position: p,
            });
        }
        const resolved = resolve(rn.location);
        if (resolved) {
            group.pos.set(`${resolved.position.x},${resolved.position.y}`, resolved);
        }
        for (const alias of rn.aliases ?? []) {
            const trimmed = alias?.trim();
            if (trimmed && isUsableName(trimmed)) {
                group.aliases.add(trimmed);
            }
        }
    }

    const npcs: NpcSearchEntry[] = [];
    for (const group of groups.values()) {
        if (group.pos.size === 0) {
            continue;
        }
        npcs.push({
            name: group.name,
            aliases: [...group.aliases],
            locations: [...group.pos.values()],
        });
    }
    npcs.sort((a, b) => a.name.localeCompare(b.name));
    locsWithPos.sort((a, b) => a.name.localeCompare(b.name));

    return { locations: locsWithPos, npcs };
}

function polygonCentroid(vertices: { x: number; y: number }[]): { x: number; y: number } {
    let sx = 0;
    let sy = 0;
    for (const v of vertices) {
        sx += v.x;
        sy += v.y;
    }
    return { x: sx / vertices.length, y: sy / vertices.length };
}

let cache: Promise<SearchData> | undefined;

/** Lazily load and index the public/ all-locations and all-npcs data sets. */
export function loadSearchData(): Promise<SearchData> {
    if (!cache) {
        const base = import.meta.env.BASE_URL || "/";
        cache = (async () => {
            const [locsResp, npcsResp] = await Promise.all([
                fetch(`${base}all-locations.json`),
                fetch(`${base}all-npcs.json`),
            ]);
            if (!locsResp.ok || !npcsResp.ok) {
                throw new Error("Failed to load search data");
            }
            const [rawLocs, rawNpcs] = (await Promise.all([locsResp.json(), npcsResp.json()])) as [
                RawLocation[],
                RawNpc[],
            ];
            return buildSearchData(rawLocs, rawNpcs);
        })();
    }
    return cache;
}
