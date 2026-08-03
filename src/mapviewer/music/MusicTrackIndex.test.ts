import { describe, expect, test } from "vitest";

import {
    MusicEntry,
    MusicPolygon,
    MusicTrackIndex,
    getPolygonVertices,
    isEventTrack,
    pointInPolygon,
} from "./MusicTrackIndex";

function makeEntry(cacheId: number, polygon?: { x: number; y: number }[]): MusicEntry {
    return {
        name: `track-${cacheId}`,
        aliases: [],
        members: false,
        cacheId,
        polygon: polygon
            ? {
                  raw: "",
                  vertices: polygon,
                  centroid: polygon[0],
              }
            : undefined,
    };
}

function makeEntryWithRaw(cacheId: number, raw: string): MusicEntry {
    const polygon: MusicPolygon = {
        raw,
        vertices: [{ x: 0, y: 0 }],
        centroid: { x: 0, y: 0 },
    };
    return {
        name: `track-${cacheId}`,
        aliases: [],
        members: false,
        cacheId,
        polygon,
    };
}

describe("pointInPolygon", () => {
    const square = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
    ];

    test("inside a square", () => {
        expect(pointInPolygon(5, 5, square)).toBe(true);
        expect(pointInPolygon(1, 1, square)).toBe(true);
    });

    test("outside a square", () => {
        expect(pointInPolygon(11, 5, square)).toBe(false);
        expect(pointInPolygon(-1, 5, square)).toBe(false);
        expect(pointInPolygon(5, 50, square)).toBe(false);
    });

    test("concave polygon (L-shape)", () => {
        const lShape = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 4 },
            { x: 4, y: 4 },
            { x: 4, y: 10 },
            { x: 0, y: 10 },
        ];
        // Inside the horizontal arm
        expect(pointInPolygon(8, 2, lShape)).toBe(true);
        // Inside the vertical arm
        expect(pointInPolygon(2, 8, lShape)).toBe(true);
        // In the cut-out corner
        expect(pointInPolygon(8, 8, lShape)).toBe(false);
    });

    test("returns false for fewer than 3 vertices", () => {
        expect(pointInPolygon(0, 0, [])).toBe(false);
        expect(pointInPolygon(0, 0, [{ x: 0, y: 0 }])).toBe(false);
    });

    test("matches OSRS world coordinates from all-music.json", () => {
        const brimhavenDungeon = [
            { x: 2624, y: 9472 },
            { x: 2624, y: 9600 },
            { x: 2688, y: 9600 },
            { x: 2688, y: 9472 },
        ];
        expect(pointInPolygon(2656, 9536, brimhavenDungeon)).toBe(true);
        expect(pointInPolygon(2624, 9472, brimhavenDungeon)).toBe(true);
        expect(pointInPolygon(2700, 9600, brimhavenDungeon)).toBe(false);
    });
});

