import Modal from "react-modal";
import "./WorldMapModal.css";
import { WorldMap, WorldMapProps } from "./WorldMap";

interface WorldMapModalProps {
    isOpen: boolean;

    onRequestClose: () => void;
}

type Props = WorldMapModalProps & WorldMapProps;

Modal.setAppElement("#root");

export function WorldMapModal(props: Props) {
    const { isOpen, onRequestClose } = props;
    return (
        <Modal
            className="worldmap-modal rs-border"
            overlayClassName="worldmap-modal-overlay"
            isOpen={isOpen}
            onRequestClose={onRequestClose}
        >
            <div className="worldmap-close-button" onClick={onRequestClose}></div>
            <WorldMap {...props} />
        </Modal>
    );
}
