import { vec3 } from "gl-matrix";

import { clamp, easeIn, easeInOut, easeLinear, easeOut, lerp, slerp } from "../util/MathUtil";
import { CameraView } from "./Camera";

export interface CameraTrackOptions {
    /**
     * Path smoothing in [0, 1]. 0 = straight segments between keyframes,
     * 1 = full Catmull-Rom spline through every keyframe. Intermediate values
     * blend the two. Defaults to 1.
     */
    smoothing?: number;
    /** Temporal easing applied to normalised time. Defaults to EASE_IN_OUT. */
    easing?: EasingMode;
    /** How normalised time is distributed across segments. Defaults to TOTAL_EVEN. */
    durationMode?: DurationMode;
    /**
     * Per-segment durations (seconds) used by {@link DurationMode.PER_SEGMENT}.
     * Length should be `keyframes.length - 1`. Missing/extra entries are clamped.
     */
    segmentDurations?: number[];
}

export enum DurationMode {
    /** Total duration split equally across segments (uniform parameterisation). */
    TOTAL_EVEN,
    /**
     * Total duration split by arc length so the camera moves at a constant
     * world-space velocity (true constant speed, incl. through spline curves).
     */
    TOTAL_DISTANCE,
    /** Each segment runs for its own authored duration. */
    PER_SEGMENT,
}

export enum EasingMode {
    LINEAR,
    EASE_IN_OUT,
    EASE_IN,
    EASE_OUT,
}

export enum LoopMode {
    ONCE,
    LOOP,
    PINGPONG,
}

const YAW_RANGE = 2048;

const EASING_FUNCTIONS: Record<EasingMode, (t: number) => number> = {
    [EasingMode.LINEAR]: easeLinear,
    [EasingMode.EASE_IN_OUT]: easeInOut,
    [EasingMode.EASE_IN]: easeIn,
    [EasingMode.EASE_OUT]: easeOut,
};

interface ArcLengthSample {
    u: number; // spatial parameter in [0, 1]
    s: number; // cumulative normalised arc length in [0, 1]
}

/**
 * A camera rail: an ordered set of {@link CameraView} keyframes connected by a
 * continuous curve, sampled by normalised time `t` in [0, 1] (decoupled from
 * wall-clock duration, which the playback driver owns).
 *
 * The evaluation pipeline is:
 *   rawT (time) →[easing]→ s (progress) →[segment mapping]→ (index, localT)
 *
 * The segment mapping is governed by {@link DurationMode}: equal split, arc
 * length (constant speed), or per-segment durations. Position/pitch/fov/
 * orthoZoom ride a Catmull-Rom spline whose strength is governed by
 * {@link CameraTrackOptions.smoothing}. Yaw uses shortest-arc interpolation so
 * it never takes the long way around the 0/2048 boundary.
 */
export class CameraTrack {
    private readonly smoothing: number;
    private readonly easing: EasingMode;
    private readonly durationMode: DurationMode;
    private readonly segmentDurations: number[];

    private arcLengthLut: ArcLengthSample[] | null = null;
    private arcLengthTotal = 0;

    constructor(
        private readonly keyframes: CameraView[],
        options: CameraTrackOptions = {},
    ) {
        this.smoothing = clamp(options.smoothing ?? 1, 0, 1);
        this.easing = options.easing ?? EasingMode.EASE_IN_OUT;
        this.durationMode = options.durationMode ?? DurationMode.TOTAL_EVEN;
        this.segmentDurations = options.segmentDurations ?? [];
    }

    get length(): number {
        return this.keyframes.length;
    }

    /**
     * Total authored duration in seconds. For PER_SEGMENT this is the sum of
     * the per-segment durations; otherwise it is meaningless (the driver owns
     * the total). Provided as a convenience for the playback driver.
     */
    get totalSegmentDuration(): number {
        let sum = 0;
        for (const d of this.segmentDurations) {
            sum += d;
        }
        return sum;
    }

