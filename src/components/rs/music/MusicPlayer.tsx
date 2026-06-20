import { memo, useEffect, useState } from "react";

import { MusicMode, MusicSettingsState } from "../../../mapviewer/music/MusicSettings";
import { MusicEntry } from "../../../mapviewer/music/MusicTrackIndex";
import "./MusicPlayer.css";

interface MusicPlayerProps {
    track: MusicEntry | undefined;
    isPlaying: boolean;
    isPaused: boolean;
    elapsedSeconds: number;
    totalSeconds: number;
    /** Transient status (e.g. "Fetching from wiki…"). Empty when idle. */
    statusMessage?: string;
    settings: MusicSettingsState;
    onPlayPause: () => void;
    onStop: () => void;
    onVolumeChange: (volume: number) => void;
    onMuteToggle: () => void;
    onModeChange: (mode: MusicMode) => void;
    onOpenLibrary: () => void;
    onSeek: (seconds: number) => void;
}

export const MusicPlayer = memo(function MusicPlayer({
    track,
    isPlaying,
    isPaused,
    elapsedSeconds,
    totalSeconds,
    statusMessage,
    settings,
    onPlayPause,
    onStop,
    onVolumeChange,
    onMuteToggle,
    onModeChange,
    onOpenLibrary,
    onSeek,
}: MusicPlayerProps): JSX.Element {
    const [expanded, setExpanded] = useState(true);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!isPlaying) {
            return;
        }
        const id = window.setInterval(() => setTick((t) => t + 1), 500);
        return () => window.clearInterval(id);
    }, [isPlaying]);

    const title = track?.name ?? (isPlaying ? "Loading…" : "No track");
    const subtitle = track?.composer ?? track?.location ?? "";
    const progress = totalSeconds > 0 ? Math.min(1, elapsedSeconds / totalSeconds) : 0;

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        if (!track || totalSeconds <= 0) {
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(ratio * totalSeconds);
    };

    if (!expanded) {
        return (
            <div className="hud left-bottom">
                <div
                    className="music-player-collapsed rs-border rs-background content-text"
                    onClick={() => setExpanded(true)}
                    title="Expand music player"
                >
                    ♪
                </div>
            </div>
        );
    }

    return (
        <div className="hud left-bottom">
            <div className="music-player rs-border rs-background">
                <div className="music-player-header">
                    <span
                        className="music-player-mode content-text"
                        onClick={() => onModeChange(settings.mode === "auto" ? "manual" : "auto")}
                        title="Toggle auto/manual mode"
                    >
                        {settings.mode === "auto" ? "Auto" : "Manual"}
                    </span>
                    <span className="music-player-title content-text" title={title}>
                        {title}
                    </span>
                    <span
                        className="music-player-collapse content-text"
                        onClick={() => setExpanded(false)}
                        title="Collapse"
                    >
                        –
                    </span>
                </div>
                {statusMessage ? (
                    <div className="music-player-status content-text" title={statusMessage}>
                        {statusMessage}
                    </div>
                ) : (
                    subtitle && (
                        <div className="music-player-subtitle content-text" title={subtitle}>
                            {subtitle}
                        </div>
                    )
                )}
                <div
                    className="music-player-progress"
                    onClick={handleProgressClick}
                    title={track ? "Seek to position" : undefined}
                >
                    <div
                        className="music-player-progress-fill"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>
                <div className="music-player-time content-text">
                    <span>{formatTime(elapsedSeconds)}</span>
                    <span>{formatTime(totalSeconds)}</span>
                </div>
                <div className="music-player-controls">
                    <button
                        className="music-player-btn rs-border rs-background content-text"
                        onClick={onPlayPause}
                        disabled={!track && !isPaused}
                        title={isPaused ? "Resume" : isPlaying ? "Pause" : "Play"}
                    >
                        {isPaused ? "▶" : isPlaying ? "❚❚" : "▶"}
                    </button>
                    <button
                        className="music-player-btn rs-border rs-background content-text"
                        onClick={onStop}
                        disabled={!track && !isPlaying && !isPaused}
                        title="Stop"
                    >
                        ■
                    </button>
                    <button
                        className="music-player-btn rs-border rs-background content-text"
                        onClick={onMuteToggle}
                        title={settings.muted ? "Unmute" : "Mute"}
                    >
                        {settings.muted ? "🔇" : "🔊"}
                    </button>
                    <input
                        className="music-player-volume"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={settings.muted ? 0 : settings.volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        title="Volume"
                    />
                    <button
                        className="music-player-btn rs-border rs-background content-text"
                        onClick={onOpenLibrary}
                        title="Open music library"
                    >
                        ☰
                    </button>
                </div>
                {/* referenced so React re-renders on tick without affecting layout */}
                <span style={{ display: "none" }}>{tick}</span>
            </div>
        </div>
    );
});

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) {
        return "--:--";
    }
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}
