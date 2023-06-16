import { PropsWithChildren } from "react";
import "./MinimapContainer.css";

interface MinimapContainerProps {
    yawDegrees: number;

    onCompassClick: () => void;
}

export function MinimapContainer({
    yawDegrees,
    onCompassClick,

    children,
}: PropsWithChildren<MinimapContainerProps>) {
    return (
        <div className="minimap-container">
            <img src="/minimap-frame.png" />

            <img
                className="compass"
                style={{
                    transform: `rotate(${yawDegrees}deg)`,
                }}
                src="/compass2.png"
                onClick={onCompassClick}
            />

            <div
                className="minimap"
                style={{
                    transform: `rotate(${yawDegrees}deg)`,
                }}
            >
                <div className="minimap-images">{children}</div>
            </div>
        </div>
    );
}