    /**
     * Sample the rail at normalised time `t` in [0, 1]. Values outside the range
     * are clamped to the first/last keyframe so callers don't need to guard the
     * bounds themselves.
     */
    evaluate(rawT: number): CameraView {
        const n = this.keyframes.length;
        if (n === 0) {
            throw new Error("Cannot evaluate a CameraTrack with no keyframes");
        }
        if (n === 1 || rawT <= 0) {
            return this.clone(this.keyframes[0]);
        }
        if (rawT >= 1) {
            return this.clone(this.keyframes[n - 1]);
        }

        const s = EASING_FUNCTIONS[this.easing](rawT);
        const { index, localT } = this.mapToSegment(s);
        return this.sample(index, localT);
    }

    /**
     * Sample `count` world-space positions evenly across the rail's *spatial*
     * parameter (independent of duration mode/easing, which are timing
     * concerns). Returns a flat xyz Float32Array. Used to visualise the path.
     */
    samplePath(count: number): Float32Array {
        const n = this.keyframes.length;
        if (count <= 0 || n === 0) {
            return new Float32Array(0);
        }
        const out = new Float32Array(count * 3);
        if (n === 1) {
            const p = this.keyframes[0].position;
            for (let i = 0; i < count; i++) {
                out[i * 3] = p[0];
                out[i * 3 + 1] = p[1];
                out[i * 3 + 2] = p[2];
            }
            return out;
        }
        for (let i = 0; i < count; i++) {
            const u = count === 1 ? 0 : i / (count - 1);
            const segment = u * (n - 1);
            const index = Math.min(Math.floor(segment), n - 2);
            const localT = segment - index;
            const pos = this.samplePosition(index, localT);
            out[i * 3] = pos[0];
            out[i * 3 + 1] = pos[1];
            out[i * 3 + 2] = pos[2];
        }
        return out;
    }

    /**
     * Map normalised progress `s` in [0, 1] to a (segment index, local t) pair
     * according to the active {@link DurationMode}.
     */
    private mapToSegment(s: number): { index: number; localT: number } {
        const n = this.keyframes.length;
        let segment: number;
        if (this.durationMode === DurationMode.TOTAL_DISTANCE) {
            // Constant speed: remap progress through the arc-length LUT so equal
            // time yields equal distance travelled (incl. through curves).
            const u = this.paramAtArcLength(s);
            segment = u * (n - 1);
        } else if (this.durationMode === DurationMode.PER_SEGMENT && n > 1) {
            segment = this.weightedSegment(s);
        } else {
            segment = s * (n - 1);
        }
        const index = Math.min(Math.floor(segment), n - 2);
        return { index, localT: segment - index };
    }

    /**
     * Distribute `s` across segments proportional to their authored durations.
     * Returns a continuous segment index in [0, n-1].
     */
    private weightedSegment(s: number): number {
        const n = this.keyframes.length;
        const segCount = n - 1;
        const weights = this.segmentDurations;
        let total = 0;
        for (let i = 0; i < segCount; i++) {
            total += Math.max(0, weights[i] ?? 0);
        }
        if (total <= 0) {
            // No authored durations: fall back to an even split.
            return s * segCount;
        }
        let cumulative = 0;
        for (let i = 0; i < segCount; i++) {
            const w = Math.max(0, weights[i] ?? 0);
            const next = cumulative + w / total;
            if (s <= next) {
                const span = w / total;
                const localT = span > 0 ? (s - cumulative) / span : 0;
                return i + clamp(localT, 0, 1);
            }
            cumulative = next;
        }
        return segCount;
    }

    private sample(index: number, t: number): CameraView {
        return {
            position: this.samplePosition(index, t),
            pitch: this.sampleScalar((v) => v.pitch, index, t),
            yaw: slerp(this.keyframes[index].yaw, this.keyframes[index + 1].yaw, t, YAW_RANGE),
            fov: this.sampleScalar((v) => v.fov, index, t),
            orthoZoom: this.sampleScalar((v) => v.orthoZoom, index, t),
        };
    }

    private samplePosition(index: number, t: number): vec3 {
        const k = this.keyframes;
        const from = k[index].position;
        const to = k[index + 1].position;
        const linear = this.lerpVec3(from, to, t);
        // Catmull-Rom needs four control points; with fewer than three
        // keyframes there is no interior curvature, so linear is exact.
        if (this.smoothing <= 0 || k.length < 3) {
            return linear;
        }
        const p0 = this.neighbor(index - 1).position;
        const p3 = this.neighbor(index + 2).position;
        const spline = this.catmullRomVec3(p0, from, to, p3, t);
        return this.lerpVec3(linear, spline, this.smoothing);
    }

