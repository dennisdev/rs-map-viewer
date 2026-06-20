import { useCallback, useEffect, useRef, useState } from "react";
import { Joystick } from "react-joystick-component";
import { useSearchParams } from "react-router-dom";

import { RendererCanvas } from "../components/renderer/RendererCanvas";
import { OsrsLoadingBar } from "../components/rs/loading/OsrsLoadingBar";
import { OsrsMenu, OsrsMenuProps } from "../components/rs/menu/OsrsMenu";
import { MinimapContainer } from "../components/rs/minimap/MinimapContainer";
import { MusicLibraryModal } from "../components/rs/music/MusicLibraryModal";
import { MusicPlayer } from "../components/rs/music/MusicPlayer";
import { WorldMapModal } from "../components/rs/worldmap/WorldMapModal";
import { RS_TO_DEGREES } from "../rs/MathConstants";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { formatBytes } from "../util/BytesUtil";
import { isTouchDevice } from "../util/DeviceUtil";
import { MapViewer } from "./MapViewer";
import "./MapViewerContainer.css";
import { MapViewerControls } from "./MapViewerControls";
import { MapViewerRenderer } from "./MapViewerRenderer";
import { MusicMode, MusicSettings, MusicSettingsState } from "./music/MusicSettings";
import { MusicEntry, MusicTrackIndex } from "./music/MusicTrackIndex";
import { WikiMusicService } from "./music/WikiMusicService";

interface MapViewerContainerProps {
    mapViewer: MapViewer;
}