describe("MusicTrackIndex", () => {
    test("builds spatial index and byCacheId map", () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        const entries = [
            makeEntry(100, square),
            makeEntry(200),
            makeEntry(300, [
                { x: 20, y: 20 },
                { x: 30, y: 20 },
                { x: 25, y: 30 },
            ]),
        ];
        const idx = new MusicTrackIndex(entries);
        expect(idx.all.length).toBe(3);
        expect(idx.spatial.length).toBe(2);
        expect(idx.getByCacheId(200)?.name).toBe("track-200");
        expect(idx.getByCacheId(999)).toBeUndefined();
    });

    test("findTrackAt returns the containing polygon's entry", () => {
        const a = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        const b = [
            { x: 100, y: 100 },
            { x: 110, y: 100 },
            { x: 110, y: 110 },
            { x: 100, y: 110 },
        ];
        const idx = new MusicTrackIndex([makeEntry(1, a), makeEntry(2, b)]);
        expect(idx.findTrackAt(5, 5)?.cacheId).toBe(1);
        expect(idx.findTrackAt(105, 105)?.cacheId).toBe(2);
        expect(idx.findTrackAt(50, 50)).toBeUndefined();
    });

    test("findTracksAt returns every overlapping track in a region", () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        // Two tracks whose polygons overlap (Lightness + Scape Soft style).
        const lightness = makeEntry(10, square);
        const scapeSoft = makeEntry(11, square);
        const farAway = makeEntry(12, [
            { x: 100, y: 100 },
            { x: 110, y: 100 },
            { x: 110, y: 110 },
            { x: 100, y: 110 },
        ]);
        const idx = new MusicTrackIndex([lightness, scapeSoft, farAway]);
        const atOverlap = idx
            .findTracksAt(5, 5)
            .map((e) => e.cacheId)
            .sort();
        expect(atOverlap).toEqual([10, 11]);
        expect(idx.findTracksAt(105, 105).map((e) => e.cacheId)).toEqual([12]);
        expect(idx.findTracksAt(50, 50)).toEqual([]);
    });

    test("search matches name, sortName, composer, aliases", () => {
        const entries: MusicEntry[] = [
            {
                name: "Scape Main",
                aliases: ["scape"],
                members: false,
                sortName: "Main, Scape",
                composer: "Ian Taylor",
            },
            {
                name: "Harmony",
                aliases: [],
                members: false,
                composer: "Stephen Lord",
            },
        ];
        const idx = new MusicTrackIndex(entries);
        expect(idx.search("scape").map((e) => e.name)).toEqual(["Scape Main"]);
        expect(idx.search("ian").map((e) => e.name)).toEqual(["Scape Main"]);
        expect(idx.search("main").map((e) => e.name)).toEqual(["Scape Main"]);
        expect(idx.search("xyz")).toEqual([]);
    });

    test("search with empty query returns first N tracks", () => {
        const entries = [makeEntry(1), makeEntry(2), makeEntry(3)];
        const idx = new MusicTrackIndex(entries);
        expect(idx.search("").length).toBe(3);
        expect(idx.search("", 2).length).toBe(2);
    });

    test("event tracks are kept in all but excluded from spatial", () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        const regular: MusicEntry = {
            name: "regular",
            aliases: [],
            members: false,
            cacheId: 1,
            polygon: { raw: "", vertices: square, centroid: square[0] },
        };
        const holidayEvent: MusicEntry = {
            name: "Sunny Side Up",
            aliases: [],
            members: false,
            cacheId: 2,
            location: "Varrock",
            hint: "This track unlocks during an Easter event",
            polygon: { raw: "", vertices: square, centroid: square[0] },
        };
        const randomEvent: MusicEntry = {
            name: "Evil Bob's Island",
            aliases: [],
            members: false,
            cacheId: 3,
            location: "Evil Bob's random event",
            hint: "This track unlocks on Evil Bob's island.",
            polygon: { raw: "", vertices: square, centroid: square[0] },
        };
        const idx = new MusicTrackIndex([regular, holidayEvent, randomEvent]);
        expect(idx.all.length).toBe(3);
        expect(idx.spatial.length).toBe(2);
        const spatialIds = idx.spatial.map((s) => s.entry.cacheId).sort();
        expect(spatialIds).toEqual([1, 3]);
    });
});

describe("isEventTrack", () => {
    function entry(fields: Partial<MusicEntry> = {}): MusicEntry {
        return { name: "x", aliases: [], members: false, ...fields };
    }

    test("flags holiday event hints (Christmas, Halloween, Easter)", () => {
        expect(isEventTrack(entry({ hint: "This track unlocks during a Christmas event." }))).toBe(
            true,
        );
        expect(isEventTrack(entry({ hint: "This track unlocks during a Halloween event." }))).toBe(
            true,
        );
        expect(isEventTrack(entry({ hint: "This track unlocks during an Easter event" }))).toBe(
            true,
        );
    });

    test("does not flag random event tracks", () => {
        expect(
            isEventTrack(entry({ hint: "This track unlocks during the Mime random event." })),
        ).toBe(false);
        expect(
            isEventTrack(entry({ hint: "This track unlocks during Evil Twin random event." })),
        ).toBe(false);
        expect(isEventTrack(entry({ location: "Evil Bob's random event" }))).toBe(false);
    });

    test("does not flag regular quest and minigame tracks", () => {
        expect(
            isEventTrack(
                entry({ hint: "This track unlocks during the Sins of the Father quest." }),
            ),
        ).toBe(false);
        expect(isEventTrack(entry({ location: "God Wars Dungeon" }))).toBe(false);
        expect(isEventTrack(entry())).toBe(false);
    });
});

