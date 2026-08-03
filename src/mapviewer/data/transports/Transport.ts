// Transport graph built from the Skretzo/shortest-path TSV data set.
// Format reference: docs/Transport-TSV-format.md
//
// Each TSV row is a directed edge from Origin -> Destination. Rows are
// header-driven (column order is irrelevant; fields are mapped by header text).
// Some files use a "permutation" layout (empty Origin or empty Destination)
// which we expand lazily: an origin row (Origin set, Destination empty) pairs
// with every destination row (Destination set, Origin empty) in the same file.

export interface Tile3 {
    x: number;
    y: number;
    plane: number;
}

export interface TransportEdge {
    origin: Tile3;
    destination: Tile3;
    objectId: number | undefined;
    menuOption: string | undefined;
    menuTarget: string | undefined;
    displayInfo: string | undefined;
    category: string;
}

interface RawRow {
    origin?: Tile3;
    destination?: Tile3;
    objectId?: number;
    menuOption?: string;
    menuTarget?: string;
    displayInfo?: string;
}

interface TransportFile {
    name: string;
    threshold: number;
    concrete: RawRow[];
    origins: RawRow[];
    dests: RawRow[];
    // object-id indexes for O(1) lookup (lookupByObject runs every frame).
    concreteByObject: Map<number, RawRow[]>;
    originsByObject: Map<number, RawRow[]>;
}

// Per-type proximity thresholds (in tiles). Origin/destination pairs closer
// than this are dropped during permutation expansion (mirrors shortest-path).
const PERM_THRESHOLDS: Record<string, number> = {
    gnome_gliders: 6,
    hot_air_balloons: 7,
    magic_mushtrees: 5,
    spirit_trees: 5,
};

function prettyCategory(fileName: string): string {
    return fileName
        .replace(/\.tsv$/, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseTile(raw: string | undefined): Tile3 | undefined {
    if (!raw) {
        return undefined;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
        return undefined;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) {
        return undefined;
    }
    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    const plane = parseInt(parts[2], 10);
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(plane)) {
        return undefined;
    }
    return { x, y, plane };
}

// The "menuOption menuTarget objectID" column packs three values into one
// tab field, e.g. "Travel Spirit-tree 8355" or "Open Door 9398". The trailing
// token is the numeric object id when present.
function parseMenuField(raw: string | undefined): {
    menuOption?: string;
    menuTarget?: string;
    objectId?: number;
} {
    if (!raw) {
        return {};
    }
    const trimmed = raw.trim();
    if (!trimmed) {
        return {};
    }
    const tokens = trimmed.split(/\s+/);
    const last = tokens[tokens.length - 1];
    if (/^\d+$/.test(last)) {
        return {
            objectId: parseInt(last, 10),
            menuOption: tokens[0],
            menuTarget: tokens.slice(1, -1).join(" ") || undefined,
        };
    }
    return {
        menuOption: tokens[0],
        menuTarget: tokens.slice(1).join(" ") || undefined,
    };
}

function parseHeader(line: string): Map<string, number> {
    const cleaned = line.replace(/^#\s?/, "");
    const cols = cleaned.split("\t");
    const map = new Map<string, number>();
    cols.forEach((col, index) => {
        const key = col.trim().toLowerCase();
        if (key) {
            map.set(key, index);
        }
    });
    return map;
}

enum Col {
    ORIGIN,
    DEST,
    MENU,
    DISPLAY,
}

function resolveColumns(header: Map<string, number>): Map<Col, number> {
    const out = new Map<Col, number>();
    for (const [key, index] of header) {
        if (key === "origin") {
            out.set(Col.ORIGIN, index);
        } else if (key === "destination") {
            out.set(Col.DEST, index);
        } else if (key.startsWith("menuoption")) {
            out.set(Col.MENU, index);
        } else if (key === "display info") {
            out.set(Col.DISPLAY, index);
        }
    }
    return out;
}

function parseFile(name: string, content: string): TransportFile {
    const lines = content.split(/\r?\n/);

    let headerIndex = -1;
    let header: Map<string, number> | undefined;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) {
            continue;
        }
        // The first non-blank line is the header (with or without a leading #).
        if (line.includes("\t") || line.startsWith("#")) {
            header = parseHeader(line);
            if (header.has("origin") || header.has("destination")) {
                headerIndex = i;
                break;
            }
        }
    }

    const file: TransportFile = {
        name: prettyCategory(name),
        threshold: PERM_THRESHOLDS[name.replace(/\.tsv$/, "")] ?? 0,
        concrete: [],
        origins: [],
        dests: [],
        concreteByObject: new Map(),
        originsByObject: new Map(),
    };
    if (!header || headerIndex < 0) {
        return file;
    }

    const cols = resolveColumns(header);
    const originIdx = cols.get(Col.ORIGIN);
    const destIdx = cols.get(Col.DEST);
    const menuIdx = cols.get(Col.MENU);
    const displayIdx = cols.get(Col.DISPLAY);

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) {
            continue;
        }
        if (line.startsWith("#")) {
            continue;
        }
        const fields = line.split("\t");

        const row: RawRow = {};
        if (originIdx !== undefined) {
            row.origin = parseTile(fields[originIdx]);
        }
        if (destIdx !== undefined) {
            row.destination = parseTile(fields[destIdx]);
        }
        if (menuIdx !== undefined) {
            const menu = parseMenuField(fields[menuIdx]);
            row.menuOption = menu.menuOption;
            row.menuTarget = menu.menuTarget;
            row.objectId = menu.objectId;
        }
        if (displayIdx !== undefined) {
            const display = fields[displayIdx]?.trim();
            row.displayInfo = display ? display : undefined;
        }

        const hasOrigin = !!row.origin;
        const hasDest = !!row.destination;

        if (hasOrigin && hasDest) {
            file.concrete.push(row);
            indexByObject(file.concreteByObject, row);
        } else if (hasOrigin) {
            file.origins.push(row);
            indexByObject(file.originsByObject, row);
        } else if (hasDest) {
            file.dests.push(row);
        }
    }

    return file;
}