export function MapViewerContainer({ mapViewer }: MapViewerContainerProps): JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();

    const [renderer, setRenderer] = useState<MapViewerRenderer>(mapViewer.renderer);

    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();

    const [hideUi, setHideUi] = useState(false);
    const [fps, setFps] = useState(0);
    const [cameraYaw, setCameraYaw] = useState(mapViewer.camera.getYaw());
    const [isWorldMapOpen, setWorldMapOpen] = useState<boolean>(false);

    const [menuProps, setMenuProps] = useState<OsrsMenuProps | undefined>(undefined);

    const [musicIndex, setMusicIndex] = useState<MusicTrackIndex | undefined>();
    const [musicSettings, setMusicSettings] = useState<MusicSettingsState>(() =>
        MusicSettings.load(),
    );
    const [musicTrack, setMusicTrack] = useState<MusicEntry | undefined>();
    const [musicPlaying, setMusicPlaying] = useState(false);
    const [musicPaused, setMusicPaused] = useState(false);
    const [musicElapsed, setMusicElapsed] = useState(0);
    const [musicTotal, setMusicTotal] = useState(0);
    const [musicStatus, setMusicStatus] = useState<string>("");
    const [isMusicLibraryOpen, setMusicLibraryOpen] = useState(false);

    const requestRef = useRef<number | undefined>(undefined);

    const musicServiceRef = useRef<WikiMusicService | undefined>(undefined);
    const lastAutoTrackCacheIdRef = useRef<number | undefined>(undefined);
    const lastPositionCheckRef = useRef(0);
    const pendingManualTrackRef = useRef<MusicEntry | undefined>(undefined);
    const currentRegionKeyRef = useRef<string>("");
    const currentRegionRef = useRef<MusicEntry[]>([]);
    const musicSettingsRef = useRef(musicSettings);
    musicSettingsRef.current = musicSettings;
    const playTrackByEntryRef = useRef<(entry: MusicEntry) => Promise<void>>(async () => {});
    /**
     * Track which entries we've already prefetched, so we don't issue
     * duplicate fetches when the player is standing still or oscillating
     * across a polygon boundary. Keyed by entry name + cacheId.
     */
    const prefetchedEntriesRef = useRef<Set<string>>(new Set());

    const activeMusicService = useCallback((): WikiMusicService | undefined => {
        return musicServiceRef.current;
    }, []);

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

        if (!hideUi) {
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

        // Position-driven music: throttle spatial lookups to every 200ms.
        if (
            musicSettings.autoPlay &&
            musicSettings.mode === "auto" &&
            musicIndex &&
            time - lastPositionCheckRef.current > 200
        ) {
            lastPositionCheckRef.current = time;
            const x = mapViewer.camera.getPosX();
            const z = mapViewer.camera.getPosZ();
            const svc = musicServiceRef.current;
            const tracks = musicIndex.findTracksAt(x, z);
            const regionKey = tracks
                .map((t) => t.cacheId)
                .filter((c): c is number => c !== undefined)
                .sort((a, b) => a - b)
                .join(",");
            if (regionKey !== currentRegionKeyRef.current) {
                currentRegionKeyRef.current = regionKey;
                currentRegionRef.current = tracks;
                // If the track currently playing is still part of the new
                // region (overlapping polygons), keep it instead of cutting.
                const currentStillInRegion =
                    lastAutoTrackCacheIdRef.current !== undefined &&
                    tracks.some((t) => t.cacheId === lastAutoTrackCacheIdRef.current);
                if (tracks.length > 0 && !currentStillInRegion) {
                    const entry = pickRandomTrack(tracks);
                    lastAutoTrackCacheIdRef.current = entry.cacheId;
                    void playTrackByEntry(entry);
                }
            }
            // Prefetch the 4 nearest tracks to the player's current position
            // so the crossfade is instantaneous when they cross a boundary.
            // The prefetch is idempotent — already-cached entries are skipped
            // inside the service, so calling this every 200ms is cheap.
            if (svc) {
                const nearby = findNearbyTracks(musicIndex, x, z, 4);
                for (const near of nearby) {
                    const key = near.name + "|" + (near.cacheId ?? "");
                    if (prefetchedEntriesRef.current.has(key)) continue;
                    prefetchedEntriesRef.current.add(key);
                    void svc.prefetch(near).then((fetched) => {
                        if (fetched) {
                            console.log("[Music] prefetched", near.name);
                        }
                    });
                }
            }
        }

        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [searchParams, hideUi]);

    // Music: construct the wiki playback service once on mount and load the
    // all-music.json spatial index. Wiki audio is fetched on demand from the
    // OSRS wiki file CDN, so playback is independent of the local cache.
    useEffect(() => {
        const musicCallbacks = {
            onTrackChanged: (t: MusicEntry | undefined) => setMusicTrack(t),
            onPlaybackStateChanged: (playing: boolean, paused: boolean) => {
                setMusicPlaying(playing);
                setMusicPaused(paused);
                if (playing || (!playing && !paused)) setMusicStatus("");
            },
            onProgress: (elapsed: number, total: number) => {
                setMusicElapsed(elapsed);
                setMusicTotal(total);
            },
            onError: (msg: string) => {
                console.warn("Music:", msg);
                setMusicStatus("");
            },
            onTrackEnded: () => {
                // Natural end only (manual stop/pause suppress this). In auto
                // mode, play another random track from the current region.
                const settings = musicSettingsRef.current;
                const region = currentRegionRef.current;
                if (settings.autoPlay && settings.mode === "auto" && region.length > 0) {
                    const entry = pickRandomTrack(region, lastAutoTrackCacheIdRef.current);
                    lastAutoTrackCacheIdRef.current = entry.cacheId;
                    void playTrackByEntryRef.current(entry);
                }
            },
        };
        musicServiceRef.current = new WikiMusicService(musicSettings, {
            ...musicCallbacks,
            onStatus: (msg: string) => setMusicStatus(msg),
        });
        MusicTrackIndex.load()
            .then(setMusicIndex)
            .catch((e) => console.warn("Failed to load all-music.json:", e));
        return () => {
            musicServiceRef.current?.dispose();
            musicServiceRef.current = undefined;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateMusicSettings = useCallback((patch: Partial<MusicSettingsState>) => {
        setMusicSettings((prev) => {
            const next = { ...prev, ...patch };
            MusicSettings.save(next);
            musicServiceRef.current?.setSettings(next);
            return next;
        });
    }, []);

    const playTrackByEntry = useCallback(
        async (entry: MusicEntry): Promise<void> => {
            const service = activeMusicService();
            if (!service) {
                return;
            }
            try {
                await service.play(entry);
            } catch (e) {
                console.error("Failed to play track", entry.name, e);
                setMusicStatus(`Error: ${(e as Error).message}`);
            }
        },
        [activeMusicService],
    );
    playTrackByEntryRef.current = playTrackByEntry;

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
        <div className="max-height">
            {loadingBarOverlay}

            {menuProps && <OsrsMenu {...menuProps} />}

            <MapViewerControls
                renderer={renderer}
                hideUi={hideUi}
                setRenderer={setRenderer}
                setHideUi={setHideUi}
                setDownloadProgress={setDownloadProgress}
            />

            {!hideUi && (
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

                    <MusicPlayer
                        track={musicTrack}
                        isPlaying={musicPlaying}
                        isPaused={musicPaused}
                        elapsedSeconds={musicElapsed}
                        totalSeconds={musicTotal}
                        statusMessage={musicStatus}
                        settings={musicSettings}
                        onPlayPause={() => {
                            const svc = activeMusicService();
                            if (!svc) return;
                            if (svc.isPaused()) {
                                svc.resume();
                            } else if (svc.isPlaying()) {
                                svc.pause();
                            } else if (pendingManualTrackRef.current) {
                                void playTrackByEntry(pendingManualTrackRef.current);
                            } else if (musicTrack) {
                                void playTrackByEntry(musicTrack);
                            }
                        }}
                        onStop={() => activeMusicService()?.stop()}
                        onVolumeChange={(v) => updateMusicSettings({ volume: v, muted: false })}
                        onMuteToggle={() => updateMusicSettings({ muted: !musicSettings.muted })}
                        onSeek={(s) => activeMusicService()?.seek(s)}
                        onModeChange={(mode: MusicMode) => {
                            updateMusicSettings({ mode });
                            if (mode === "auto") {
                                lastAutoTrackCacheIdRef.current = undefined;
                                currentRegionKeyRef.current = "";
                            }
                        }}
                        onOpenLibrary={() => setMusicLibraryOpen(true)}
                    />
                </span>
            )}

            {!hideUi && (
                <MusicLibraryModal
                    isOpen={isMusicLibraryOpen}
                    tracks={musicIndex?.all ?? []}
                    currentCacheId={musicTrack?.cacheId}
                    onRequestClose={() => setMusicLibraryOpen(false)}
                    onSelect={(entry) => {
                        pendingManualTrackRef.current = entry;
                        updateMusicSettings({
                            mode: "manual",
                            lastTrackCacheId: entry.cacheId,
                        });
                        lastAutoTrackCacheIdRef.current = entry.cacheId;
                        void playTrackByEntry(entry);
                    }}
                />
            )}

            {!hideUi && isTouchDevice && (
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
            {!hideUi && isTouchDevice && (
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

/**
 * Picks a track at random from `tracks`. When `excludeCacheId` is supplied and
 * the pool has more than one track, the just-played track is excluded so
 * consecutive plays cycle through overlapping region tracks (e.g. Lightness
 * and Scape Soft) instead of repeating. A single-track pool is returned as-is,
 * effectively looping it.
 */
function pickRandomTrack(tracks: MusicEntry[], excludeCacheId?: number): MusicEntry {
    let pool = tracks;
    if (excludeCacheId !== undefined && tracks.length > 1) {
        pool = tracks.filter((t) => t.cacheId !== excludeCacheId);
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Returns the K closest spatial music tracks to the given world position,
 * measured as the Euclidean distance from `(x, z)` to each track polygon's
 * closest vertex. Used to drive prefetching — by warming the cache for nearby
 * tracks before the player crosses their boundaries, we ensure the crossfade
 * on track switch is instantaneous instead of stalling on a network fetch.
 */
function findNearbyTracks(index: MusicTrackIndex, x: number, z: number, k: number): MusicEntry[] {
    const scored: { entry: MusicEntry; distSq: number }[] = [];
    for (const { entry, vertices } of index.spatial) {
        if (!entry.cacheId) continue;
        // Use the closest vertex to the player as the distance metric —
        // for elongated polygons (e.g. a long road), this is more accurate
        // than the centroid. O(vertices) per track; cheap since most
        // polygons have < 20 vertices.
        let bestDistSq = Infinity;
        for (const v of vertices) {
            const dx = v.x - x;
            const dy = v.y - z;
            const d = dx * dx + dy * dy;
            if (d < bestDistSq) bestDistSq = d;
        }
        scored.push({ entry, distSq: bestDistSq });
    }
    scored.sort((a, b) => a.distSq - b.distSq);
    return scored.slice(0, k).map((s) => s.entry);
}
