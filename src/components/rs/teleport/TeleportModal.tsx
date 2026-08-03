import { memo, useEffect, useMemo, useState } from "react";
import Modal from "react-modal";
import { GroupBase, SingleValue } from "react-select";

import {
    NpcSearchEntry,
    SearchData,
    loadSearchData,
} from "../../../mapviewer/data/search/SearchData";
import { PanelTeleport } from "../../../mapviewer/data/transports/Transport";
import { OsrsSelect } from "../select/OsrsSelect";
import "./TeleportModal.css";

interface SearchOption {
    kind: "teleport" | "location" | "npc";
    label: string;
    x: number;
    y: number;
    plane: number;
    /** Present for NPC options so multi-location NPCs can open a sub-picker. */
    npc?: NpcSearchEntry;
}

interface SearchGroup extends GroupBase<SearchOption> {
    label: string;
    options: SearchOption[];
}

interface TeleportModalProps {
    isOpen: boolean;

    teleports: PanelTeleport[];

    onTeleport: (x: number, y: number, plane: number) => void;
    onRequestClose: () => void;
}

const PER_GROUP = 12;

function matches(query: string, fields: (string | undefined)[]): boolean {
    return fields.some((field) => !!field && field.toLowerCase().includes(query));
}

export const TeleportModal = memo(function TeleportModal({
    isOpen,
    teleports,
    onTeleport,
    onRequestClose,
}: TeleportModalProps): JSX.Element {
    const [searchData, setSearchData] = useState<SearchData | undefined>();
    const [loadFailed, setLoadFailed] = useState(false);
    const [input, setInput] = useState("");
    // When set, the modal shows a location sub-picker for this NPC.
    const [pendingNpc, setPendingNpc] = useState<NpcSearchEntry | undefined>();

    // Load the (large) location/npc data sets lazily on first open.
    useEffect(() => {
        if (!isOpen || searchData || loadFailed) {
            return;
        }
        let cancelled = false;
        loadSearchData()
            .then((data) => {
                if (!cancelled) {
                    setSearchData(data);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setLoadFailed(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, searchData, loadFailed]);

    const groups = useMemo<SearchGroup[]>(() => {
        const query = input.trim().toLowerCase();

        // Teleports are the priority group, shown even before typing.
        const teleportOptions: SearchOption[] = [];
        for (const t of teleports) {
            if (query && !t.displayInfo.toLowerCase().includes(query)) {
                continue;
            }
            teleportOptions.push({
                kind: "teleport",
                label: t.displayInfo,
                x: t.destination.x,
                y: t.destination.y,
                plane: t.destination.plane,
            });
            if (teleportOptions.length >= PER_GROUP) {
                break;
            }
        }
        const result: SearchGroup[] = [];
        if (teleportOptions.length > 0) {
            result.push({ label: "Teleport", options: teleportOptions });
        }

        const locations = searchData?.locations ?? [];
        const npcs = searchData?.npcs ?? [];

        if (!query || !searchData) {
            return result;
        }

        const locationOptions: SearchOption[] = [];
        for (const loc of locations) {
            if (locationOptions.length >= PER_GROUP) {
                break;
            }
            if (matches(query, [loc.name, loc.region])) {
                locationOptions.push({
                    kind: "location",
                    label: loc.name,
                    x: loc.position.x,
                    y: loc.position.y,
                    plane: 0,
                });
            }
        }
        if (locationOptions.length > 0) {
            result.push({ label: "Location", options: locationOptions });
        }

        const npcOptions: SearchOption[] = [];
        for (const npc of npcs) {
            if (npcOptions.length >= PER_GROUP) {
                break;
            }
            if (matches(query, [npc.name, ...npc.aliases])) {
                npcOptions.push(npcOption(npc));
            }
        }
        if (npcOptions.length > 0) {
            result.push({ label: "NPC", options: npcOptions });
        }

        return result;
    }, [input, teleports, searchData]);

    const onSearchChange = (value: SingleValue<SearchOption>) => {
        if (!value) {
            return;
        }
        setInput("");
        // An NPC found in several places opens a location sub-picker instead of
        // guessing where to send the player.
        if (value.kind === "npc" && value.npc && value.npc.locations.length > 1) {
            setPendingNpc(value.npc);
            return;
        }
        onTeleport(value.x, value.y, value.plane);
    };

    const npcLocationOptions = useMemo<{ value: string; label: string }[]>(
        () =>
            (pendingNpc?.locations ?? []).map((loc) => ({
                value: `${loc.position.x},${loc.position.y}`,
                label: loc.name + (loc.region ? ` — ${loc.region}` : ""),
            })),
        [pendingNpc],
    );

    const onNpcLocationChange = (value: SingleValue<{ value: string; label: string }>) => {
        if (!value || !pendingNpc) {
            return;
        }
        const loc = pendingNpc.locations.find(
            (l) => `${l.position.x},${l.position.y}` === value.value,
        );
        if (loc) {
            onTeleport(loc.position.x, loc.position.y, 0);
        }
        setPendingNpc(undefined);
    };

    const close = () => {
        setPendingNpc(undefined);
        setInput("");
        onRequestClose();
    };

    return (
        <Modal
            className="teleport-modal rs-border rs-background"
            overlayClassName="teleport-modal-overlay"
            isOpen={isOpen}
            onRequestClose={close}
        >
            <div className="teleport-close-button" onClick={close}></div>

            {pendingNpc ? (
                <>
                    <div className="teleport-header content-text">{pendingNpc.name}</div>
                    <div
                        className="teleport-back content-text"
                        onClick={() => setPendingNpc(undefined)}
                    >
                        ‹ Back
                    </div>
                    <div className="teleport-select">
                        <OsrsSelect
                            options={npcLocationOptions}
                            placeholder="Choose location"
                            onChange={onNpcLocationChange}
                        />
                    </div>
                </>
            ) : (
                <>
                    <div className="teleport-header content-text">Teleport</div>
                    <div className="teleport-select">
                        <OsrsSelect<SearchOption, false, SearchGroup>
                            options={groups}
                            inputValue={input}
                            onInputChange={(v) => setInput(v ?? "")}
                            filterOption={() => true}
                            placeholder={
                                searchData
                                    ? "Search teleports, locations, NPCs…"
                                    : loadFailed
                                      ? "Search unavailable"
                                      : "Loading…"
                            }
                            noOptionsMessage={() =>
                                input.trim() ? "No matches" : "Type to search"
                            }
                            onChange={onSearchChange}
                        />
                    </div>
                </>
            )}
        </Modal>
    );
});

function npcOption(npc: NpcSearchEntry): SearchOption {
    const first = npc.locations[0].position;
    return {
        kind: "npc",
        label:
            npc.locations.length > 1 ? `${npc.name} (${npc.locations.length} locations)` : npc.name,
        x: first.x,
        y: first.y,
        plane: 0,
        npc,
    };
}
