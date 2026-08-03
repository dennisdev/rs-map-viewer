import { memo, useMemo } from "react";
import Modal from "react-modal";
import { SingleValue } from "react-select";

import {
    TransportEdge,
    buildTransportChoices,
    pickChoiceDestination,
} from "../../../mapviewer/data/transports/Transport";
import { OsrsSelect } from "../select/OsrsSelect";
import "./TeleportModal.css";

interface ChoiceOption {
    value: string;
    label: string;
    destinations: { x: number; y: number; plane: number }[];
}

interface TransportChoicesModalProps {
    edges: TransportEdge[];
    title: string;

    onTeleport: (x: number, y: number, plane: number) => void;
    onRequestClose: () => void;
}

export const TransportChoicesModal = memo(function TransportChoicesModal({
    edges,
    title,
    onTeleport,
    onRequestClose,
}: TransportChoicesModalProps): JSX.Element | null {
    const options = useMemo<ChoiceOption[]>(
        () =>
            buildTransportChoices(edges).map((choice) => ({
                value: choice.label,
                label: choice.label,
                destinations: choice.destinations,
            })),
        [edges],
    );

    if (edges.length === 0) {
        return null;
    }

    const onChange = (value: SingleValue<ChoiceOption>) => {
        if (!value) {
            return;
        }
        // A clustered option may cover several nearby landing tiles; pick one.
        const dest = pickChoiceDestination({ destinations: value.destinations });
        onTeleport(dest.x, dest.y, dest.plane);
    };

    return (
        <Modal
            className="teleport-modal rs-border rs-background"
            overlayClassName="teleport-modal-overlay"
            isOpen={edges.length > 0}
            onRequestClose={onRequestClose}
        >
            <div className="teleport-close-button" onClick={onRequestClose}></div>
            <div className="teleport-header content-text">{title || "Travel"}</div>
            <div className="teleport-select">
                <OsrsSelect<ChoiceOption> options={options} onChange={onChange} />
            </div>
        </Modal>
    );
});
