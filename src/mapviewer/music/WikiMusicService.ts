import { MusicSettingsState } from "./MusicSettings";
import { MusicEntry } from "./MusicTrackIndex";

const DEBUG_TAG = "[WikiMusic]";
const WIKI_BASE = "https://oldschool.runescape.wiki/images/";

/**
 * Crossfade duration in seconds. When switching tracks, the outgoing source
 * ramps to silence over this long while the incoming source ramps up from
 * silence — they overlap by this much, producing a smooth transition
 * instead of a hard cut.
 *
 * 800 ms matches what most digital audio workstations use as a default
 * crossfade. Long enough to avoid clicks on note-off transients, short
 * enough that the player notices the new track promptly.
 */
const CROSSFADE_SECONDS = 0.8;

/**
 * Maximum number of decoded AudioBuffers to keep cached. Each buffer is
 * roughly 5-15 MB (a few minutes of stereo 44.1kHz audio), so 30 buffers
 * is ~150-450 MB — well within a desktop browser tab's heap budget but
 * enough to cache an entire region's worth of adjacent tracks.
 *
 * Eviction is LRU: when the cap is hit, the buffer whose key was least
 * recently touched (via get-or-fetch) gets dropped.
 */
const MAX_CACHED_BUFFERS = 30;

export interface WikiMusicServiceCallbacks {
    onTrackChanged?: (track: MusicEntry | undefined) => void;
    onPlaybackStateChanged?: (playing: boolean, paused: boolean) => void;
    onProgress?: (elapsedSeconds: number, totalSeconds: number) => void;
    onError?: (message: string) => void;
    onStatus?: (message: string) => void;
    onTrackEnded?: () => void;
}

/**
 * One cached decoded sample, plus the order tag used for LRU eviction.
 */
interface CachedBuffer {
    buffer: AudioBuffer;
    /** Monotonic counter — higher = more recently used. */
    lastTouched: number;
}

/**
 * Plays the actual in-game audio directly from the OSRS wiki's file CDN.
 * The wiki hosts .ogg renders of every music track at predictable URLs
 * like `https://oldschool.runescape.wiki/images/Sea_Shanty_2.ogg`, and
 * the CDN sends permissive CORS headers, so we can fetch + decode + play
 * them from a browser context without proxying.
 *
 * Features:
 *   - **Bit-perfect game audio** — these .ogg files were captured from
 *     the game itself, so what you hear is exactly what players hear.
 *   - **LRU cache** — decoded AudioBuffers are reused across plays and
 *     shared with prefetches, so a track is fetched at most once per
 *     session (until evicted).
 *   - **Crossfade** — switching tracks ramps the old source to silence
 *     over CROSSFADE_SECONDS while the new source ramps up from silence,
 *     avoiding the audible "snap" of a hard cut.
 *   - **Prefetch** — `prefetch(entry)` fetches + decodes a track in the
 *     background without playing it. Callers (e.g. MapViewerContainer)
 *     can warm the cache for tracks near the player's current location
 *     so that the actual play() call when the player crosses a boundary
 *     is instantaneous.
 */
export class WikiMusicService {
    private settings: MusicSettingsState;
    private callbacks: WikiMusicServiceCallbacks;

    private ac: AudioContext | undefined;
    private masterGain: GainNode | undefined;

    /**
     * LRU cache of decoded AudioBuffers keyed by wiki URL. The Map preserves
     * insertion order in JS, which makes LRU eviction trivial: on cache hit,
     * delete + re-insert to bump to "most recent"; on cache miss + overflow,
     * evict the first entry.
     */
    private bufferCache: Map<string, CachedBuffer> = new Map();
    private inFlight: Map<string, Promise<AudioBuffer>> = new Map();
    private lruCounter = 0;

    private currentTrack: MusicEntry | undefined;
    private currentBuffer: AudioBuffer | undefined;
    /**
     * The currently-audible source node + its dedicated gain node (separate
     * from `masterGain` so we can ramp this voice without affecting the
     * master volume setting). `null` between tracks.
     */
    private currentSource: AudioBufferSourceNode | undefined;
    private currentVoiceGain: GainNode | undefined;
    /**
     * Source nodes that are in their fade-out tail after a track switch.
     * Each will self-disconnect when its ramp completes (scheduled via
     * `source.stop(acTime)`).
     */
    private outgoingSources: Set<{ source: AudioBufferSourceNode; gain: GainNode }> = new Set();

    private startedAtAcTime = 0;
    private pausedAtSeconds = 0;
    private totalSeconds = 0;
    private playing = false;
    private paused = false;
    private progressInterval: number | undefined;
    private playRequestId = 0;

    constructor(settings: MusicSettingsState, callbacks: WikiMusicServiceCallbacks = {}) {
        this.settings = settings;
        this.callbacks = callbacks;
    }

