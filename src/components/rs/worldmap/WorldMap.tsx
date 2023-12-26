import {
    MouseEvent,
    TouchEvent,
    WheelEvent,
    memo,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { SingleValue } from "react-select";
import { useElementSize } from "usehooks-ts";

import { getMapSquareId } from "../../../rs/map/MapFileIndex";
import { clamp } from "../../../util/MathUtil";
import { OsrsSelect } from "../select/OsrsSelect";
import "./WorldMap.css";
import locationsImport from "./locations.json";

interface Location {
    name: string;
    coords: number[];
    size?: string;
}

function getTileSize(size?: string) {
    switch (size) {
        case "large":
            return 2;
        case "medium":
            return 3;
        default:
            return 4;
    }
}

interface LocationOption {
    value: string;
    label: string;
}

const locations: Location[] = locationsImport.locations;
const locationsMap: Record<string, Location> = {};
const locationOptions: LocationOption[] = [];

for (const location of locations) {
    const key = `${location.name} ${location.coords.join(",")}`;
    locationsMap[key] = location;
    locationOptions.push({
        value: key,
        label: location.name,
    });
}

interface Position {
    x: number;
    y: number;
}

const TILE_SIZES = [0.25, 0.375, 0.5, 0.75, 1, 2, 3, 4, 5, 6, 8, 10];

const DEFAULT_TILE_SIZE = 3;

const MAX_X = 100 * 64;
const MAX_Y = 200 * 64;

// TODO: Optimize by writing to 1 image

export interface WorldMapProps {
    onDoubleClick: (x: number, y: number) => void;

    getPosition: () => Position;
    loadMapImageUrl: (mapX: number, mapY: number) => string | undefined;
}

export const WorldMap = memo(function WorldMap(props: WorldMapProps) {
    const { getPosition, loadMapImageUrl } = props;

    const [ref, dimensions] = useElementSize();
    const dragRef = useRef<HTMLDivElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState<Position>({ x: 0, y: 0 });

    const [pos, setPos] = useState(getPosition);
    const [tileSizeIndex, setTileSizeIndex] = useState(TILE_SIZES.indexOf(DEFAULT_TILE_SIZE));

    const [images, setImages] = useState<JSX.Element[]>([]);

    const requestRef = useRef<number | undefined>();

    const tileSize = TILE_SIZES[tileSizeIndex];

    const cameraX = pos.x | 0;
    const cameraY = pos.y | 0;

    const halfWidth = (dimensions.width / 2) | 0;
    const halfHeight = (dimensions.height / 2) | 0;

    const animate = (time: DOMHighResTimeStamp) => {
        const halfTileSize = tileSize / 2;
        const imageSize = 64 * tileSize;

        const mapX = pos.x >> 6;
        const mapY = pos.y >> 6;

        const x = halfWidth - (cameraX % 64) * tileSize - halfTileSize;
        const y = halfHeight - (cameraY % 64) * tileSize - halfTileSize;

        const renderStartX = -Math.ceil(x / imageSize) - 1;
        const renderStartY = -Math.ceil(y / imageSize) - 1;

        const renderEndX = Math.ceil((dimensions.width - x) / imageSize) + 1;
        const renderEndY = Math.ceil((dimensions.height - y) / imageSize) + 1;

        const images: JSX.Element[] = [];

        for (let rx = renderStartX; rx < renderEndX; rx++) {
            for (let ry = renderStartY; ry < renderEndY; ry++) {
                const imageMapX = mapX + rx;
                const imageMapY = mapY + ry;
                const mapId = getMapSquareId(imageMapX, imageMapY);
                const mapUrl = loadMapImageUrl(imageMapX, imageMapY);
                if (mapUrl) {
                    images.push(
                        <img
                            key={mapId}
                            className={`worldmap-image ${imageMapX}_${imageMapY}`}
                            src={mapUrl}
                            style={{
                                left: x + rx * imageSize,
                                bottom: y + ry * imageSize,
                                width: imageSize,
                                height: imageSize,
                            }}
                        />,
                    );
                }
            }
        }

        setImages(images);

        requestRef.current = requestAnimationFrame(animate);
    };

    useLayoutEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [dimensions, pos, tileSize]);

    const onDoubleClick = (event: MouseEvent) => {
        setIsDragging(false);

        const offsetX = event.nativeEvent.offsetX;
        const offsetY = event.nativeEvent.offsetY;

        const deltaX = (offsetX - halfWidth) / tileSize + 0.5;
        const deltaY = (halfHeight - offsetY) / tileSize + 0.5;

        props.onDoubleClick(cameraX + deltaX, cameraY + deltaY);
    };

    function startDragging(startX: number, startY: number) {
        setIsDragging(true);
        setStartPos({
            x: startX,
            y: startY,
        });
        // setStartX(startX);
        // setStartY(startY);
    }

    const onMouseDown = (event: MouseEvent) => {
        const rect = dragRef.current?.getBoundingClientRect();
        const offsetX = rect?.left ?? 0;
        const offsetY = rect?.top ?? 0;

        startDragging(event.clientX - offsetX, event.clientY - offsetY);
    };

    const onTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        const rect = dragRef.current?.getBoundingClientRect();
        const offsetX = rect?.left ?? 0;
        const offsetY = rect?.top ?? 0;
        startDragging(touch.clientX - offsetX, touch.clientY - offsetY);
    };

    const drag = (x: number, y: number) => {
        const { x: startX, y: startY } = startPos;

        const deltaX = (startX - x) / tileSize;
        const deltaY = (y - startY) / tileSize;

        startPos.x = x;
        startPos.y = y;
        setPos((pos) => {
            return {
                x: clamp(pos.x + deltaX, 0, MAX_X),
                y: clamp(pos.y + deltaY, 0, MAX_Y),
            };
        });
    };

    const onMouseMove = (event: MouseEvent) => {
        if (isDragging) {
            const rect = dragRef.current?.getBoundingClientRect();
            const offsetX = rect?.left ?? 0;
            const offsetY = rect?.top ?? 0;

            drag(event.clientX - offsetX, event.clientY - offsetY);
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

    const zoom = (delta: number) => {
        const newIndex = clamp(tileSizeIndex + delta, 0, TILE_SIZES.length - 1);
        setTileSizeIndex(newIndex);
        return TILE_SIZES[newIndex];
    };

    const onMouseWheel = (event: WheelEvent) => {
        const offsetX = event.nativeEvent.offsetX;
        const offsetY = event.nativeEvent.offsetY;

        const deltaX = (offsetX - halfWidth) / tileSize;
        const deltaY = (halfHeight - offsetY) / tileSize;

        const newSize = zoom(-Math.sign(event.deltaY));

        const newDeltaX = (offsetX - halfWidth) / newSize;
        const newDeltaY = (halfHeight - offsetY) / newSize;

        setPos((pos) => {
            return {
                x: clamp(pos.x + deltaX - newDeltaX, 0, MAX_X),
                y: clamp(pos.y + deltaY - newDeltaY, 0, MAX_Y),
            };
        });
    };

    const zoomOut = () => {
        zoom(-1);
    };

    const zoomIn = () => {
        zoom(1);
    };

    const onLocationSelected = useCallback((value: SingleValue<LocationOption>) => {
        if (value) {
            const location = locationsMap[value.value];
            setPos({
                x: location.coords[0],
                y: location.coords[1],
            });
            setTileSizeIndex(TILE_SIZES.indexOf(getTileSize(location.size)));
        }
    }, []);

    const borderWidth = MAX_X * tileSize;
    const borderHeight = MAX_Y * tileSize;

    const borderOffsetX = cameraX * tileSize;
    const borderOffsetY = cameraY * tileSize;

    return (
        <div className="worldmap-container">
            <div className="worldmap" ref={ref}>
                {images}
                {/* <div className=""
                style={{
                    position: "absolute",
                    left: halfWidth - 2,
                    bottom: halfHeight - 2,
                    width: 4,
                    height: 4,
                    backgroundColor: "cyan",
                    // zIndex: 10,
                }}
            ></div> */}
                <div
                    className="worldmap-border"
                    style={{
                        position: "absolute",
                        left: halfWidth - borderOffsetX,
                        bottom: halfHeight - borderOffsetY,
                        width: borderWidth,
                        height: borderHeight,
                    }}
                ></div>
                <div
                    className={`worldmap-drag ${isDragging ? "dragging" : ""}`}
                    onDoubleClick={onDoubleClick}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={stopDragging}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={stopDragging}
                    onWheel={onMouseWheel}
                    onMouseLeave={stopDragging}
                    title="Double click to teleport"
                    ref={dragRef}
                ></div>
            </div>
            <div className="worldmap-footer rs-border rs-background">
                <span className="flex hide-mobile"></span>
                <div className="worldmap-location-select">
                    <OsrsSelect
                        options={locationOptions}
                        onChange={onLocationSelected}
                    ></OsrsSelect>
                </div>
                <span className="worldmap-zoom-buttons flex align-right">
                    <div className="worldmap-zoom-button worldmap-zoom-out" onClick={zoomOut}></div>
                    <div className="worldmap-zoom-button worldmap-zoom-in" onClick={zoomIn}></div>
                </span>
            </div>
        </div>
    );
});