    private sampleScalar(get: (v: CameraView) => number, index: number, t: number): number {
        const k = this.keyframes;
        const from = get(k[index]);
        const to = get(k[index + 1]);
        const linear = lerp(from, to, t);
        if (this.smoothing <= 0 || k.length < 3) {
            return linear;
        }
        const p0 = get(this.neighbor(index - 1));
        const p3 = get(this.neighbor(index + 2));
        const spline = this.catmullRom(p0, from, to, p3, t);
        return lerp(linear, spline, this.smoothing);
    }

    /**
     * Builds (lazily) a lookup table mapping the spatial parameter `u` to
     * cumulative normalised arc length, by densely sampling the actual rendered
     * path (honouring smoothing). Used to invert time→space for constant speed.
     */
    private buildArcLengthLut(): void {
        const n = this.keyframes.length;
        const samples = Math.max(256, (n - 1) * 64);
        const lut: ArcLengthSample[] = new Array(samples + 1);
        let cumulative = 0;
        let prevPos: vec3 | null = null;
        for (let i = 0; i <= samples; i++) {
            const u = i / samples;
            const segment = u * (n - 1);
            const index = Math.min(Math.floor(segment), n - 2);
            const localT = segment - index;
            const pos = this.samplePosition(index, localT);
            if (prevPos) {
                cumulative += vec3.distance(prevPos, pos);
            }
            lut[i] = { u, s: cumulative };
            prevPos = pos;
        }
        this.arcLengthTotal = cumulative;
        if (cumulative > 0) {
            for (const entry of lut) {
                entry.s /= cumulative;
            }
        }
        this.arcLengthLut = lut;
    }

    /** Inverts the arc-length LUT: given a target normalised distance, return u. */
    private paramAtArcLength(sTarget: number): number {
        if (this.arcLengthLut === null) {
            this.buildArcLengthLut();
        }
        // Degenerate path (all keyframes share a position): no spatial movement,
        // so fall back to the raw parameter to keep scalar animation alive.
        if (this.arcLengthTotal <= 0) {
            return sTarget;
        }
        const lut = this.arcLengthLut!;
        if (sTarget <= 0) {
            return 0;
        }
        if (sTarget >= 1) {
            return 1;
        }
        let lo = 0;
        let hi = lut.length - 1;
        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (lut[mid].s < sTarget) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        const a = lut[lo];
        const b = lut[hi];
        const range = b.s - a.s;
        const frac = range > 0 ? (sTarget - a.s) / range : 0;
        return a.u + (b.u - a.u) * frac;
    }

    /**
     * Clamped neighbour lookup (phantom-point technique): out-of-range indices
     * return the nearest endpoint keyframe, which yields natural zero-curvature
     * tangents at the start/end of the rail without overshoot.
     */
    private neighbor(index: number): CameraView {
        return this.keyframes[Math.max(0, Math.min(this.keyframes.length - 1, index))];
    }

    private lerpVec3(a: vec3, b: vec3, t: number): vec3 {
        return vec3.fromValues(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
    }

    private catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
        const t2 = t * t;
        const t3 = t2 * t;
        return (
            0.5 *
            (2 * p1 +
                (-p0 + p2) * t +
                (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
        );
    }

    private catmullRomVec3(p0: vec3, p1: vec3, p2: vec3, p3: vec3, t: number): vec3 {
        return vec3.fromValues(
            this.catmullRom(p0[0], p1[0], p2[0], p3[0], t),
            this.catmullRom(p0[1], p1[1], p2[1], p3[1], t),
            this.catmullRom(p0[2], p1[2], p2[2], p3[2], t),
        );
    }

    private clone(view: CameraView): CameraView {
        return {
            position: vec3.clone(view.position),
            pitch: view.pitch,
            yaw: view.yaw,
            fov: view.fov,
            orthoZoom: view.orthoZoom,
        };
    }
}

/**
 * Folds normalised time into a 0..1 triangle wave, used for ping-pong looping.
 * pingPong(0) = 0, pingPong(0.5) = 0.5, pingPong(1) = 1, pingPong(1.5) = 0.5...
 */
export function pingPong(t: number): number {
    return 1 - Math.abs(1 - (t % 2));
}
