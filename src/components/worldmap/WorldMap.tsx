import { useLayoutEffect, useRef, useState, RefObject } from "react";
import "./WorldMap.css";
import { useElementSize, useEventListener } from "usehooks-ts";
import { RegionLoader } from "../../client/RegionLoader";
import { clamp } from "../../client/util/MathUtil";

interface Position {
    x: number;
    y: number;
}

export interface WorldMapProps {
    getPosition: () => Position;

    onDoubleClick: (x: number, y: number) => void;

    loadMapImageUrl: (regionX: number, regionY: number) => string | undefined;
}

export function WorldMap(props: WorldMapProps) {
    const { getPosition, loadMapImageUrl } = props;

    const [ref, dimensions] = useElementSize();
    const dragRef = useRef<HTMLDivElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);

    const [pos, setPos] = useState(getPosition);
    const [tileSize, setTileSize] = useState(3);

    // const tileSize = 3;
    const halfTileSize = tileSize / 2;
    const imageSize = 64 * tileSize;

    const cameraX = pos.x;
    const cameraY = pos.y;

    const regionX = pos.x >> 6;
    const regionY = pos.y >> 6;

    // console.log(dimensions)

    const halfWidth = (dimensions.width / 2) | 0;
    const halfHeight = (dimensions.height / 2) | 0;

    const x = halfWidth - (cameraX % 64) * tileSize - halfTileSize;
    const y = halfHeight - (cameraY % 64) * tileSize - halfTileSize;

    const onDoubleClick = (event: MouseEvent) => {
        setIsDragging(false);

        const deltaX = (event.offsetX - halfWidth) / tileSize + 0.5;
        const deltaY = (halfHeight - event.offsetY) / tileSize + 0.5;

        props.onDoubleClick(pos.x + deltaX, pos.y + deltaY);
    };

    function startDragging(startX: number, startY: number) {
        setIsDragging(true);
        setStartX(startX);
        setStartY(startY);
    }

    const onMouseDown = (event: MouseEvent) => {
        startDragging(event.x, event.y);
    };

    const onTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        const rect = dragRef.current?.getBoundingClientRect();
        const offsetX = rect?.left ?? 0;
        const offsetY = rect?.top ?? 0;
        startDragging(touch.clientX - offsetX, touch.clientY - offsetY);
    };

    const drag = (x: number, y: number) => {
        const deltaX = (startX - x) / tileSize;
        const deltaY = (y - startY) / tileSize;

        setStartX(x);
        setStartY(y);
        setPos({
            x: pos.x + deltaX,
            y: pos.y + deltaY,
        });
    };

    const onMouseMove = (event: MouseEvent) => {
        if (isDragging) {
            drag(event.x, event.y);
        }
    };

    const onTouchMove = (event: TouchEvent) => {
        if (isDragging) {
            const touch = event.touches[0];
            const rect = dragRef.current?.getBoundingClientRect();
            const offsetX = rect?.left ?? 0;
            const offsetY = rect?.top ?? 0;
            drag(touch.clientX - offsetX, touch.clientY - offsetY);
        }
    };

    const stopDragging = (event: MouseEvent | TouchEvent) => {
        setIsDragging(false);
    };

    const onMouseWheel = (event: WheelEvent) => {
        setTileSize(clamp(tileSize - Math.sign(event.deltaY), 1, 8));
    };

    useEventListener("dblclick", onDoubleClick, dragRef);
    useEventListener("mousedown", onMouseDown, dragRef);
    useEventListener("touchstart", onTouchStart, dragRef);
    useEventListener("mousemove", onMouseMove, dragRef);
    useEventListener("touchmove", onTouchMove, dragRef);
    useEventListener("mouseup", stopDragging, dragRef);
    useEventListener("touchend", stopDragging, dragRef);
    useEventListener("wheel", onMouseWheel, dragRef);

    const renderStartX = -Math.ceil(x / imageSize) - 1;
    const renderStartY = -Math.ceil(y / imageSize) - 1;

    const renderEndX = Math.ceil((dimensions.width - x) / imageSize) + 1;
    const renderEndY = Math.ceil((dimensions.height - y) / imageSize) + 1;

    const images: JSX.Element[] = [];

    for (let rx = renderStartX; rx < renderEndX; rx++) {
        for (let ry = renderStartY; ry < renderEndY; ry++) {
            const imageRegionX = regionX + rx;
            const imageRegionY = regionY + ry;
            const regionId = RegionLoader.getRegionId(
                imageRegionX,
                imageRegionY
            );
            const mapUrl = loadMapImageUrl(imageRegionX, imageRegionY);
            if (mapUrl) {
                images.push(
                    <img
                        key={regionId}
                        className={`worldmap-image ${imageRegionX}_${imageRegionY}`}
                        src={mapUrl}
                        style={{
                            left: x + rx * imageSize,
                            bottom: y + ry * imageSize,
                            width: imageSize,
                            height: imageSize,
                        }}
                    />
                );
            }
        }
    }

    return (
        <div className="worldmap" ref={ref}>
            {images}
            <div
                className={`worldmap-drag ${isDragging ? "dragging" : ""}`}
                ref={dragRef}
            ></div>
            {/* <div
                style={{
                    position: "absolute",
                    left: halfWidth - 2,
                    bottom: halfHeight - 2,
                    width: 4,
                    height: 4,
                    backgroundColor: "cyan",
                    zIndex: 10,
                }}
            ></div> */}
        </div>
    );
}
