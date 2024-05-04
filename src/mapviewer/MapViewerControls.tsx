import FileSaver from "file-saver";
import { vec3 } from "gl-matrix";
import { Leva, button, buttonGroup, folder, useControls } from "leva";
import { ButtonGroupOpts, Schema } from "leva/dist/declarations/src/types";
import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DownloadProgress } from "../rs/cache/CacheFiles";
import { isTouchDevice } from "../util/DeviceUtil";
import { lerp, slerp } from "../util/MathUtil";
import { loadCacheFiles } from "./Caches";
import { CameraView, ProjectionType } from "./Camera";
import { MapViewer } from "./MapViewer";
import { MapViewerRenderer } from "./MapViewerRenderer";
import {
    MapViewerRendererType,
    createRenderer,
    getAvailableRenderers,
    getRendererName,
} from "./MapViewerRenderers";
import { fetchNpcSpawns, getNpcSpawnsUrl } from "./data/npc/NpcSpawn";

interface MapViewerControlsProps {
    renderer: MapViewerRenderer;
    hideUi: boolean;
    setRenderer: (renderer: MapViewerRenderer) => void;
    setHideUi: (hideUi: boolean | ((hideUi: boolean) => boolean)) => void;
    setDownloadProgress: (progress: DownloadProgress | undefined) => void;
}

enum VarType {
    VARP = 0,
    VARBIT = 1,
}