    getCurrentTrack(): MusicEntry | undefined {
        return this.currentTrack;
    }

    isPlaying(): boolean {
        return this.playing && !this.paused;
    }

    isPaused(): boolean {
        return this.paused;
    }

    setSettings(settings: MusicSettingsState): void {
        this.settings = settings;
        this.applyVolume();
    }

    private ensureContext(): AudioContext {
        if (!this.ac) {
            const Ctor = window.AudioContext || (window as any).webkitAudioContext;
            this.ac = new Ctor();
            this.masterGain = this.ac.createGain();
            this.masterGain.connect(this.ac.destination);
            this.applyVolume();
        }
        return this.ac;
    }

    private applyVolume(): void {
        if (!this.masterGain) return;
        const effective = this.settings.muted ? 0 : this.settings.volume;
        this.masterGain.gain.value = effective;
    }

    /**
     * Public entry point. Resolves to the decoded AudioBuffer for the given
     * entry — pulling from cache when possible, otherwise fetching from the
     * wiki. Multiple concurrent callers for the same URL share one
     * in-flight promise (deduplication).
     */
    async fetchBuffer(entry: MusicEntry): Promise<AudioBuffer> {
        const url = this.urlForTrack(entry);
        const cached = this.bufferCache.get(url);
        if (cached) {
            cached.lastTouched = ++this.lruCounter;
            return cached.buffer;
        }
        const inflight = this.inFlight.get(url);
        if (inflight) return inflight;

        const promise = this.fetchAndDecode(url);
        this.inFlight.set(url, promise);
        try {
            const buffer = await promise;
            this.putCache(url, buffer);
            return buffer;
        } finally {
            this.inFlight.delete(url);
        }
    }

    /**
     * Warm the cache for a track without playing it. Safe to call
     * repeatedly — if the buffer is already cached or currently being
     * fetched, this is a no-op.
     *
     * Returns true if a new fetch was actually initiated, false if the
     * buffer was already available. Callers can use this to throttle
     * logging.
     */
    async prefetch(entry: MusicEntry): Promise<boolean> {
        const url = this.urlForTrack(entry);
        if (this.bufferCache.has(url) || this.inFlight.has(url)) {
            return false;
        }
        await this.fetchBuffer(entry);
        return true;
    }

    async play(entry: MusicEntry): Promise<void> {
        const ac = this.ensureContext();
        if (ac.state === "suspended") {
            await ac.resume();
        }

        // Bump on every play request so that an in-flight fetch from a
        // previous request knows it has been superseded (by a track switch
        // or a stop) and should not start its buffer when it resolves.
        const requestId = ++this.playRequestId;

        // Same track → restart from the beginning (no fade needed).
        if (this.currentTrack?.name === entry.name && this.currentBuffer) {
            this.startSource(this.currentBuffer, entry, 0, true);
            return;
        }

        const url = this.urlForTrack(entry);
        const cached = this.bufferCache.get(url);
        if (cached) {
            // Cache hit — crossfade immediately.
            cached.lastTouched = ++this.lruCounter;
            this.startSource(cached.buffer, entry, 0, true);
            return;
        }

        // Cache miss — show status, fetch, then start. While loading, the
        // previous track keeps playing (if any) so there's no awkward gap.
        this.callbacks.onStatus?.(`Fetching ${this.shortUrl(url)}…`);
        console.log(DEBUG_TAG, "fetching", url);
        try {
            const buffer = await this.fetchBuffer(entry);
            // If a newer play request or a stop superseded this one while we
            // were fetching, abort the stale start.
            if (this.playRequestId !== requestId) {
                this.callbacks.onStatus?.("");
                return;
            }
            this.startSource(buffer, entry, 0, true);
            this.callbacks.onStatus?.("");
        } catch (err) {
            const msg = `Failed to load ${this.shortUrl(url)}`;
            this.callbacks.onError?.(msg);
            console.warn(DEBUG_TAG, msg, err);
            this.callbacks.onStatus?.("");
        }
    }

