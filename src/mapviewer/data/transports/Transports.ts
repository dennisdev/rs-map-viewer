import { TransportIndex } from "./Transport";
import agilityShortcuts from "./agility_shortcuts.tsv?raw";
import boats from "./boats.tsv?raw";
import canoes from "./canoes.tsv?raw";
import charterShips from "./charter_ships.tsv?raw";
import fairyRings from "./fairy_rings.tsv?raw";
import gnomeGliders from "./gnome_gliders.tsv?raw";
import hotAirBalloons from "./hot_air_balloons.tsv?raw";
import magicCarpets from "./magic_carpets.tsv?raw";
import magicMushtrees from "./magic_mushtrees.tsv?raw";
import minecarts from "./minecarts.tsv?raw";
import quetzalWhistle from "./quetzal_whistle.tsv?raw";
import quetzals from "./quetzals.tsv?raw";
import ships from "./ships.tsv?raw";
import spiritTrees from "./spirit_trees.tsv?raw";
import teleportationBoxes from "./teleportation_boxes.tsv?raw";
import teleportationItems from "./teleportation_items.tsv?raw";
import teleportationLevers from "./teleportation_levers.tsv?raw";
import teleportationMinigames from "./teleportation_minigames.tsv?raw";
import teleportationPortals from "./teleportation_portals.tsv?raw";
import teleportationPortalsPoh from "./teleportation_portals_poh.tsv?raw";
import teleportationSpells from "./teleportation_spells.tsv?raw";
import transports from "./transports.tsv?raw";
import wildernessObelisks from "./wilderness_obelisks.tsv?raw";

const SOURCES = [
    { name: "agility_shortcuts.tsv", content: agilityShortcuts },
    { name: "boats.tsv", content: boats },
    { name: "canoes.tsv", content: canoes },
    { name: "charter_ships.tsv", content: charterShips },
    { name: "fairy_rings.tsv", content: fairyRings },
    { name: "gnome_gliders.tsv", content: gnomeGliders },
    { name: "hot_air_balloons.tsv", content: hotAirBalloons },
    { name: "magic_carpets.tsv", content: magicCarpets },
    { name: "magic_mushtrees.tsv", content: magicMushtrees },
    { name: "minecarts.tsv", content: minecarts },
    { name: "quetzal_whistle.tsv", content: quetzalWhistle },
    { name: "quetzals.tsv", content: quetzals },
    { name: "ships.tsv", content: ships },
    { name: "spirit_trees.tsv", content: spiritTrees },
    { name: "teleportation_boxes.tsv", content: teleportationBoxes },
    { name: "teleportation_items.tsv", content: teleportationItems },
    { name: "teleportation_levers.tsv", content: teleportationLevers },
    { name: "teleportation_minigames.tsv", content: teleportationMinigames },
    { name: "teleportation_portals.tsv", content: teleportationPortals },
    { name: "teleportation_portals_poh.tsv", content: teleportationPortalsPoh },
    { name: "teleportation_spells.tsv", content: teleportationSpells },
    { name: "transports.tsv", content: transports },
    { name: "wilderness_obelisks.tsv", content: wildernessObelisks },
];

let indexPromise: Promise<TransportIndex> | undefined;

/**
 * Lazily build (once) the global transport index from the bundled TSV data.
 * Parsing runs off the main render path via a microtask defer.
 */
export function getTransportIndex(): Promise<TransportIndex> {
    if (!indexPromise) {
        indexPromise = Promise.resolve(TransportIndex.fromSources(SOURCES));
    }
    return indexPromise;
}
