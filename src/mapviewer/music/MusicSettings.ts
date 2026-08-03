export type MusicMode = "auto" | "manual";

/**
 * User-configurable settings for the music player. The wiki engine is the
 * only playback path now (the previous SF2/cache/DSP engines were removed
 * in favor of fetching the actual in-game audio render from the OSRS wiki
 * file CDN), so there's no engine toggle.
 */
export interface MusicSettingsState {
    volume: number;
    muted: boolean;
    mode: MusicMode;
    lastTrackCacheId: number | undefined;
    autoPlay: boolean;
}

const STORAGE_KEY = "osrs-music-settings-v2";

const DEFAULTS: MusicSettingsState = {
    volume: 0.7,
    muted: false,
    mode: "auto",
    lastTrackCacheId: undefined,
    autoPlay: true,
};

export class MusicSettings {
    static load(): MusicSettingsState {
        if (typeof localStorage === "undefined") {
            return { ...DEFAULTS };
        }
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return { ...DEFAULTS };
            }
            const parsed = JSON.parse(raw) as Partial<MusicSettingsState>;
            return { ...DEFAULTS, ...parsed };
        } catch {
            return { ...DEFAULTS };
        }
    }

    static save(state: MusicSettingsState): void {
        if (typeof localStorage === "undefined") {
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            // storage full / disabled — non-fatal
        }
    }
}