export const MapViewerControls = memo(
    ({
        renderer,
        hideUi: hidden,
        setRenderer,
        setHideUi,
        setDownloadProgress,
    }: MapViewerControlsProps): JSX.Element => {
        const mapViewer = renderer.mapViewer;

        const navigate = useNavigate();

        const [projectionType, setProjectionType] = useState<ProjectionType>(
            mapViewer.camera.projectionType,
        );

        const [isExportingSprites, setExportingSprites] = useState(false);
        const [isExportingTextures, setExportingTextures] = useState(false);

        const positionControls = isTouchDevice
            ? "Left joystick, Drag up and down."
            : "WASD,\nR or E (up),\nF or C (down),\nUse SHIFT to go faster, or TAB to go slower.";
        const directionControls = isTouchDevice
            ? "Right joystick."
            : "Arrow Keys or Click and Drag. Double click for pointerlock.";

        const [varType, setVarType] = useState<VarType>(VarType.VARBIT);
        const [varId, setVarId] = useState(0);
        const [varValue, setVarValue] = useState(0);

        const controlsSchema: Schema = {
            Position: { value: positionControls, editable: false },
            Direction: { value: directionControls, editable: false },
        };

        const [animationDuration, setAnimationDuration] = useState(10);
        const [cameraPoints, setCameraPoints] = useState<CameraView[]>(() => []);

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
                    fov: mapViewer.camera.fov,
                    orthoZoom: mapViewer.camera.orthoZoom,
                },
            ]);
        };

        const removeLastPoint = () => {
            setCameraPoints((pts) => pts.slice(0, pts.length - 1));
        };

        useEffect(() => {
            function handleKeyDown(e: KeyboardEvent) {
                if (e.repeat) {
                    return;
                }

                switch (e.key) {
                    case "F1":
                        setHideUi((v) => !v);
                        break;
                    case "F2":
                        setCameraRunning((v) => !v);
                        break;
                    case "F3":
                        addPoint();
                        break;
                    case "F4":
                        removeLastPoint();
                        break;
                }
            }

            document.addEventListener("keydown", handleKeyDown);

            return () => {
                document.removeEventListener("keydown", handleKeyDown);
            };
        }, [mapViewer]);

        useEffect(() => {
            setPointControls(
                folder(
                    cameraPoints.reduce((acc: Record<string, any>, v, i) => {
                        const point = v;
                        const buttons: ButtonGroupOpts = {
                            Teleport: () => mapViewer.setCamera(point),
                            Delete: () => setCameraPoints((pts) => pts.filter((_, j) => j !== i)),
                        };
                        acc["Point " + i] = buttonGroup(buttons);
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
                const newView: CameraView = {
                    position: vec3.fromValues(
                        lerp(from.position[0], to.position[0], localProgress),
                        lerp(from.position[1], to.position[1], localProgress),
                        lerp(from.position[2], to.position[2], localProgress),
                    ),
                    pitch: lerp(from.pitch, to.pitch, localProgress),
                    yaw: slerp(from.yaw, to.yaw, localProgress, 2048),
                    fov: lerp(from.fov, to.fov, localProgress),
                    orthoZoom: lerp(from.orthoZoom, to.orthoZoom, localProgress),
                };
                mapViewer.setCamera(newView);

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

        const recordSchema: Schema = {
            "Add point (F3)": button(() => addPoint()),
            "Delete last point (F4)": button(() => removeLastPoint()),
            Length: {
                value: animationDuration,
                onChange: (v: number) => {
                    setAnimationDuration(v);
                },
            },
            Points: pointsControls,
        };

        if (isCameraRunning) {
            const buttonName = "Stop (F2)";
            recordSchema[buttonName] = button(() => setCameraRunning(false));
            recordSchema[buttonName].order = -1;
        } else {
            const buttonName = "Start (F2)";
            recordSchema[buttonName] = button(() => setCameraRunning(true));
            recordSchema[buttonName].order = -1;
        }

        useControls(
            {
                Links: folder(
                    {
                        Editor: button(() => {
                            navigate("/editor");
                        }),
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
                            onChange: (v: ProjectionType) => {
                                mapViewer.camera.setProjectionType(v);
                                setProjectionType(v);
                            },
                            order: 0,
                        },
                        ...createCameraControls(mapViewer),
                        Speed: {
                            value: mapViewer.cameraSpeed,
                            min: 0.1,
                            max: 5,
                            step: 0.1,
                            onChange: (v: number) => {
                                mapViewer.cameraSpeed = v;
                            },
                            order: 10,
                        },
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
                            onChange: (v: number) => {
                                mapViewer.renderDistance = v;
                            },
                        },
                        Unload: {
                            value: mapViewer.unloadDistance,
                            min: 1,
                            max: 30,
                            step: 1,
                            onChange: (v: number) => {
                                mapViewer.unloadDistance = v;
                            },
                        },
                        Lod: {
                            value: mapViewer.lodDistance,
                            min: 0,
                            max: 30,
                            step: 1,
                            onChange: (v: number) => {
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
                            onChange: async (v: string) => {
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
                            onChange: (v: number) => {
                                renderer.fpsLimit = v;
                            },
                        },
                        ...renderer.getControls(),
                    },
                    { collapsed: true },
                ),
                Vars: folder(
                    {
                        Type: {
                            value: varType,
                            options: {
                                Varplayer: VarType.VARP,
                                Varbit: VarType.VARBIT,
                            },
                            onChange: setVarType,
                        },
                        Id: {
                            value: varId,
                            step: 1,
                            onChange: setVarId,
                        },
                        Value: {
                            value: varValue,
                            step: 1,
                            onChange: setVarValue,
                        },
                        Set: button(() => {
                            const varManager = mapViewer.varManager;
                            let updated = false;
                            if (varType === VarType.VARP) {
                                updated = varManager.setVarp(varId, varValue);
                            } else {
                                updated = varManager.setVarbit(varId, varValue);
                            }
                            if (updated) {
                                mapViewer.updateVars();
                                mapViewer.renderer.mapManager.clearMaps();
                            }
                        }),
                        Clear: button(() => {
                            mapViewer.varManager.clear();
                            mapViewer.updateVars();
                            mapViewer.renderer.mapManager.clearMaps();
                        }),
                    },
                    { collapsed: true },
                ),
                Menu: folder(
                    {
                        Tooltips: {
                            value: mapViewer.tooltips,
                            onChange: (v: boolean) => {
                                mapViewer.tooltips = v;
                            },
                        },
                        "Debug Id": {
                            value: mapViewer.debugId,
                            onChange: (v: boolean) => {
                                mapViewer.debugId = v;
                            },
                        },
                    },
                    { collapsed: true },
                ),
                Record: folder(recordSchema, { collapsed: true }),
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
            [
                renderer,
                projectionType,
                varType,
                varId,
                varValue,
                pointsControls,
                isCameraRunning,
                isExportingSprites,
                isExportingTextures,
            ],
        );

        return (
            <Leva
                titleBar={{ filter: false }}
                collapsed={true}
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
                onChange: (v: number) => {
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
                onChange: (v: number) => {
                    mapViewer.camera.orthoZoom = v;
                },
            },
        };
    }
}
