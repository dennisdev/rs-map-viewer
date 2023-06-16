import { PropsWithChildren } from "react";
import frame from "./minimap-frame.png";
import compass from "./compass.png";
import "./MinimapContainer.css";

interface MinimapContainerProps {
    yawDegrees: number;

    onCompassClick: () => void;
    onWorldMapClick: () => void;
}

export function MinimapContainer({
    yawDegrees,
    onCompassClick,
    onWorldMapClick,

    children,
}: PropsWithChildren<MinimapContainerProps>) {
    return (
        <div className="minimap-container">
            <img src={frame} />

            <div
                className="minimap"
                style={{
                    transform: `rotate(${yawDegrees}deg)`,
                }}
            >
                <div className="minimap-images">{children}</div>
            </div>

            <img
                className="compass"
                style={{
                    transform: `rotate(${yawDegrees}deg)`,
                }}
                src={compass}
                onClick={onCompassClick}
            />

            <div className="worldmap-icon" onClick={onWorldMapClick} />
        </div>
    );
}
