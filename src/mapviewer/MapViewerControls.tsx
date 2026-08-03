import FileSaver from "file-saver";
import { vec3 } from "gl-matrix";
import { Leva, button, buttonGroup, folder, useControls } from "leva";
import { ButtonGroupOpts, Schema } from "leva/dist/declarations/src/types";
import { memo, useEffect, useState } from "react";

import { DownloadProgress } from "../rs/cache/CacheFiles";
import { isTouchDevice } from "../util/DeviceUtil";
import { loadCacheFiles } from "./Caches";
import { Camera, CameraView, ProjectionType } from "./Camera";
import { CameraTrack, DurationMode, EasingMode, LoopMode, pingPong } from "./CameraTrack";
import { MapViewer } from "./MapViewer";
import { CameraPathGeometry, MapViewerRenderer } from "./MapViewerRenderer";
import {
    MapViewerRendererType,
    createRenderer,
    getAvailableRenderers,
    getRendererName,
} from "./MapViewerRenderers";
import { createDefaultRecordingConfig } from "./RecordingConfig";
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
        // Tolerate a stale MapViewer instance (e.g. after HMR) that pre-dates the
        // recording field; the sync effect below will (re)create it.
        const recording = mapViewer.recording ?? createDefaultRecordingConfig();

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

        const [varType, setVarType] = useState(VarType.VARBIT);
        const [varId, setVarId] = useState(0);
        const [varValue, setVarValue] = useState(0);

        const controlsSchema: Schema = {
            Position: { value: positionControls, editable: false },
            Direction: { value: directionControls, editable: false },
        };

        const [durationMode, setDurationMode] = useState<DurationMode>(recording.durationMode);
        const [duration, setDuration] = useState(recording.duration);
        const [segmentDurations, setSegmentDurations] = useState<number[]>(() => [
            ...recording.segmentDurations,
        ]);
        const [cameraPoints, setCameraPoints] = useState<CameraView[]>(() => recording.keyframes);
        const [smoothing, setSmoothing] = useState(recording.smoothing);
        const [speed, setSpeed] = useState(recording.speed);
        const [easing, setEasing] = useState<EasingMode>(recording.easing);
        const [loopMode, setLoopMode] = useState<LoopMode>(recording.loopMode);

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

        // Append a copy of the first keyframe to close the rail into a loop.
        const loopToFirst = () => {
            setCameraPoints((pts) => {
                if (pts.length === 0) {
                    return pts;
                }
                const first = pts[0];
                return [
                    ...pts,
                    {
                        position: vec3.clone(first.position),
                        pitch: first.pitch,
                        yaw: first.yaw,
                        fov: first.fov,
                        orthoZoom: first.orthoZoom,
                    },
                ];
            });
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
            const perSegment = durationMode === DurationMode.PER_SEGMENT;
            setPointControls(
                folder(
                    cameraPoints.reduce((acc: Record<string, any>, v, i) => {
                        const point = v;
                        const buttons: ButtonGroupOpts = {
                            Teleport: () => mapViewer.setCamera(point),
                            Replace: () =>
                                setCameraPoints((pts) =>
                                    pts.map((p, j) =>
                                        j === i
                                            ? {
                                                  position: vec3.fromValues(
                                                      mapViewer.camera.pos[0],
                                                      mapViewer.camera.pos[1],
                                                      mapViewer.camera.pos[2],
                                                  ),
                                                  pitch: mapViewer.camera.pitch,
                                                  yaw: mapViewer.camera.yaw,
                                                  fov: mapViewer.camera.fov,
                                                  orthoZoom: mapViewer.camera.orthoZoom,
                                              }
                                            : p,
                                    ),
                                ),
                            Delete: () => setCameraPoints((pts) => pts.filter((_, j) => j !== i)),
                        };
                        acc["#" + i] = buttonGroup(buttons);
                        // In PER_SEGMENT mode, show the duration of the segment
                        // leaving this keyframe (toward the next) inline.
                        if (perSegment && i < cameraPoints.length - 1) {
                            acc["Duration " + i + "→" + (i + 1)] = {
                                value: segmentDurations[i] ?? 2,
                                min: 0.1,
                                step: 0.1,
                                onChange: (val: number) => {
                                    setSegmentDurations((prev) => {
                                        const next = [...prev];
                                        next[i] = val;
                                        return next;
                                    });
                                },
                            };
                        }
                        return acc;
                    }, {}),
                ),
            );
            // NOTE: segmentDurations is intentionally not a dependency — including
            // it would rebuild the inputs on every keystroke and drop focus.
            // Leva holds each input's value internally; segmentDurations stays in
            // sync via onChange, and structural rebuilds pick up current values.
        }, [mapViewer, cameraPoints, durationMode]);

        const [pointsControls, setPointControls] = useState(folder({}));
        const [isCameraRunning, setCameraRunning] = useState(false);

        useEffect(() => {
            if (!isCameraRunning) {
                return;
            }

            // Need at least 2 keyframes to form a rail segment.
            if (cameraPoints.length < 2) {
                setCameraRunning(false);
                return;
            }

            const track = new CameraTrack(cameraPoints, {
                smoothing,
                easing,
                durationMode,
                segmentDurations,
            });
            const totalDuration =
                durationMode === DurationMode.PER_SEGMENT ? track.totalSegmentDuration : duration;
            const durationMs = ((totalDuration || 0.1) * 1000) / speed;

            let animationId = -1;
            let start: number;

            const animate = (time: DOMHighResTimeStamp) => {
                if (start === undefined) {
                    start = time;
                }

                const elapsed = time - start;
                let t = elapsed / durationMs;

                if (loopMode === LoopMode.ONCE) {
                    if (t >= 1) {
                        setCameraRunning(false);
                        mapViewer.setCamera(cameraPoints[cameraPoints.length - 1]);
                        return;
                    }
                } else if (loopMode === LoopMode.LOOP) {
                    t = t % 1;
                } else {
                    t = pingPong(t);
                }

                mapViewer.setCamera(track.evaluate(t));
                animationId = requestAnimationFrame(animate);
            };

            // Start animating
            animationId = requestAnimationFrame(animate);

            return () => {
                cancelAnimationFrame(animationId);
            };
        }, [
            mapViewer,
            cameraPoints,
            duration,
            isCameraRunning,
            smoothing,
            easing,
            durationMode,
            segmentDurations,
            speed,
            loopMode,
        ]);

        // Push the rail geometry (sampled path + speed-correlated dot trail +
        // keyframe markers + aim indicators) to the renderer. The dot trail
        // depends on the timing model, so this rebuilds on timing changes too.
        useEffect(() => {
            const geometry: CameraPathGeometry = buildPathGeometry(cameraPoints, {
                smoothing,
                easing,
                durationMode,
                segmentDurations,
            });
            mapViewer.renderer.setCameraPath(geometry);
        }, [mapViewer, renderer, cameraPoints, smoothing, easing, durationMode, segmentDurations]);

        // Only show the rail overlay while playback is paused.
        useEffect(() => {
            mapViewer.renderer.setCameraPathVisible(!isCameraRunning);
        }, [mapViewer, renderer, isCameraRunning]);

        // Persist recording state to the URL whenever it changes.
        useEffect(() => {
            mapViewer.recording = {
                durationMode,
                duration,
                segmentDurations,
                smoothing,
                easing,
                loopMode,
                speed,
                keyframes: cameraPoints,
            };
            mapViewer.updateSearchParams();
        }, [
            mapViewer,
            durationMode,
            duration,
            segmentDurations,
            smoothing,
            easing,
            loopMode,
            speed,
            cameraPoints,
        ]);

        // Keep the per-segment durations array aligned to the keyframe count.
        useEffect(() => {
            const needed = Math.max(0, cameraPoints.length - 1);
            setSegmentDurations((prev) => {
                if (prev.length === needed) {
                    return prev;
                }
                const next = prev.slice(0, needed);
                while (next.length < needed) {
                    next.push(2);
                }
                return next;
            });
        }, [cameraPoints]);

        const rendererOptions: Record<string, MapViewerRendererType> = {};
        for (let v of getAvailableRenderers()) {
            rendererOptions[getRendererName(v)] = v;
        }

        const recordSchema: Schema = {
            "Add Keyframe (F3)": button(() => addPoint()),
            "Loop to First": button(() => loopToFirst()),
            "Delete Last (F4)": button(() => removeLastPoint()),
            "Duration Mode": {
                value: durationMode,
                options: {
                    "Total (Even)": DurationMode.TOTAL_EVEN,
                    "Total (Distance)": DurationMode.TOTAL_DISTANCE,
                    "Per Segment": DurationMode.PER_SEGMENT,
                },
                onChange: (v: DurationMode) => {
                    setDurationMode(v);
                },
            },
            Duration: {
                value: duration,
                min: 0.1,
                step: 0.1,
                onChange: (v: number) => {
                    setDuration(v);
                },
            },
            Speed: {
                value: speed,
                min: 0.1,
                max: 4,
                step: 0.1,
                onChange: (v: number) => {
                    setSpeed(v);
                },
            },
            Smoothing: {
                value: smoothing,
                min: 0,
                max: 1,
                step: 0.01,
                onChange: (v: number) => {
                    setSmoothing(v);
                },
            },
            Easing: {
                value: easing,
                options: {
                    Linear: EasingMode.LINEAR,
                    "Ease In/Out": EasingMode.EASE_IN_OUT,
                    "Ease In": EasingMode.EASE_IN,
                    "Ease Out": EasingMode.EASE_OUT,
                },
                onChange: (v: EasingMode) => {
                    setEasing(v);
                },
            },
            Loop: {
                value: loopMode,
                options: {
                    Once: LoopMode.ONCE,
                    Loop: LoopMode.LOOP,
                    "Ping-Pong": LoopMode.PINGPONG,
                },
                onChange: (v: LoopMode) => {
                    setLoopMode(v);
                },
            },
            Keyframes: pointsControls,
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
                        GitHub: button(() => {
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
                durationMode,
                duration,
                smoothing,
                easing,
                speed,
                loopMode,
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

/**
 * Build the world-space overlay geometry for a rail:
 *  - `path`: the smooth curve (spatially sampled) drawn as a line strip.
 *  - `dots`: positions sampled at equal *time* intervals across the recording,
 *    so dot density correlates with camera speed (slow zones bunch up).
 *  - `keyframes`/`aims`: markers and short aim indicators per keyframe.
 */
function buildPathGeometry(
    keyframes: CameraView[],
    options: {
        smoothing: number;
        easing: EasingMode;
        durationMode: DurationMode;
        segmentDurations: number[];
    },
): CameraPathGeometry {
    const pathTrack = new CameraTrack(keyframes, { smoothing: options.smoothing });
    const path = keyframes.length >= 2 ? pathTrack.samplePath(160) : new Float32Array(0);

    // Time-sampled dot trail: where the camera spends more time, dots bunch up.
    const dotCount = 120;
    const dots = new Float32Array(dotCount * 3);
    if (keyframes.length >= 2) {
        const timingTrack = new CameraTrack(keyframes, options);
        for (let i = 0; i < dotCount; i++) {
            const t = i / (dotCount - 1);
            const p = timingTrack.evaluate(t).position;
            dots[i * 3] = p[0];
            dots[i * 3 + 1] = p[1];
            dots[i * 3 + 2] = p[2];
        }
    }

    const keyframePositions = new Float32Array(keyframes.length * 3);
    for (let i = 0; i < keyframes.length; i++) {
        const p = keyframes[i].position;
        keyframePositions[i * 3] = p[0];
        keyframePositions[i * 3 + 1] = p[1];
        keyframePositions[i * 3 + 2] = p[2];
    }

    // Hardcoded short aim indicator length in world units (at most 2 units).
    const aimLen = 2;

    const aims = new Float32Array(keyframes.length * 6);
    const dir = vec3.create();
    for (let i = 0; i < keyframes.length; i++) {
        const kf = keyframes[i];
        const p = kf.position;
        Camera.getDirection(kf.pitch, kf.yaw, dir);
        aims[i * 6] = p[0];
        aims[i * 6 + 1] = p[1];
        aims[i * 6 + 2] = p[2];
        aims[i * 6 + 3] = p[0] + dir[0] * aimLen;
        aims[i * 6 + 4] = p[1] + dir[1] * aimLen;
        aims[i * 6 + 5] = p[2] + dir[2] * aimLen;
    }

    return { path, dots, keyframes: keyframePositions, aims };
}