    /**
     * Internal: spawn a BufferSourceNode for `buffer`, optionally fading
     * out the currently-playing source as a crossfade. Sets up the
     * `onended` handler that fires the natural-end callback when the
     * buffer plays to completion (distinguished from stop()/seek()).
     */
    private startSource(
        buffer: AudioBuffer,
        entry: MusicEntry,
        fromSeconds: number,
        withCrossfade: boolean,
    ): void {
        const ac = this.ensureContext();

        // Tear down progress interval — we'll re-establish below.
        if (this.progressInterval !== undefined) {
            window.clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }

        // Fade out the outgoing source (if any) over CROSSFADE_SECONDS.
        // If we're starting fresh (no outgoing), or resuming from pause,
        // skip the crossfade and just stop the old source hard.
        if (this.currentSource && this.currentVoiceGain) {
            if (withCrossfade) {
                this.scheduleFadeOut(this.currentSource, this.currentVoiceGain, ac.currentTime);
            } else {
                this.hardStopSource(this.currentSource, this.currentVoiceGain);
            }
        }

        // Build the new voice: source → perVoiceGain → masterGain.
        const source = ac.createBufferSource();
        source.buffer = buffer;
        const voiceGain = ac.createGain();
        // Start at silence; the ramp below brings us up to peak.
        voiceGain.gain.setValueAtTime(0, ac.currentTime);
        const peak = 1.0;
        if (withCrossfade) {
            voiceGain.gain.linearRampToValueAtTime(peak, ac.currentTime + CROSSFADE_SECONDS);
        } else {
            // Resume / non-crossfade start — quick 50ms attack to avoid a
            // click on the first sample.
            voiceGain.gain.linearRampToValueAtTime(peak, ac.currentTime + 0.05);
        }
        source.connect(voiceGain).connect(this.masterGain!);
        source.onended = () => {
            // Distinguish natural end (we're still playing this source and
            // not paused) from explicit stop/seek/track-switch.
            if (this.playing && !this.paused && this.currentSource === source) {
                this.stopInternal();
                this.callbacks.onPlaybackStateChanged?.(false, false);
                this.callbacks.onTrackEnded?.();
            }
            // Always disconnect regardless to free graph nodes.
            try {
                source.disconnect();
                voiceGain.disconnect();
            } catch {
                /* already disconnected */
            }
        };
        source.start(0, fromSeconds);

        this.currentSource = source;
        this.currentVoiceGain = voiceGain;
        this.currentBuffer = buffer;
        this.currentTrack = entry;
        this.totalSeconds = buffer.duration;
        this.startedAtAcTime = ac.currentTime;
        this.pausedAtSeconds = fromSeconds;

        const wasAlreadyPlaying = this.playing;
        this.playing = true;
        this.paused = false;
        if (!wasAlreadyPlaying) {
            this.callbacks.onPlaybackStateChanged?.(true, false);
        }
        this.callbacks.onTrackChanged?.(entry);

        this.progressInterval = window.setInterval(() => {
            if (!this.playing || this.paused) return;
            const elapsed = Math.min(
                this.totalSeconds,
                this.pausedAtSeconds + (ac.currentTime - this.startedAtAcTime),
            );
            this.callbacks.onProgress?.(elapsed, this.totalSeconds);
        }, 250);
    }

    /**
     * Schedules a fade-out + stop for an outgoing source. The source
     * continues playing during the crossfade window, then is stopped
     * and disconnected.
     */
    private scheduleFadeOut(
        source: AudioBufferSourceNode,
        gain: GainNode,
        fromAcTime: number,
    ): void {
        const ac = this.ensureContext();
        const handle = { source, gain };
        this.outgoingSources.add(handle);
        // Capture the current gain (might already be mid-ramp) and ramp to 0.
        gain.gain.cancelAndHoldAtTime(fromAcTime);
        gain.gain.setValueAtTime(gain.gain.value, fromAcTime);
        gain.gain.linearRampToValueAtTime(0, fromAcTime + CROSSFADE_SECONDS);
        source.onended = null; // suppress natural-end callback on outgoing
        try {
            source.stop(fromAcTime + CROSSFADE_SECONDS + 0.01);
        } catch {
            /* already stopped */
        }
        // Self-cleanup once the fade + stop has completed. Schedule in
        // wall-clock time (the fade length is fixed in seconds, so a plain
        // timeout matches it regardless of when the AudioContext started).
        // The previous implementation mixed `AudioContext.currentTime` with
        // `performance.now()` (two unrelated monotonic clocks whose
        // difference depends on how long the page has been open vs. how long
        // the AC has been running), which produced nonsense delays.
        const cleanupDelayMs = (CROSSFADE_SECONDS + 0.1) * 1000;
        window.setTimeout(() => {
            this.outgoingSources.delete(handle);
            try {
                source.disconnect();
                gain.disconnect();
            } catch {
                /* already disconnected */
            }
        }, cleanupDelayMs);
        // Mark `currentSource` as cleared so the outgoing node's eventual
        // `onended` doesn't fire the natural-end path.
        if (this.currentSource === source) {
            this.currentSource = undefined;
            this.currentVoiceGain = undefined;
        }
    }

    private hardStopSource(source: AudioBufferSourceNode, gain: GainNode): void {
        source.onended = null;
        try {
            source.stop();
        } catch {
            /* already stopped */
        }
        try {
            source.disconnect();
            gain.disconnect();
        } catch {
            /* already disconnected */
        }
        if (this.currentSource === source) {
            this.currentSource = undefined;
            this.currentVoiceGain = undefined;
        }
    }

