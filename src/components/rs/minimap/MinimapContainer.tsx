import { memo, useEffect, useRef, useState } from "react";

import { getMapSquareId } from "../../../rs/map/MapFileIndex";
import "./MinimapContainer.css";
import { MinimapImage } from "./MinimapImage";
import compass from "./compass.png";
import minimapBlack from "./minimap-black.png";
import frame from "./minimap-frame.png";

interface Position {
    x: number;
    y: number;
}

interface MinimapContainerProps {
    yawDegrees: number;

    onCompassClick: () => void;
    onWorldMapClick: () => void;

    getPosition: () => Position;
    loadMapImageUrl: (mapX: number, mapY: number) => string | undefined;
}

export const MinimapContainer = memo(function MinimapContainer({
    yawDegrees,
    onCompassClick,
    onWorldMapClick,

    getPosition,
    loadMapImageUrl,
}: MinimapContainerProps) {
    const [minimapImages, setMinimapImages] = useState<JSX.Element[]>([]);
    const requestRef = useRef<number | undefined>();

    const animate = (time: DOMHighResTimeStamp) => {
        const pos = getPosition();

        const cameraX = pos.x;
        const cameraY = pos.y;

        const cameraMapX = cameraX >> 6;
        const cameraMapY = cameraY >> 6;

        const offsetX = (-128 + (cameraX % 64) * 4) | 0;
        const offsetY = (-128 + (cameraY % 64) * 4) | 0;

        const images: JSX.Element[] = [];

        for (let mx = 0; mx < 3; mx++) {
            for (let my = 0; my < 3; my++) {
                const mapX = cameraMapX - 1 + mx;
                const mapY = cameraMapY - 1 + my;

                const mapId = getMapSquareId(mapX, mapY);

                const minimapUrl = loadMapImageUrl(mapX, mapY) ?? minimapBlack;
                if (minimapUrl) {
                    const x = mx * 255 - offsetX;
                    const y = 255 * 2 - my * 255 + offsetY;

                    images.push(<MinimapImage key={mapId} src={minimapUrl} left={x} top={y} />);
                }
            }
        }

        setMinimapImages(images);

        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, []);

    return (
        <div className="minimap-container">
            <img src={frame} />

            <div
                className="minimap"
                style={{
                    transform: `rotate(${yawDegrees}deg)`,
                }}
            >
                <div className="minimap-images">{minimapImages}</div>
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
});