function indexByObject(map: Map<number, RawRow[]>, row: RawRow): void {
    if (row.objectId === undefined) {
        return;
    }
    const list = map.get(row.objectId);
    if (list) {
        list.push(row);
    } else {
        map.set(row.objectId, [row]);
    }
}

function sameTile(a: Tile3, b: Tile3): boolean {
    return a.x === b.x && a.y === b.y && a.plane === b.plane;
}

function withinThreshold(a: Tile3, b: Tile3, threshold: number): boolean {
    if (a.plane !== b.plane) {
        return false;
    }
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy <= threshold * threshold;
}

function toEdge(
    row: RawRow,
    destination: Tile3,
    displayInfo: string | undefined,
    category: string,
): TransportEdge {
    return {
        origin: row.origin!,
        destination,
        objectId: row.objectId,
        menuOption: row.menuOption,
        menuTarget: row.menuTarget,
        displayInfo: displayInfo ?? row.displayInfo,
        category,
    };
}

function edgeLabel(edge: TransportEdge): string {
    if (edge.displayInfo && edge.displayInfo.trim()) {
        return edge.displayInfo;
    }
    if (edge.menuTarget) {
        return edge.menuTarget;
    }
    return `(${edge.destination.x}, ${edge.destination.y})`;
}

export interface PanelTeleport {
    destination: Tile3;
    displayInfo: string;
    category: string;
}

export interface TransportChoice {
    label: string;
    /**
     * The landing tiles this choice represents. Most choices have exactly one,
     * but a multi-tile object whose edges land in the same area (e.g. the
     * Scorpia cavern entrance) is clustered into a single choice carrying all of
     * them; {@link pickChoiceDestination} selects one at random when used.
     */
    destinations: Tile3[];
}

// Destinations within this radius (in tiles, same plane) are treated as the same
// place and collapsed into one menu option.
const CHOICE_CLUSTER_RADIUS = 25;
const CHOICE_CLUSTER_RADIUS_SQ = CHOICE_CLUSTER_RADIUS * CHOICE_CLUSTER_RADIUS;