    pause(): void {
        if (!this.playing || this.paused) return;
        const ac = this.ensureContext();
        this.pausedAtSeconds = Math.min(
            this.totalSeconds,
            this.pausedAtSeconds + (ac.currentTime - this.startedAtAcTime),
        );
        this.paused = true;
        if (this.currentSource && this.currentVoiceGain) {
            this.hardStopSource(this.currentSource, this.currentVoiceGain);
        }
        if (this.progressInterval !== undefined) {
            window.clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        this.callbacks.onPlaybackStateChanged?.(false, true);
        this.callbacks.onProgress?.(this.pausedAtSeconds, this.totalSeconds);
    }

    resume(): void {
        if (!this.playing || !this.paused || !this.currentBuffer || !this.currentTrack) return;
        this.paused = false;
        this.callbacks.onPlaybackStateChanged?.(true, false);
        this.startSource(this.currentBuffer, this.currentTrack, this.pausedAtSeconds, false);
    }

    seek(seconds: number): void {
        if (!this.playing || !this.currentBuffer || !this.currentTrack) return;
        const target = Math.max(0, Math.min(this.totalSeconds, seconds));
        const wasPaused = this.paused;
        this.pausedAtSeconds = target;
        if (wasPaused) {
            this.callbacks.onProgress?.(target, this.totalSeconds);
        } else {
            // Tear down + restart at the new offset. No crossfade — the
            // user explicitly moved the playhead, a hard cut is expected.
            this.startSource(this.currentBuffer, this.currentTrack, target, false);
        }
    }

    stop(): void {
        this.stopInternal();
        this.callbacks.onPlaybackStateChanged?.(false, false);
    }

    private stopInternal(): void {
        if (this.currentSource && this.currentVoiceGain) {
            this.hardStopSource(this.currentSource, this.currentVoiceGain);
        }
        // Also tear down any lingering fade-out tails.
        for (const handle of this.outgoingSources) {
            try {
                handle.source.onended = null;
                handle.source.stop();
                handle.source.disconnect();
                handle.gain.disconnect();
            } catch {
                /* ignore */
            }
        }
        this.outgoingSources.clear();
        if (this.progressInterval !== undefined) {
            window.clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        // Invalidate any in-flight fetch so it does not start after a stop.
        this.playRequestId++;
        this.playing = false;
        this.paused = false;
        this.currentBuffer = undefined;
        this.currentTrack = undefined;
        this.totalSeconds = 0;
        this.pausedAtSeconds = 0;
        this.callbacks.onTrackChanged?.(undefined);
    }

    dispose(): void {
        this.stopInternal();
        if (this.ac) {
            this.ac.close();
            this.ac = undefined;
            this.masterGain = undefined;
        }
        this.bufferCache.clear();
        this.inFlight.clear();
    }

    /**
     * Builds the wiki CDN URL for a track. The wiki stores audio as
     * `File:Track_Name.ogg` and serves it at `/images/Track_Name.ogg`.
     * Spaces become underscores (MediaWiki convention); other characters
     * are URL-encoded to be safe. If the entry already carries a `fileUrl`
     * (e.g., a non-standard filename), that wins.
     */
    private urlForTrack(entry: MusicEntry): string {
        if (entry.fileUrl) {
            return entry.fileUrl.startsWith("http")
                ? entry.fileUrl
                : `${WIKI_BASE}${entry.fileUrl}`;
        }
        const baseName = (entry.fileName ?? entry.name).replace(/\s+/g, "_");
        // Encode but preserve underscores and other URL-safe punctuation
        // that MediaWiki expects verbatim in the path.
        const encoded = encodeURI(baseName);
        return `${WIKI_BASE}${encoded}.ogg`;
    }

    /** Short identifier for status/error messages — just the filename. */
    private shortUrl(url: string): string {
        return url.startsWith(WIKI_BASE) ? url.slice(WIKI_BASE.length) : url;
    }

    private async fetchAndDecode(url: string): Promise<AudioBuffer> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const ac = this.ensureContext();
        return await ac.decodeAudioData(arrayBuffer);
    }

    private putCache(url: string, buffer: AudioBuffer): void {
        // Evict if over capacity. Map iteration order = insertion order, and
        // we re-insert on access, so the first entry is always the LRU one.
        while (this.bufferCache.size >= MAX_CACHED_BUFFERS) {
            const oldest = this.bufferCache.keys().next().value;
            if (oldest === undefined) break;
            this.bufferCache.delete(oldest);
        }
        this.bufferCache.set(url, { buffer, lastTouched: ++this.lruCounter });
    }
}
