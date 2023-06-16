import { useLayoutEffect, useRef, useState, RefObject } from "react";
import "./WorldMap.css";
import { useElementSize } from "usehooks-ts";
import { RegionLoader } from "../../client/RegionLoader";

interface Position {
    x: number;
    y: number;
}

export interface WorldMapProps {
    getPosition: () => Position;

    loadMapImageUrl: (regionX: number, regionY: number) => string;
}

export function WorldMap({ getPosition, loadMapImageUrl }: WorldMapProps) {
    const [ref, dimensions] = useElementSize();

    // const pos: Position = {
    //     x: 3222,
    //     y: 3222,
    // };

    const pos = getPosition();

    const cameraX = pos.x;
    const cameraY = pos.y;

    const regionX = pos.x >> 6;
    const regionY = pos.y >> 6;

    // console.log(dimensions)

    const halfWidth = (dimensions.width / 2) | 0;
    const halfHeight = (dimensions.height / 2) | 0;

    const x = halfWidth - (cameraX % 64) * 4 - 2;
    const y = halfHeight - (cameraY % 64) * 4 - 2;

    const renderStartX = -Math.ceil(x / 256);
    const renderStartY = -Math.ceil(y / 256);

    const renderEndX = Math.ceil((dimensions.width - x) / 256);
    const renderEndY = Math.ceil((dimensions.height - y) / 256);

    const images: JSX.Element[] = [];

    // console.log(x, y, renderStartX, renderStartY, renderEndX, renderEndY, regionX, regionY, dimensions.width, dimensions.height)

    // console.log(x, y, renderStartX, renderEndX);

    for (let rx = renderStartX; rx < renderEndX; rx++) {
        for (let ry = renderStartY; ry < renderEndY; ry++) {
            const imageRegionX = regionX + rx;
            const imageRegionY = regionY + ry;
            const regionId = RegionLoader.getRegionId(
                imageRegionX,
                imageRegionY
            );
            images.push(
                <img
                    key={regionId}
                    className={`worldmap-image ${imageRegionX}_${imageRegionY}`}
                    src={loadMapImageUrl(imageRegionX, imageRegionY)}
                    style={{
                        left: x + rx * 256,
                        bottom: y + ry * 256,
                    }}
                />
            );
        }
    }

    return (
        <div className="worldmap" ref={ref}>
            {/* <img className="worldmap-image" src="/0_50_50.png" style={{
                left: x,
                bottom: y
            }} /> */}
            {images}
            <div
                style={{
                    position: "absolute",
                    left: halfWidth - 2,
                    bottom: halfHeight - 2,
                    width: 4,
                    height: 4,
                    backgroundColor: "cyan",
                    zIndex: 10,
                }}
            ></div>
        </div>
    );
}
