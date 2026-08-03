import { describe, expect, it } from "vitest";

import { TransportIndex, buildTransportChoices, pickChoiceDestination } from "./Transport";
import { getTransportIndex } from "./Transports";

describe("TransportIndex", () => {
    it("parses concrete origin->destination edges and looks them up by object", () => {
        const tsv = [
            "# Origin\tDestination\tmenuOption menuTarget objectID\tSkills\tItems\tQuests\tDuration\tDisplay info",
            "3029 3217 0\t2956 3146 0\tMusa Point Captain Tobias 14979\t\tCOINS=30\t\t10\tMusa Point",
            "2956 3146 0\t3029 3217 0\tPort Sarim Customs officer 14985\t\tCOINS=30\t\t10\tPort Sarim",
        ].join("\n");

        const index = TransportIndex.fromSources([{ name: "ships.tsv", content: tsv }]);

        // 3029,3217 is in map square (3029>>6=47, 3217>>6=50).
        const edges = index.lookupByObject(14979, 47, 50);
        expect(edges).toHaveLength(1);
        expect(edges[0].destination).toEqual({ x: 2956, y: 3146, plane: 0 });
        expect(edges[0].displayInfo).toBe("Musa Point");

        // Same object id but wrong map square -> no match.
        expect(index.lookupByObject(14979, 0, 0)).toHaveLength(0);
    });

    it("expands permutation origin/destination rows within the same file", () => {
        // Two spirit-tree origins, two shared destinations. Each origin sits on
        // top of one destination (its own tree), which the type threshold drops.
        const tsv = [
            "# Origin\tDestination\tmenuOption menuTarget objectID\tSkills\tQuests\tDuration\tDisplay info",
            "2543 3167 0\t\tTravel Spirit tree 26261",
            "2460 3444 0\t\tTravel Spirit tree 26260",
            "\t2542 3170 0\t\t\tTree Gnome Village\t3\t1: Tree Gnome Village",
            "\t2461 3444 0\t\t\tTree Gnome Village\t3\t2: Gnome Stronghold",
        ].join("\n");

        const index = TransportIndex.fromSources([{ name: "spirit_trees.tsv", content: tsv }]);

        // Origin 2543,3167 is the Tree Gnome Village tree (near dest 1), so it
        // only offers the *other* destination. Map square (39, 49).
        const fromGnomeVillage = index.lookupByObject(26261, 39, 49);
        expect(fromGnomeVillage.map((e) => e.displayInfo)).toEqual(["2: Gnome Stronghold"]);

        // The Gnome Stronghold origin (26260) conversely offers Tree Gnome Village.
        const fromStronghold = index.lookupByObject(26260, 38, 53);
        expect(fromStronghold.map((e) => e.displayInfo)).toEqual(["1: Tree Gnome Village"]);
    });

    it("skips near-equal origin/destination pairs using the type threshold", () => {
        // wilderness_obelisks: threshold 0, so only exact-equal tiles are skipped.
        const tsv = [
            "# Origin\tDestination\tmenuOption menuTarget objectID\tSkills\tQuests\tDuration\tDisplay info",
            "3155 3619 0\t\tActivate Obelisk 14829",
            "\t3156 3620 0\t\t\t3\t1: Level 13 Wilderness",
            "\t3227 3667 0\t\t\t3\t2: Level 19 Wilderness",
        ].join("\n");

        const index = TransportIndex.fromSources([
            { name: "wilderness_obelisks.tsv", content: tsv },
        ]);

        // Origin 3155,3619 vs destination 3156,3620 differ by 1 tile; threshold 0
        // keeps them (only an exact match is dropped).
        const edges = index.lookupByObject(14829, 49, 56);
        expect(edges).toHaveLength(2);
    });

    it("parses the bundled transport data without errors", async () => {
        const index = await getTransportIndex();

        // Port Sarim -> Musa Point ship (Captain Tobias, object 14979) lives in
        // map square (47, 50).
        const edges = index.lookupByObject(14979, 47, 50);
        expect(edges.length).toBeGreaterThan(0);
        expect(edges.some((e) => e.displayInfo === "Musa Point")).toBe(true);

        // Free teleports (spells/items) should be enumerated for the panel.
        const panel = index.getPanelTeleports();
        expect(panel.length).toBeGreaterThan(50);
        expect(panel.some((p) => p.displayInfo.includes("Varrock Teleport"))).toBe(true);
        expect(panel.every((p) => p.displayInfo.length > 0)).toBe(true);
    });

    it("clusters nearby destinations into one option, picking randomly on use", () => {
        // Scorpia cavern entrance: one object, several origin tiles landing on a
        // few nearby in-cavern tiles, all labelled "Cavern" (no displayInfo).
        const tsv = [
            "# Origin\tDestination\tmenuOption menuTarget objectID\tSkills\tItems\tQuests\tVarbits\tVarPlayers\tDuration\tDisplay info",
            "3233 3950 0\t3232 10351 0\tEnter Cavern 26762",
            "3232 3950 0\t3232 10351 0\tEnter Cavern 26762",
            "3242 3948 0\t3243 10351 0\tEnter Cavern 26762",
            "3243 3948 0\t3243 10351 0\tEnter Cavern 26762",
            "3232 3938 0\t3233 10332 0\tEnter Cavern 26762",
            "3233 3938 0\t3233 10332 0\tEnter Cavern 26762",
        ].join("\n");

        const index = TransportIndex.fromSources([{ name: "transports.tsv", content: tsv }]);
        // All origins share map square (50, 61).
        const edges = index.lookupByObject(26762, 50, 61);

        // The three landing tiles are within 25 tiles of each other, so they
        // collapse into a single "Cavern" option (no coordinate suffix needed).
        const choices = buildTransportChoices(edges);
        expect(choices).toHaveLength(1);
        expect(choices[0].label).toBe("Cavern");
        expect(choices[0].destinations).toHaveLength(3);
        expect(choices[0].destinations.map((d) => `${d.x},${d.y}`).sort()).toEqual([
            "3232,10351",
            "3233,10332",
            "3243,10351",
        ]);

        // Picking resolves to one of the clustered tiles.
        const picked = pickChoiceDestination(choices[0]);
        expect(choices[0].destinations).toContainEqual(picked);

        // Destinations farther apart than the cluster radius stay separate, and
        // genuinely colliding labels are still disambiguated with coordinates.
        const far = buildTransportChoices([
            {
                origin: { x: 0, y: 0, plane: 0 },
                destination: { x: 1000, y: 1000, plane: 0 },
                objectId: 1,
                menuOption: "Enter",
                menuTarget: "Cavern",
                displayInfo: undefined,
                category: "Test",
            },
            {
                origin: { x: 0, y: 0, plane: 0 },
                destination: { x: 2000, y: 2000, plane: 0 },
                objectId: 1,
                menuOption: "Enter",
                menuTarget: "Cavern",
                displayInfo: undefined,
                category: "Test",
            },
        ]);
        expect(far).toHaveLength(2);
        expect(far.every((c) => c.label.startsWith("Cavern ("))).toBe(true);

        // A distinct label with no collision keeps its plain name (no suffix).
        const unique = buildTransportChoices([
            {
                origin: { x: 0, y: 0, plane: 0 },
                destination: { x: 1, y: 1, plane: 0 },
                objectId: 1,
                menuOption: "Travel",
                menuTarget: "Varrock",
                displayInfo: "Varrock",
                category: "Test",
            },
        ]);
        expect(unique[0].label).toBe("Varrock");
    });
});