function destKey(tile: Tile3): string {
    return `${tile.x},${tile.y},${tile.plane}`;
}

function withinClusterRadius(a: Tile3, b: Tile3): boolean {
    if (a.plane !== b.plane) {
        return false;
    }
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy <= CHOICE_CLUSTER_RADIUS_SQ;
}

/**
 * Pick a random landing tile for a choice (used at click time so clustered
 * equivalents resolve nondeterministically, OSRS-style).
 */
export function pickChoiceDestination(choice: { destinations: Tile3[] }): Tile3 {
    const list = choice.destinations;
    return list[Math.floor(Math.random() * list.length)];
}

/**
 * Collapse transport edges into the distinct places you can go.
 *
 *  1. Edges landing on the same tile (same teleport result) are merged.
 *  2. Remaining destinations within {@link CHOICE_CLUSTER_RADIUS} tiles of each
 *     other (and on the same plane) are clustered into a single option — e.g.
 *     the Scorpia cavern entrance lands on several nearby in-cavern tiles that
 *     all read "Cavern", so they become one "Cavern" option.
 *  3. Labels that still collide (two genuinely separate places sharing a name)
 *     get an "(x, y)" suffix.
 *
 * Clustering is transitive: A–B and B–C within range chain together even if
 * A–C is farther apart.
 */
export function buildTransportChoices(edges: TransportEdge[]): TransportChoice[] {
    // 1. Dedupe by exact destination tile.
    const byDest = new Map<string, TransportEdge>();
    for (const edge of edges) {
        const key = destKey(edge.destination);
        if (!byDest.has(key)) {
            byDest.set(key, edge);
        }
    }
    const unique = Array.from(byDest.values());

    // 2. Greedy transitive clustering by proximity.
    const clusters: TransportEdge[][] = [];
    for (const edge of unique) {
        let placed = false;
        for (const cluster of clusters) {
            if (cluster.some((e) => withinClusterRadius(e.destination, edge.destination))) {
                cluster.push(edge);
                placed = true;
                break;
            }
        }
        if (!placed) {
            clusters.push([edge]);
        }
    }

    // 3. One choice per cluster; the label is the most common edge label in it.
    const choices: TransportChoice[] = clusters.map((cluster) => ({
        label: pickClusterLabel(cluster),
        destinations: cluster.map((e) => e.destination),
    }));

    // 4. Disambiguate labels shared by more than one cluster with coordinates.
    const counts = new Map<string, number>();
    for (const c of choices) {
        counts.set(c.label, (counts.get(c.label) ?? 0) + 1);
    }
    for (const c of choices) {
        if ((counts.get(c.label) ?? 0) > 1) {
            const d = c.destinations[0];
            c.label = `${c.label} (${d.x}, ${d.y})`;
        }
    }

    choices.sort((a, b) => a.label.localeCompare(b.label));
    return choices;
}

function pickClusterLabel(cluster: TransportEdge[]): string {
    const counts = new Map<string, number>();
    let best = "";
    let bestCount = 0;
    for (const edge of cluster) {
        const label = edgeLabel(edge);
        const count = (counts.get(label) ?? 0) + 1;
        counts.set(label, count);
        if (count > bestCount) {
            best = label;
            bestCount = count;
        }
    }
    return best;
}

export class TransportIndex {
    private files: TransportFile[];

    private constructor(files: TransportFile[]) {
        this.files = files;
    }

    static fromSources(sources: { name: string; content: string }[]): TransportIndex {
        return new TransportIndex(sources.map((s) => parseFile(s.name, s.content)));
    }

