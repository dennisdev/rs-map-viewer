import { useEffect, useState } from "react";
import { Joystick } from "react-joystick-component";
import { DownloadProgress } from "../client/fs/FileSystem";
import { OsrsLoadingBar } from "../components/OsrsLoadingBar";
import { OsrsMenu, OsrsMenuProps } from "../components/OsrsMenu";
import { MinimapContainer } from "../components/minimap/MinimapContainer";
import { WorldMapModal } from "../components/worldmap/WorldMapModal";
import { MapViewer } from "./MapViewer";
import { MapViewerControls } from "./MapViewerControls";
import { RS_TO_DEGREES } from "./MathConstants";
import { formatBytes } from "./util/BytesUtil";
import { isTouchDevice, isWallpaperEngine } from "./util/DeviceUtil";
import WebGLCanvas from "../components/Canvas";
import "./MapViewerContainer.css";
import { CacheInfo } from "../client/fs/Types";

interface MapViewerContainerProps {
    mapViewer: MapViewer;
    caches: CacheInfo[];
}

export function MapViewerContainer({
    mapViewer,
    caches,
}: MapViewerContainerProps) {
    const [inited, setInited] = useState<boolean>(
        !!mapViewer.textureUniformBuffer
    );
    const [downloadProgress, setDownloadProgress] = useState<
        DownloadProgress | undefined
    >(undefined);
    const [fps, setFps] = useState<number>(0);
    const [compassDegrees, setCompassDegrees] = useState<number>(0);
    const [menuProps, setMenuProps] = useState<OsrsMenuProps | undefined>(
        undefined
    );
    const [hudHidden, setHudHidden] = useState<boolean>(isWallpaperEngine);
    const [isWorldMapOpen, setWorldMapOpen] = useState<boolean>(false);

    useEffect(() => {
        mapViewer.onInit = () => {
            setInited(true);
        };
        if (mapViewer.textureUniformBuffer) {
            setInited(true);
        }
        mapViewer.onMouseMoved = (x, y) => {
            setMenuProps((props) => {
                if (!props) {
                    return undefined;
                }
                if (!props.tooltip) {
                    return props;
                }
                return {
                    ...props,
                    x,
                    y,
                };
            });
        };
        mapViewer.onMenuOpened = (x, y, options, tooltip, debugId) => {
            setMenuProps({ x, y, options, tooltip, debugId });
        };
        mapViewer.onMenuClosed = () => {
            setMenuProps(undefined);
        };
        mapViewer.hudHidden = hudHidden;
        mapViewer.setHudHidden = setHudHidden;

        const callback = (time: number) => {
            if (!mapViewer.hudHidden) {
                setFps(mapViewer.fps);
                setCompassDegrees(
                    (mapViewer.camera.yaw & 2047) * RS_TO_DEGREES
                );
            }

            window.requestAnimationFrame(callback);
        };
        window.requestAnimationFrame(callback);
    }, [mapViewer]);

    function openWorldMap() {
        setWorldMapOpen(true);
    }

    function closeWorldMap() {
        setWorldMapOpen(false);
        mapViewer.app.canvas.focus();
    }

    function getMapPosition() {
        const cameraX = mapViewer.camera.getPosX();
        const cameraY = mapViewer.camera.getPosZ();

        return {
            x: cameraX,
            y: cameraY,
        };
    }

    function onMapClicked(x: number, y: number) {
        mapViewer.camera.pos[0] = x;
        mapViewer.camera.pos[2] = y;
        mapViewer.camera.updated = true;
        closeWorldMap();
    }

    function loadMapImageUrl(regionX: number, regionY: number) {
        return mapViewer.getMinimapUrl(regionX, regionY);
    }

    let loadingBarOverlay: JSX.Element | undefined = undefined;
    if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress =
            ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        loadingBarOverlay = (
            <div className="overlay-container">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    }

    return (
        <div>
            {loadingBarOverlay}
            {menuProps && <OsrsMenu {...menuProps} />}
            {inited && (
                <MapViewerControls
                    mapViewer={mapViewer}
                    caches={caches}
                    setDownloadProgress={setDownloadProgress}
                    hidden={hudHidden}
                />
            )}
            {!hudHidden && (
                <span>
                    <div className="hud left-top">
                        <MinimapContainer
                            yawDegrees={compassDegrees}
                            onCompassClick={() => {
                                mapViewer.camera.setYaw(0);
                            }}
                            onWorldMapClick={openWorldMap}
                            getPosition={getMapPosition}
                            loadMapImageUrl={loadMapImageUrl}
                        />

                        <div className="fps-counter content-text">
                            {fps.toFixed(1)}
                        </div>
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
            {isTouchDevice && (
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
            {isTouchDevice && (
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

            <WebGLCanvas
                init={mapViewer.init}
                draw={mapViewer.render}
            ></WebGLCanvas>
        </div>
    );
}
