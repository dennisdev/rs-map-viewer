import {
    memo,
    useRef,
    useState,
    useCallback,
    MouseEvent,
    WheelEvent,
    TouchEvent,
    useLayoutEffect,
} from "react";
import "./WorldMap.css";
import { useElementSize } from "usehooks-ts";
import { RegionLoader } from "../../client/RegionLoader";
import { clamp } from "../../client/util/MathUtil";
import { OsrsSelect } from "../select/OsrsSelect";
import { SingleValue } from "react-select";
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

export interface WorldMapProps {
    onDoubleClick: (x: number, y: number) => void;

    getPosition: () => Position;
    loadMapImageUrl: (regionX: number, regionY: number) => string | undefined;
}

export const WorldMap = memo(function WorldMap(props: WorldMapProps) {
    const { getPosition, loadMapImageUrl } = props;

    const [ref, dimensions] = useElementSize();
    const dragRef = useRef<HTMLDivElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);

    const [pos, setPos] = useState(getPosition);
    const [tileSize, setTileSize] = useState(3);

    const [images, setImages] = useState<JSX.Element[]>([]);

    const requestRef = useRef<number | undefined>();

    const cameraX = pos.x | 0;
    const cameraY = pos.y | 0;

    const halfWidth = (dimensions.width / 2) | 0;
    const halfHeight = (dimensions.height / 2) | 0;

    const animate = (time: DOMHighResTimeStamp) => {
        // console.log("animate world map", time, tileSize, pos);

        // const tileSize = 3;
        const halfTileSize = tileSize / 2;
        const imageSize = 64 * tileSize;

        const regionX = pos.x >> 6;
        const regionY = pos.y >> 6;

        // console.log(dimensions)

        const x = halfWidth - (cameraX % 64) * tileSize - halfTileSize;
        const y = halfHeight - (cameraY % 64) * tileSize - halfTileSize;

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
        setStartX(startX);
        setStartY(startY);
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
        const deltaX = (startX - x) / tileSize;
        const deltaY = (y - startY) / tileSize;

        setStartX(x);
        setStartY(y);
        setPos((pos) => {
            return {
                x: pos.x + deltaX,
                y: pos.y + deltaY,
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
        const newSize = clamp((tileSize + delta) | 0, 0.5, 10);
        setTileSize(newSize);
        return newSize;
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
                x: pos.x + deltaX - newDeltaX,
                y: pos.y + deltaY - newDeltaY,
            };
        });
    };

    const zoomOut = () => {
        zoom(-1);
    };

    const zoomIn = () => {
        zoom(1);
    };

    const onLocationSelected = useCallback(
        (value: SingleValue<LocationOption>) => {
            if (value) {
                const location = locationsMap[value.value];
                setPos({
                    x: location.coords[0],
                    y: location.coords[1],
                });
                setTileSize(getTileSize(location.size));
            }
        },
        []
    );

    return (
        <div className="worldmap-container">
            <div className="worldmap" ref={ref}>
                {images}
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
            <div className="worldmap-footer rs-border rs-background">
                <span className="flex hide-mobile"></span>
                <div className="worldmap-location-select">
                    <OsrsSelect
                        options={locationOptions}
                        onChange={onLocationSelected}
                    ></OsrsSelect>
                </div>
                <span className="worldmap-zoom-buttons flex align-right">
                    <div
                        className="worldmap-zoom-button worldmap-zoom-out"
                        onClick={zoomOut}
                    ></div>
                    <div
                        className="worldmap-zoom-button worldmap-zoom-in"
                        onClick={zoomIn}
                    ></div>
                </span>
            </div>
        </div>
    );
});
