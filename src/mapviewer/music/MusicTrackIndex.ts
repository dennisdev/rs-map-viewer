export interface MusicPolygon {
    raw: string;
    vertices: { x: number; y: number }[];
    centroid: { x: number; y: number };
}

export interface MusicEntry {
    name: string;
    aliases: string[];
    members: boolean;
    number?: number;
    fileName?: string;
    fileUrl?: string;
    cacheId?: number;
    release?: string;
    update?: string;
    location?: string;
    hint?: string;
    quest?: string;
    duration?: string;
    tempo?: string;
    signature?: string;
    composer?: string;
    sortName?: string;
    unlockDetail?: string;
    instruments?: string[];
    polygon?: MusicPolygon;
}

export interface IndexedMusicTrack {
    entry: MusicEntry;
    vertices: { x: number; y: number }[];
}

export class MusicTrackIndex {
    readonly all: MusicEntry[];
    readonly spatial: IndexedMusicTrack[];
    private readonly byCacheId: Map<number, MusicEntry>;

    constructor(all: MusicEntry[]) {
        this.all = all;
        this.spatial = all
            .filter((e) => e.polygon)
            .filter((e) => !isEventTrack(e))
            .map((entry) => ({
                entry,
                vertices: getPolygonVertices(entry.polygon!),
            }))
            .filter((s) => s.vertices.length >= 3);
        this.byCacheId = new Map();
        for (const e of all) {
            if (typeof e.cacheId === "number") {
                this.byCacheId.set(e.cacheId, e);
            }
        }
    }

    static async load(url: string = "/all-music.json"): Promise<MusicTrackIndex> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to load music index: ${response.status} ${response.statusText}`,
            );
        }
        const data = (await response.json()) as MusicEntry[];
        return new MusicTrackIndex(data);
    }

    getByCacheId(cacheId: number): MusicEntry | undefined {
        return this.byCacheId.get(cacheId);
    }

    findTrackAt(x: number, y: number): MusicEntry | undefined {
        for (const { entry, vertices } of this.spatial) {
            if (pointInPolygon(x, y, vertices)) {
                return entry;
            }
        }
        return undefined;
    }

    findTracksAt(x: number, y: number): MusicEntry[] {
        const out: MusicEntry[] = [];
        for (const { entry, vertices } of this.spatial) {
            if (pointInPolygon(x, y, vertices)) {
                out.push(entry);
            }
        }
        return out;
    }

    search(query: string, limit: number = 50): MusicEntry[] {
        const q = query.trim().toLowerCase();
        if (!q) {
            return this.all.slice(0, limit);
        }
        const out: MusicEntry[] = [];
        for (const entry of this.all) {
            if (matchesEntry(entry, q)) {
                out.push(entry);
                if (out.length >= limit) {
                    break;
                }
            }
        }
        return out;
    }
}

export function isEventTrack(entry: MusicEntry): boolean {
    const hint = entry.hint?.toLowerCase() ?? "";
    const location = entry.location?.toLowerCase() ?? "";
    const mentionsEvent = hint.includes("event") || location.includes("event");
    const mentionsRandomEvent = hint.includes("random event") || location.includes("random event");
    return mentionsEvent && !mentionsRandomEvent;
}

export function getPolygonVertices(polygon: MusicPolygon): { x: number; y: number }[] {
    if (polygon.raw) {
        const parts = polygon.raw.split(",");
        if (parts.length >= 6 && parts.length % 2 === 0) {
            const vertices: { x: number; y: number }[] = [];
            for (let i = 0; i < parts.length; i += 2) {
                const x = Number.parseFloat(parts[i]);
                const y = Number.parseFloat(parts[i + 1]);
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    vertices.push({ x, y });
                }
            }
            if (vertices.length >= 3) {
                return vertices;
            }
        }
    }
    return polygon.vertices ?? [];
}

function matchesEntry(entry: MusicEntry, query: string): boolean {
    if (entry.name.toLowerCase().includes(query)) {
        return true;
    }
    if (entry.sortName && entry.sortName.toLowerCase().includes(query)) {
        return true;
    }
    if (entry.location && entry.location.toLowerCase().includes(query)) {
        return true;
    }
    if (entry.composer && entry.composer.toLowerCase().includes(query)) {
        return true;
    }
    for (const alias of entry.aliases) {
        if (alias.toLowerCase().includes(query)) {
            return true;
        }
    }
    return false;
}

export function pointInPolygon(
    x: number,
    y: number,
    vertices: { x: number; y: number }[],
): boolean {
    const n = vertices.length;
    if (n < 3) {
        return false;
    }
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = vertices[i].x;
        const yi = vertices[i].y;
        const xj = vertices[j].x;
        const yj = vertices[j].y;
        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) {
            inside = !inside;
        }
    }
    return inside;
}
