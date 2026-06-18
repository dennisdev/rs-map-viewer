import { vec3 } from "gl-matrix";

import { CameraView } from "./Camera";
import { DurationMode, EasingMode, LoopMode } from "./CameraTrack";

/** Authoring state for the camera recorder, persisted across sessions via URL. */
export interface RecordingConfig {
    durationMode: DurationMode;
    /** Total duration (seconds) for the TOTAL_* modes. */
    duration: number;
    /** Per-segment durations (seconds) for the PER_SEGMENT mode. */
    segmentDurations: number[];
    smoothing: number;
    easing: EasingMode;
    loopMode: LoopMode;
    speed: number;
    keyframes: CameraView[];
}

export function createDefaultRecordingConfig(): RecordingConfig {
    return {
        durationMode: DurationMode.TOTAL_EVEN,
        duration: 10,
        segmentDurations: [],
        smoothing: 1,
        easing: EasingMode.EASE_IN_OUT,
        loopMode: LoopMode.ONCE,
        speed: 1,
        keyframes: [],
    };
}

/** Whether a config is entirely default (i.e. nothing worth persisting to the URL). */
export function isRecordingDefault(config: RecordingConfig): boolean {
    return (
        config.keyframes.length === 0 &&
        config.segmentDurations.length === 0 &&
        config.durationMode === DurationMode.TOTAL_EVEN &&
        config.duration === 10 &&
        config.smoothing === 1 &&
        config.easing === EasingMode.EASE_IN_OUT &&
        config.loopMode === LoopMode.ONCE &&
        config.speed === 1
    );
}

/**
 * Compact URL codec. The whole recording is packed into a single `r` query
 * param as JSON (only non-default fields are emitted to keep URLs short).
 */
export function serializeRecordingConfig(config: RecordingConfig): string {
    const data: Record<string, unknown> = {
        m: config.durationMode,
        d: config.duration,
        sd: config.segmentDurations.length
            ? config.segmentDurations.map((x) => +x.toFixed(3))
            : undefined,
        sm: config.smoothing !== 1 ? +config.smoothing.toFixed(3) : undefined,
        e: config.easing !== EasingMode.EASE_IN_OUT ? config.easing : undefined,
        l: config.loopMode !== LoopMode.ONCE ? config.loopMode : undefined,
        sp: config.speed !== 1 ? +config.speed.toFixed(3) : undefined,
        k: config.keyframes.length
            ? config.keyframes.map((kf) => [
                  +kf.position[0].toFixed(1),
                  +kf.position[1].toFixed(1),
                  +kf.position[2].toFixed(1),
                  kf.pitch | 0,
                  kf.yaw | 0,
                  +kf.fov.toFixed(1),
                  +kf.orthoZoom.toFixed(1),
              ])
            : undefined,
    };
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
            clean[key] = value;
        }
    }
    return encodeURIComponent(JSON.stringify(clean));
}

export function deserializeRecordingConfig(encoded: string | null): RecordingConfig | null {
    if (!encoded) {
        return null;
    }
    try {
        const data = JSON.parse(decodeURIComponent(encoded));
        const keyframes: CameraView[] = Array.isArray(data.k)
            ? data.k.map((kf: number[]) => ({
                  position: vec3.fromValues(+(kf[0] ?? 0), +(kf[1] ?? 0), +(kf[2] ?? 0)),
                  pitch: kf[3] | 0,
                  yaw: kf[4] | 0,
                  fov: +(kf[5] ?? 90),
                  orthoZoom: +(kf[6] ?? 15),
              }))
            : [];
        return {
            durationMode: data.m ?? DurationMode.TOTAL_EVEN,
            duration: data.d ?? 10,
            segmentDurations: Array.isArray(data.sd) ? data.sd.map((n: number) => +n) : [],
            smoothing: data.sm ?? 1,
            easing: data.e ?? EasingMode.EASE_IN_OUT,
            loopMode: data.l ?? LoopMode.ONCE,
            speed: data.sp ?? 1,
            keyframes,
        };
    } catch {
        return null;
    }
}
