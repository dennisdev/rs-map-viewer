import { PropsWithChildren, memo, useEffect, useState, useRef } from "react";
import frame from "./minimap-frame.png";
import compass from "./compass.png";
import "./MinimapContainer.css";
import { RegionLoader } from "../../client/RegionLoader";
import { MinimapImage } from "./MinimapImage";

interface Position {
    x: number;
    y: number;
}

interface MinimapContainerProps {
    yawDegrees: number;

    onCompassClick: () => void;
    onWorldMapClick: () => void;

    getPosition: () => Position;
    loadMapImageUrl: (regionX: number, regionY: number) => string | undefined;
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

        const cameraRegionX = cameraX >> 6;
        const cameraRegionY = cameraY >> 6;

        const offsetX = (-128 + (cameraX % 64) * 4) | 0;
        const offsetY = (-128 + (cameraY % 64) * 4) | 0;

        const images: JSX.Element[] = [];

        for (let rx = 0; rx < 3; rx++) {
            for (let ry = 0; ry < 3; ry++) {
                const regionX = cameraRegionX - 1 + rx;
                const regionY = cameraRegionY - 1 + ry;

                const regionId = RegionLoader.getRegionId(regionX, regionY);

                const minimapUrl = loadMapImageUrl(regionX, regionY);

                const url = minimapUrl ?? "/minimap-black.png";

                const x = rx * 255 - offsetX;
                const y = 255 * 2 - ry * 255 + offsetY;

                images.push(
                    <MinimapImage key={regionId} src={url} left={x} top={y} />
                );
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