    /**
     * Look up transport edges leaving a clicked object. Matches by object id
     * and narrows origins to the given map square (so a network object such as
     * a fairy ring resolves to the specific ring the user clicked).
     */
    lookupByObject(objectId: number, mapX: number, mapY: number): TransportEdge[] {
        const results: TransportEdge[] = [];
        const seen = new Set<string>();

        for (const file of this.files) {
            // Concrete origin -> destination edges.
            const concrete = file.concreteByObject.get(objectId);
            if (concrete) {
                for (const row of concrete) {
                    if (!row.origin || !row.destination) {
                        continue;
                    }
                    if (!this.inSquare(row.origin, mapX, mapY)) {
                        continue;
                    }
                    const key = this.dedupeKey(row.destination, row.displayInfo);
                    if (seen.has(key)) {
                        continue;
                    }
                    seen.add(key);
                    results.push(toEdge(row, row.destination, row.displayInfo, file.name));
                }
            }

            // Permutation expansion: origin rows (this object) paired with the
            // file's shared destination rows.
            const activeOrigins = file.originsByObject.get(objectId);
            if (activeOrigins && activeOrigins.length > 0 && file.dests.length > 0) {
                for (const origin of activeOrigins) {
                    if (!origin.origin || !this.inSquare(origin.origin, mapX, mapY)) {
                        continue;
                    }
                    for (const dest of file.dests) {
                        if (!dest.destination) {
                            continue;
                        }
                        if (
                            withinThreshold(origin.origin, dest.destination, file.threshold) ||
                            sameTile(origin.origin, dest.destination)
                        ) {
                            continue;
                        }
                        const key = this.dedupeKey(dest.destination, dest.displayInfo);
                        if (seen.has(key)) {
                            continue;
                        }
                        seen.add(key);
                        results.push(toEdge(origin, dest.destination, dest.displayInfo, file.name));
                    }
                }
            }
        }

        return results;
    }

    /**
     * All "free" teleports (usable from anywhere): the shared destination rows
     * of every file (teleport spells, jewellery, item teleports, fairy-ring
     * targets, obelisk targets, ...), grouped for a searchable panel.
     */
    getPanelTeleports(): PanelTeleport[] {
        const out: PanelTeleport[] = [];
        const seen = new Set<string>();
        for (const file of this.files) {
            // Files whose destination rows are only meaningful relative to an
            // origin (none currently — all dest rows are valid destinations).
            for (const row of file.dests) {
                if (!row.destination) {
                    continue;
                }
                const label =
                    row.displayInfo?.trim() || `(${row.destination.x}, ${row.destination.y})`;
                const key = `${row.destination.x},${row.destination.y},${label}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                out.push({
                    destination: row.destination,
                    displayInfo: label,
                    category: file.name,
                });
            }
        }
        out.sort((a, b) =>
            a.category === b.category
                ? a.displayInfo.localeCompare(b.displayInfo)
                : a.category.localeCompare(b.category),
        );
        return out;
    }

    /**
     * Every transport edge in the dataset (origin -> destination), with
     * permutation files (spirit trees, fairy rings, ...) fully expanded. Used
     * by the debug overlay to draw teleport links across the world map.
     */
    getAllEdges(): TransportEdge[] {
        const out: TransportEdge[] = [];
        const seen = new Set<string>();

        for (const file of this.files) {
            for (const row of file.concrete) {
                if (!row.origin || !row.destination) {
                    continue;
                }
                const key = this.dedupeKey(row.destination, row.displayInfo);
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                out.push(toEdge(row, row.destination, row.displayInfo, file.name));
            }

            if (file.origins.length > 0 && file.dests.length > 0) {
                for (const origin of file.origins) {
                    if (!origin.origin) {
                        continue;
                    }
                    for (const dest of file.dests) {
                        if (!dest.destination) {
                            continue;
                        }
                        if (
                            withinThreshold(origin.origin, dest.destination, file.threshold) ||
                            sameTile(origin.origin, dest.destination)
                        ) {
                            continue;
                        }
                        const key = this.dedupeKey(dest.destination, dest.displayInfo);
                        if (seen.has(key)) {
                            continue;
                        }
                        seen.add(key);
                        out.push(toEdge(origin, dest.destination, dest.displayInfo, file.name));
                    }
                }
            }
        }

        return out;
    }

    private inSquare(tile: Tile3, mapX: number, mapY: number): boolean {
        return tile.x >> 6 === mapX && tile.y >> 6 === mapY;
    }

    private dedupeKey(tile: Tile3, displayInfo: string | undefined): string {
        return `${tile.x},${tile.y},${tile.plane},${displayInfo ?? ""}`;
    }
}

export { edgeLabel };
