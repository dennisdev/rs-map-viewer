import { vec3 } from "gl-matrix";
import { Leva, button, buttonGroup, folder, useControls } from "leva";
import { Schema } from "leva/dist/declarations/src/types";
import { memo, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DownloadProgress } from "../client/fs/FileSystem";
import { lerp, slerp } from "../client/util/MathUtil";
import { CacheInfo, loadCache } from "./CacheInfo";
import { AntiAliasType, CameraPosition, MapViewer } from "./MapViewer";
import { isTouchDevice } from "./util/DeviceUtil";
import { ProjectionType } from "./Camera";

interface ColorRgb {
    r: number;
    g: number;
    b: number;
}

interface MapViewerControlsProps {
    mapViewer: MapViewer;
    caches: CacheInfo[];
    setDownloadProgress: (progress: DownloadProgress | undefined) => void;
    hidden: boolean;
}

export const MapViewerControls = memo(function MapViewerControls({
    mapViewer,
    caches,
    setDownloadProgress,
    hidden,
}: MapViewerControlsProps) {
    const [projectionType, setProjectionType] = useState<ProjectionType>(
        mapViewer.camera.projectionType
    );
    const [searchParams, setSearchParams] = useSearchParams();

    const positionControls = isTouchDevice
        ? "Left joystick, Drag up and down."
        : "WASD,\nR or E (up),\nF or C (down),\nUse SHIFT to go faster.";
    const directionControls = isTouchDevice
        ? "Right joystick."
        : "Arrow Keys or Click and Drag.";

    const cameraControlsSchema: Schema = {
        Position: { value: positionControls, editable: false },
        Direction: { value: directionControls, editable: false },
    };

    const [animationDuration, setAnimationDuration] = useState(10);
    const [cameraPoints, setCameraPoints] = useState<CameraPosition[]>(
        () => []
    );
    const addPoint = () => {
        setCameraPoints((pts) => [
            ...pts,
            {
                position: vec3.fromValues(
                    mapViewer.camera.pos[0],
                    mapViewer.camera.pos[1],
                    mapViewer.camera.pos[2]
                ),
                pitch: mapViewer.camera.pitch,
                yaw: mapViewer.camera.yaw,
            },
        ]);
    };

    useEffect(() => {
        setPointControls(
            folder(
                cameraPoints.reduce((acc: Record<string, any>, v, i) => {
                    const point = v;
                    acc["Point " + i] = buttonGroup({
                        Teleport: () => mapViewer.setCamera(point),
                        Delete: () =>
                            setCameraPoints((pts) =>
                                pts.filter((_, j) => j !== i)
                            ),
                    });
                    return acc;
                }, {})
            )
        );
    }, [cameraPoints]);

    const [pointsControls, setPointControls] = useState(folder({}));
    const [isCameraRunning, setCameraRunning] = useState(false);

    useEffect(() => {
        if (!isCameraRunning) {
            return;
        }

        let start: number;
        const segmentCount = cameraPoints.length - 1;
        // Need at least 2 points to start
        if (segmentCount <= 0) {
            setCameraRunning(false);
            return;
        }

        const callback = (timestamp: number) => {
            if (!start) {
                start = timestamp;
            }

            const elapsed = timestamp - start;
            const overallProgress = elapsed / (animationDuration * 1000);

            const startIndex = Math.floor(overallProgress * segmentCount);
            const endIndex = startIndex + 1;
            const from = cameraPoints[startIndex];
            const to = cameraPoints[endIndex];
            const localProgress = (overallProgress * segmentCount) % 1;

            const isComplete = elapsed > animationDuration * 1000;
            if (isComplete) {
                setCameraRunning(false);
                mapViewer.setCamera(cameraPoints[cameraPoints.length - 1]);
                return;
            }
            const newPosition: { position: vec3; pitch: number; yaw: number } =
                {
                    position: vec3.fromValues(
                        lerp(from.position[0], to.position[0], localProgress),
                        lerp(from.position[1], to.position[1], localProgress),
                        lerp(from.position[2], to.position[2], localProgress)
                    ),
                    pitch: lerp(from.pitch, to.pitch, localProgress),
                    yaw: slerp(from.yaw, to.yaw, localProgress, 2048),
                };
            mapViewer.setCamera(newPosition);

            window.requestAnimationFrame(callback);
        };

        window.requestAnimationFrame(callback);
    }, [isCameraRunning]);

    const generateControls = () => ({
        "Camera Controls": folder(cameraControlsSchema, { collapsed: true }),
        Camera: folder(
            {
                Projection: {
                    value: projectionType,
                    options: {
                        Perspective: ProjectionType.PERSPECTIVE,
                        Ortho: ProjectionType.ORTHO,
                    },
                    onChange: (v) => {
                        mapViewer.camera.projectionType = v;
                        setProjectionType(v);
                        setSearchParams(mapViewer.getSearchParams(), {
                            replace: true,
                        });
                    },
                },
                ...createCameraControls(mapViewer),
            },
            { collapsed: true }
        ),
        Distance: folder(
            {
                Render: {
                    value: mapViewer.renderDistance,
                    min: 16,
                    max: 2000,
                    step: 16,
                    onChange: (v) => {
                        mapViewer.renderDistance = v;
                        mapViewer.renderDistanceUpdated = true;
                    },
                },
                Unload: {
                    value: mapViewer.regionUnloadDistance,
                    min: 1,
                    max: 30,
                    step: 1,
                    onChange: (v) => {
                        mapViewer.regionUnloadDistance = v;
                    },
                },
                Lod: {
                    value: mapViewer.regionLodDistance,
                    min: 1,
                    max: 30,
                    step: 1,
                    onChange: (v) => {
                        mapViewer.regionLodDistance = v;
                    },
                },
            },
            { collapsed: false }
        ),
        Cache: folder(
            {
                Version: {
                    value: mapViewer.loadedCache.info.name,
                    options: caches.map((cache) => cache.name),
                    onChange: async (v) => {
                        const cacheInfo = caches.find(
                            (cache) => cache.name === v
                        );
                        if (
                            v !== mapViewer.loadedCache.info.name &&
                            cacheInfo
                        ) {
                            const loadedCache = await loadCache(
                                cacheInfo,
                                setDownloadProgress
                            );
                            mapViewer.initCache(loadedCache);
                            setDownloadProgress(undefined);
                            setSearchParams(mapViewer.getSearchParams(), {
                                replace: true,
                            });
                        }
                    },
                },
            },
            { collapsed: true }
        ),
        Render: folder(
            {
                "Fps Limit": {
                    value: mapViewer.fpsLimit,
                    min: 0,
                    max: 999,
                    onChange: (v) => {
                        mapViewer.fpsLimit = v;
                    },
                },
                Npcs: {
                    value: mapViewer.loadNpcs,
                    onChange: (v) => {
                        mapViewer.setLoadNpcs(v);
                    },
                },
                Items: {
                    value: mapViewer.loadItems,
                    onChange: (v) => {
                        mapViewer.setLoadItems(v);
                    },
                },
                "Max Plane": {
                    value: mapViewer.maxPlane,
                    min: 0,
                    max: 3,
                    step: 1,
                    onChange: (v) => {
                        mapViewer.setMaxPlane(v);
                    },
                },
                Sky: {
                    r: mapViewer.skyColor[0] * 255,
                    g: mapViewer.skyColor[1] * 255,
                    b: mapViewer.skyColor[2] * 255,
                    onChange: (v: ColorRgb) => {
                        mapViewer.setSkyColor(v.r, v.g, v.b);
                    },
                },
                "Fog Depth": {
                    value: mapViewer.fogDepth,
                    min: 0,
                    max: 256,
                    step: 8,
                    onChange: (v) => {
                        mapViewer.fogDepth = v;
                    },
                },
                Brightness: {
                    value: 1,
                    min: 0,
                    max: 4,
                    step: 1,
                    onChange: (v) => {
                        mapViewer.brightness = 1.0 - v * 0.1;
                    },
                },
                "Color Banding": {
                    value: 50,
                    min: 0,
                    max: 100,
                    step: 1,
                    onChange: (v) => {
                        mapViewer.colorBanding = 255 - v * 2;
                    },
                },
                "Anti-Aliasing": {
                    value: mapViewer.antiAliasing,
                    options: {
                        None: AntiAliasType.NONE,
                        FXAA: AntiAliasType.FXAA,
                    },
                    onChange: (v) => {
                        mapViewer.antiAliasing = v;
                    },
                },
                "Depth Map": {
                    value: mapViewer.renderDepthMap,
                    onChange: (v) => {
                        mapViewer.setRenderDepthMap(v);
                    },
                },
                "Depth Map Far": {
                    value: mapViewer.depthMapFar,
                    min: 64,
                    max: 2048,
                    step: 1,
                    onChange: (v) => {
                        mapViewer.depthMapFar = v;
                    },
                },
                "Cull Back-faces": {
                    value: true,
                    onChange: (v) => {
                        mapViewer.cullBackFace = v;
                    },
                },
            },
            { collapsed: true }
        ),
        Misc: folder(
            {
                Tooltips: {
                    value: mapViewer.tooltips,
                    onChange: (v) => {
                        mapViewer.tooltips = v;
                    },
                },
                "Debug Id": {
                    value: mapViewer.debugId,
                    onChange: (v) => {
                        mapViewer.debugId = v;
                    },
                },
            },
            { collapsed: true }
        ),
        Record: folder(
            {
                Start: button(() => setCameraRunning(true)),
                "Add point": button(() => addPoint()),
                Length: {
                    value: animationDuration,
                    onChange: (v) => {
                        setAnimationDuration(v);
                    },
                },
                Points: pointsControls,
            },
            { collapsed: true }
        ),
    });

    useControls(generateControls, [projectionType, pointsControls]);

    useEffect(() => {
        mapViewer.onCameraMoveEnd = (pos, pitch, yaw) => {
            if (!isCameraRunning) {
                setSearchParams(mapViewer.getSearchParams(), { replace: true });
            }
        };
    }, [mapViewer, isCameraRunning]);

    return (
        <Leva
            titleBar={{ filter: false }}
            collapsed={true}
            hideCopyButton={true}
            hidden={hidden}
        />
    );
});

function createCameraControls(mapViewer: MapViewer): Schema {
    if (mapViewer.camera.projectionType === ProjectionType.PERSPECTIVE) {
        return {
            FOV: {
                value: mapViewer.camera.fov,
                min: 30,
                max: 140,
                step: 1,
                onChange: (v) => {
                    mapViewer.camera.fov = v;
                },
            },
        };
    } else {
        return {
            "Ortho Zoom": {
                value: mapViewer.camera.orthoZoom,
                min: 1,
                max: 60,
                step: 1,
                onChange: (v) => {
                    mapViewer.camera.orthoZoom = v;
                    mapViewer.runCameraMoveEndCallback();
                },
            },
        };
    }
}
