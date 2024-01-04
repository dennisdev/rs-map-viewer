import { useCallback, useState } from "react";

import { FloorType } from "../rs/config/floortype/FloorType";
import { MapEditor } from "./MapEditor";
import "./MapEditorPanel.css";

export interface MapEditorPanelProps {
    mapEditor: MapEditor;
}

export function MapEditorPanel({ mapEditor }: MapEditorPanelProps): JSX.Element {
    const [selectedUnderlayId, setSelectedUnderlayId] = useState<number>(
        mapEditor.selectedUnderlayId,
    );

    const underlayTypeLoader = mapEditor.underlayTypeLoader;

    const underlays: FloorType[] = [];
    for (let i = 0; i < underlayTypeLoader.getCount(); i++) {
        underlays.push(underlayTypeLoader.load(i));
    }

    const underlayPreviews = underlays.map((underlay) => {
        const rgb = underlay.getRgb();
        const r = rgb >> 16;
        const g = (rgb >> 8) & 0xff;
        const b = rgb & 0xff;

        const color = `rgb(${r}, ${g}, ${b})`;

        const setUnderlay = () => {
            mapEditor.selectedUnderlayId = underlay.id;
            setSelectedUnderlayId(underlay.id);
        };

        const isSelected = underlay.id === selectedUnderlayId;

        return (
            <div
                key={underlay.id}
                className={`underlay-preview ${isSelected ? "selected" : ""}`}
                style={{ backgroundColor: color }}
                onClick={setUnderlay}
            >
                {underlay.id}
            </div>
        );
    });

    const isNoUnderlaySelected = selectedUnderlayId === -1;

    const setNoUnderlay = useCallback(() => {
        mapEditor.selectedUnderlayId = -1;
        setSelectedUnderlayId(-1);
    }, [mapEditor]);

    return (
        <div className="map-editor-panel content-text">
            <div style={{ padding: "5px" }}>Underlays</div>

            <div className="underlays-container">
                <div
                    className={`underlay-preview ${isNoUnderlaySelected ? "selected" : ""}`}
                    style={{ backgroundColor: "black" }}
                    onClick={setNoUnderlay}
                >
                    None
                </div>
                {underlayPreviews}
            </div>
        </div>
    );
}
