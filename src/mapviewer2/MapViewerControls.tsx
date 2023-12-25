import { useEffect, useState, memo } from "react";
import { MapViewerRenderer } from "./MapViewerRenderer";
import { Leva, button, buttonGroup, folder, useControls } from "leva";
import {
    MapViewerRendererType,
    createRenderer,
    getAvailableRenderers,
    getRendererName,
} from "./MapViewerRenderers";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { loadCacheFiles } from "../mapviewer/Caches";
import { fetchNpcSpawns, getNpcSpawnsUrl } from "../mapviewer/data/npc/NpcSpawn";
import { CameraPosition, ProjectionType } from "../mapviewer/Camera";
import { isTouchDevice } from "../util/DeviceUtil";
import { Schema } from "leva/dist/declarations/src/types";
import { MapViewer } from "./MapViewer";
import FileSaver from "file-saver";
import { vec3 } from "gl-matrix";
import { lerp, slerp } from "../util/MathUtil";

interface MapViewerControlsProps {
    renderer: MapViewerRenderer;
    setRenderer: (renderer: MapViewerRenderer) => void;
    setDownloadProgress: (progress: DownloadProgress | undefined) => void;
    hidden: boolean;
}

export const MapViewerControls = memo(
    ({
        renderer,
        setRenderer,
        setDownloadProgress,
        hidden,
    }: MapViewerControlsProps): JSX.Element => {
        const mapViewer = renderer.mapViewer;

        const [projectionType, setProjectionType] = useState<ProjectionType>(
            mapViewer.camera.projectionType,
        );

        const [isExportingSprites, setExportingSprites] = useState(false);
        const [isExportingTextures, setExportingTextures] = useState(false);

        const positionControls = isTouchDevice
            ? "Left joystick, Drag up and down."
            : "WASD,\nR or E (up),\nF or C (down),\nUse SHIFT to go faster.";
        const directionControls = isTouchDevice
            ? "Right joystick."
            : "Arrow Keys or Click and Drag. Double click for pointerlock.";

        const controlsSchema: Schema = {
            Position: { value: positionControls, editable: false },
            Direction: { value: directionControls, editable: false },
        };

        const [animationDuration, setAnimationDuration] = useState(10);
        const [cameraPoints, setCameraPoints] = useState<CameraPosition[]>(() => []);

        const addPoint = () => {
            setCameraPoints((pts) => [
                ...pts,
                {
                    position: vec3.fromValues(
                        mapViewer.camera.pos[0],
                        mapViewer.camera.pos[1],
                        mapViewer.camera.pos[2],
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
                            Delete: () => setCameraPoints((pts) => pts.filter((_, j) => j !== i)),
                        });
                        return acc;
                    }, {}),
                ),
            );
        }, [mapViewer, cameraPoints]);

        const [pointsControls, setPointControls] = useState(folder({}));
        const [isCameraRunning, setCameraRunning] = useState(false);

        useEffect(() => {
            if (!isCameraRunning) {
                return;
            }

            const segmentCount = cameraPoints.length - 1;
            // Need at least 2 points to start
            if (segmentCount <= 0) {
                setCameraRunning(false);
                return;
            }

            let animationId = -1;

            let start: number;
            const animate = (time: DOMHighResTimeStamp) => {
                if (!start) {
                    start = time;
                }

                const elapsed = time - start;
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
                const newPosition: { position: vec3; pitch: number; yaw: number } = {
                    position: vec3.fromValues(
                        lerp(from.position[0], to.position[0], localProgress),
                        lerp(from.position[1], to.position[1], localProgress),
                        lerp(from.position[2], to.position[2], localProgress),
                    ),
                    pitch: lerp(from.pitch, to.pitch, localProgress),
                    yaw: slerp(from.yaw, to.yaw, localProgress, 2048),
                };
                mapViewer.setCamera(newPosition);

                animationId = requestAnimationFrame(animate);
            };

            // Start animating
            animationId = requestAnimationFrame(animate);

            return () => {
                cancelAnimationFrame(animationId);
            };
        }, [mapViewer, cameraPoints, animationDuration, isCameraRunning]);

        const rendererOptions: Record<string, MapViewerRendererType> = {};
        for (let v of getAvailableRenderers()) {
            rendererOptions[getRendererName(v)] = v;
        }

        useControls(
            {
                Links: folder(
                    {
                        Github: button(() => {
                            window.open("https://github.com/dennisdev/rs-map-viewer", "_blank");
                        }),
                    },
                    { collapsed: true },
                ),
                Camera: folder(
                    {
                        Projection: {
                            value: projectionType,
                            options: {
                                Perspective: ProjectionType.PERSPECTIVE,
                                Ortho: ProjectionType.ORTHO,
                            },
                            onChange: (v) => {
                                mapViewer.camera.setProjectionType(v);
                                setProjectionType(v);
                            },
                            order: 0,
                        },
                        ...createCameraControls(mapViewer),
                        Controls: folder(controlsSchema, { collapsed: true, order: 999 }),
                    },
                    { collapsed: false },
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
                            },
                        },
                        Unload: {
                            value: mapViewer.unloadDistance,
                            min: 1,
                            max: 30,
                            step: 1,
                            onChange: (v) => {
                                mapViewer.unloadDistance = v;
                            },
                        },
                        Lod: {
                            value: mapViewer.lodDistance,
                            min: 0,
                            max: 30,
                            step: 1,
                            onChange: (v) => {
                                mapViewer.lodDistance = v;
                            },
                        },
                    },
                    { collapsed: false },
                ),
                Cache: folder(
                    {
                        Version: {
                            value: mapViewer.loadedCache.info.name,
                            options: mapViewer.cacheList.caches.map((cache) => cache.name),
                            onChange: async (v) => {
                                const cacheInfo = mapViewer.cacheList.caches.find(
                                    (cache) => cache.name === v,
                                );
                                if (v !== mapViewer.loadedCache.info.name && cacheInfo) {
                                    const [loadedCache, npcSpawns] = await Promise.all([
                                        loadCacheFiles(cacheInfo, undefined, setDownloadProgress),
                                        fetchNpcSpawns(getNpcSpawnsUrl(cacheInfo)),
                                    ]);
                                    mapViewer.npcSpawns = npcSpawns;
                                    mapViewer.initCache(loadedCache);
                                    setDownloadProgress(undefined);
                                }
                            },
                        },
                    },
                    { collapsed: true },
                ),
                Render: folder(
                    {
                        Renderer: {
                            value: renderer.type,
                            options: rendererOptions,
                            onChange: (v: MapViewerRendererType) => {
                                if (renderer.type !== v) {
                                    const renderer = createRenderer(v, mapViewer);
                                    mapViewer.setRenderer(renderer);
                                    setRenderer(renderer);
                                }
                            },
                        },
                        "Fps Limit": {
                            value: renderer.fpsLimit,
                            min: 1,
                            max: 999,
                            onChange: (v) => {
                                renderer.fpsLimit = v;
                            },
                        },
                        ...renderer.getControls(),
                    },
                    { collapsed: true },
                ),
                Menu: folder(
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
                    { collapsed: true },
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
                    { collapsed: true },
                ),
                Export: folder(
                    {
                        "Export Sprites": button(
                            () => {
                                if (isExportingSprites) {
                                    return;
                                }
                                setExportingSprites(true);
                                mapViewer.workerPool
                                    .exportSprites()
                                    .then((zipBlob) => {
                                        FileSaver.saveAs(
                                            zipBlob,
                                            `sprites_${mapViewer.loadedCache.info.name}.zip`,
                                        );
                                    })
                                    .finally(() => {
                                        setExportingSprites(false);
                                    });
                            },
                            { disabled: isExportingSprites },
                        ),
                        "Export Textures": button(
                            () => {
                                if (isExportingTextures) {
                                    return;
                                }
                                setExportingTextures(true);
                                mapViewer.workerPool
                                    .exportTextures()
                                    .then((zipBlob) => {
                                        FileSaver.saveAs(
                                            zipBlob,
                                            `textures_${mapViewer.loadedCache.info.name}.zip`,
                                        );
                                    })
                                    .finally(() => {
                                        setExportingTextures(false);
                                    });
                            },
                            { disabled: isExportingTextures },
                        ),
                    },
                    { collapsed: true },
                ),
            },
            [renderer, projectionType, pointsControls, isExportingSprites, isExportingTextures],
        );

        return (
            <Leva
                titleBar={{ filter: false }}
                collapsed={false}
                hideCopyButton={true}
                hidden={hidden}
            />
        );
    },
);

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
                },
            },
        };
    }
}
