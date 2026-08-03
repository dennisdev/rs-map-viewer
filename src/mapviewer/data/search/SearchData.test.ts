import { describe, expect, it } from "vitest";

import { buildSearchData } from "./SearchData";

describe("buildSearchData", () => {
    const locs = [
        { name: "Varrock", aliases: ["varrock city"], position: { x: 3213, y: 3424 } },
        { name: "Falador", aliases: ["fally"], position: { x: 2964, y: 3378 } },
        { name: "Grand Exchange", position: { x: 3165, y: 3479 } },
    ];
    const npcs = [
        // Single location, exact match.
        { name: "Banker", location: "Varrock" },
        // Same name, different cities -> multiple positions.
        { name: "Shop assistant", location: "Falador" },
        { name: "Shop assistant", location: "Varrock" },
        // Descriptive location resolved via substring.
        { name: "Guard", location: "Just north of Falador" },
        // Junk / unresolvable: dropped.
        { name: "? ? ? ?", location: "Varrock" },
        { name: "Wandering merchant", location: "Varies" },
    ];

    const data = buildSearchData(locs as any, npcs as any);

    it("indexes locations with positions", () => {
        expect(data.locations).toHaveLength(3);
        expect(data.locations.map((l) => l.name).sort()).toEqual([
            "Falador",
            "Grand Exchange",
            "Varrock",
        ]);
    });

    it("groups NPCs by name and resolves positions", () => {
        const banker = data.npcs.find((n) => n.name === "Banker");
        expect(banker?.locations).toHaveLength(1);
        expect(banker?.locations[0].position).toEqual({ x: 3213, y: 3424 });
    });

    it("collects multiple positions for NPCs found in several places", () => {
        const assistant = data.npcs.find((n) => n.name === "Shop assistant");
        expect(assistant?.locations).toHaveLength(2);
        const coords = assistant!.locations.map((l) => `${l.position.x},${l.position.y}`).sort();
        expect(coords).toEqual(["2964,3378", "3213,3424"]);
    });

    it("resolves descriptive NPC locations via substring matching", () => {
        const guard = data.npcs.find((n) => n.name === "Guard");
        expect(guard?.locations[0].name).toBe("Falador");
    });

    it("drops junk-named and unresolvable NPCs", () => {
        expect(data.npcs.find((n) => n.name === "? ? ? ?")).toBeUndefined();
        expect(data.npcs.find((n) => n.name === "Wandering merchant")).toBeUndefined();
    });
});