describe("getPolygonVertices (decimal-corruption regression)", () => {
    test("parses integer raw field correctly", () => {
        const polygon: MusicPolygon = {
            raw: "0,0,10,0,10,10,0,10",
            vertices: [],
            centroid: { x: 5, y: 5 },
        };
        const v = getPolygonVertices(polygon);
        expect(v).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ]);
    });

    test("parses raw with decimal coordinates (the Have-an-Ice-Day bug)", () => {
        // Mimics the exact corruption pattern from public/all-music.json:
        // raw is correct ("2633.7,4074.3,...") but the pre-parsed vertices
        // array was mangled by an upstream generator that split on ".".
        const polygon: MusicPolygon = {
            raw: "2633.7,4074.3,2633.7,4073.7,2635,4072,2640,4070",
            vertices: [
                { x: 2633, y: 7 },
                { x: 4074, y: 3 },
                { x: 2633, y: 7 },
                { x: 4073, y: 7 },
                { x: 2635, y: 4072 },
                { x: 2640, y: 4070 },
            ],
            centroid: { x: 2635, y: 4073 },
        };
        const v = getPolygonVertices(polygon);
        expect(v.length).toBe(4);
        expect(v).toEqual([
            { x: 2633.7, y: 4074.3 },
            { x: 2633.7, y: 4073.7 },
            { x: 2635, y: 4072 },
            { x: 2640, y: 4070 },
        ]);
    });

    test("falls back to vertices array when raw is missing or malformed", () => {
        const vertices = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ];
        expect(getPolygonVertices({ raw: "", vertices, centroid: vertices[0] })).toEqual(vertices);
        expect(getPolygonVertices({ raw: "1,2,3", vertices, centroid: vertices[0] })).toEqual(
            vertices,
        );
        expect(
            getPolygonVertices({ raw: "abc,def,ghi,jkl", vertices, centroid: vertices[0] }),
        ).toEqual(vertices);
    });
});

describe("regression: Have an Ice Day (cacheId 217) — Iceberg polygon", () => {
    // A faithful miniature of the real Iceberg polygon. The y values are
    // around 4000 (far north) and x values around 2660. Decimals in raw
    // mirror the corruption pattern in public/all-music.json.
    const icebergRaw =
        "2660,4089,2650,4089,2640,4080,2640,4070,2645,4060,2655,4055,2665,4055," +
        "2675,4060,2680,4070,2680,4080,2670,4089,2660,4089";
    // A point that LOOKS inside (between min/max) but is far from the polygon:
    // (3242, 3202) is Lumbridge — should be OUTSIDE the Iceberg.
    const lumbridge = { x: 3242, y: 3202 };
    // A point that IS inside the Iceberg:
    const iceberg = { x: 2660, y: 4070 };

    test("findTrackAt returns undefined for Lumbridge (the bug)", () => {
        const idx = new MusicTrackIndex([makeEntryWithRaw(217, icebergRaw)]);
        expect(idx.findTrackAt(lumbridge.x, lumbridge.y)).toBeUndefined();
    });

    test("findTrackAt returns Have an Ice Day for the Iceberg", () => {
        const idx = new MusicTrackIndex([makeEntryWithRaw(217, icebergRaw)]);
        const hit = idx.findTrackAt(iceberg.x, iceberg.y);
        expect(hit?.cacheId).toBe(217);
    });

    test("bounding box of corrected vertices is contained in the Iceberg area", () => {
        const polygon: MusicPolygon = {
            raw: icebergRaw,
            vertices: [],
            centroid: { x: 2660, y: 4070 },
        };
        const v = getPolygonVertices(polygon);
        const xs = v.map((p) => p.x);
        const ys = v.map((p) => p.y);
        const xMin = Math.min(...xs);
        const xMax = Math.max(...xs);
        const yMin = Math.min(...ys);
        const yMax = Math.max(...ys);
        // Iceberg spans roughly x[2640,2680] y[4055,4089].
        expect(xMin).toBeGreaterThanOrEqual(2640);
        expect(xMax).toBeLessThanOrEqual(2680);
        expect(yMin).toBeGreaterThanOrEqual(4055);
        expect(yMax).toBeLessThanOrEqual(4089);
        // And critically, Lumbridge is far outside:
        expect(lumbridge.x).toBeGreaterThan(xMax);
        expect(lumbridge.y).toBeLessThan(yMin);
    });
});
