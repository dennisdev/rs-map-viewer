import { useCallback, useEffect, useRef, useState } from "react";
import { Joystick } from "react-joystick-component";
import { useSearchParams } from "react-router-dom";

import { RendererCanvas } from "../components/renderer/RendererCanvas";
import { OsrsLoadingBar } from "../components/rs/loading/OsrsLoadingBar";
import { OsrsMenu, OsrsMenuProps } from "../components/rs/menu/OsrsMenu";
import { MinimapContainer } from "../components/rs/minimap/MinimapContainer";
import { WorldMapModal } from "../components/rs/worldmap/WorldMapModal";
import { RS_TO_DEGREES } from "../rs/MathConstants";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { formatBytes } from "../util/BytesUtil";
import { isTouchDevice } from "../util/DeviceUtil";
import { MapViewer } from "./MapViewer";
import "./MapViewerContainer.css";
import { MapViewerControls } from "./MapViewerControls";
import { MapViewerRenderer } from "./MapViewerRenderer";

interface MapViewerContainerProps {
    mapViewer: MapViewer;
}

export function MapViewerContainer({ mapViewer }: MapViewerContainerProps): JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();

    const [renderer, setRenderer] = useState<MapViewerRenderer>(mapViewer.renderer);

    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();

    const [hudVisible, setHudVisible] = useState(mapViewer.hudVisible);
    const [fps, setFps] = useState(0);
    const [cameraYaw, setCameraYaw] = useState(mapViewer.camera.getYaw());
    const [isWorldMapOpen, setWorldMapOpen] = useState<boolean>(false);

    const [menuProps, setMenuProps] = useState<OsrsMenuProps | undefined>(undefined);

    const requestRef = useRef<number | undefined>();

    const animate = (time: DOMHighResTimeStamp) => {
        // Wait for 200ms before updating search params
        if (
            mapViewer.needsSearchParamUpdate &&
            performance.now() - mapViewer.lastTimeSearchParamsUpdated > 200
        ) {
            setSearchParams(mapViewer.getSearchParams(), { replace: true });
            mapViewer.needsSearchParamUpdate = false;
            console.log("Updated search params");
        }

        setHudVisible(mapViewer.hudVisible);
        if (mapViewer.hudVisible) {
            setFps(Math.round(renderer.stats.frameTimeFps));
            setCameraYaw(mapViewer.camera.getYaw());
        }

        if (mapViewer.menuEntries.length > 0 && mapViewer.menuX !== -1 && mapViewer.menuY !== -1) {
            setMenuProps({
                x: mapViewer.menuX,
                y: mapViewer.menuY,
                tooltip: !mapViewer.menuOpen,
                entries: mapViewer.menuEntries,
                debugId: mapViewer.debugId,
            });
        } else {
            setMenuProps(undefined);
        }

        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [searchParams]);

    const resetCameraYaw = useCallback(() => {
        mapViewer.camera.setYaw(0);
    }, [mapViewer]);

    const openWorldMap = useCallback(() => {
        setWorldMapOpen(true);
    }, []);

    const closeWorldMap = useCallback(() => {
        setWorldMapOpen(false);
        renderer.canvas.focus();
    }, [renderer]);

    const onMapClicked = useCallback(
        (x: number, y: number) => {
            mapViewer.camera.pos[0] = x;
            mapViewer.camera.pos[2] = y;
            mapViewer.camera.updated = true;
            closeWorldMap();
        },
        [mapViewer, closeWorldMap],
    );

    const getMapPosition = useCallback(() => {
        const x = mapViewer.camera.getPosX();
        const y = mapViewer.camera.getPosZ();

        return {
            x,
            y,
        };
    }, [mapViewer]);

    const loadMapImageUrl = useCallback(
        (mapX: number, mapY: number) => {
            return mapViewer.getMapImageUrl(mapX, mapY, false);
        },
        [mapViewer],
    );

    const loadMinimapImageUrl = useCallback(
        (mapX: number, mapY: number) => {
            return mapViewer.getMapImageUrl(mapX, mapY, true);
        },
        [mapViewer],
    );

    let loadingBarOverlay: JSX.Element | undefined = undefined;
    if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress = ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        loadingBarOverlay = (
            <div className="overlay-container max-height">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    }

    return (
        <div className="mapviewer-container max-height">
            {loadingBarOverlay}

            {menuProps && <OsrsMenu {...menuProps} />}

            <MapViewerControls
                renderer={renderer}
                setRenderer={setRenderer}
                setDownloadProgress={setDownloadProgress}
                hidden={!hudVisible}
            />

            {hudVisible && (
                <span>
                    <div className="hud left-top">
                        <MinimapContainer
                            yawDegrees={(2047 - cameraYaw) * RS_TO_DEGREES}
                            onCompassClick={resetCameraYaw}
                            onWorldMapClick={openWorldMap}
                            getPosition={getMapPosition}
                            loadMapImageUrl={loadMinimapImageUrl}
                        />

                        <div className="fps-counter content-text">{fps}</div>
                        <div className="fps-counter content-text">{mapViewer.debugText}</div>
                    </div>
                    <WorldMapModal
                        isOpen={isWorldMapOpen}
                        onRequestClose={closeWorldMap}
                        onDoubleClick={onMapClicked}
                        getPosition={getMapPosition}
                        loadMapImageUrl={loadMapImageUrl}
                    />
                </span>
            )}

            {hudVisible && isTouchDevice && (
                <div className="joystick-container left">
                    <Joystick
                        size={75}
                        baseColor="#181C20"
                        stickColor="#007BFF"
                        stickSize={40}
                        move={mapViewer.inputManager.onPositionJoystickMove}
                        stop={mapViewer.inputManager.onPositionJoystickStop}
                    ></Joystick>
                </div>
            )}
            {hudVisible && isTouchDevice && (
                <div className="joystick-container right">
                    <Joystick
                        size={75}
                        baseColor="#181C20"
                        stickColor="#007BFF"
                        stickSize={40}
                        move={mapViewer.inputManager.onCameraJoystickMove}
                        stop={mapViewer.inputManager.onCameraJoystickStop}
                    ></Joystick>
                </div>
            )}

            <RendererCanvas renderer={renderer} />
        </div>
    );
}
