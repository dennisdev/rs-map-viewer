import { vec3 } from "gl-matrix";

import { CameraView } from "./Camera";
import { CameraTrack, DurationMode, EasingMode, LoopMode, pingPong } from "./CameraTrack";

function view(x: number, pitch = 0, yaw = 0, fov = 90, orthoZoom = 15): CameraView {
    return {
        position: vec3.fromValues(x, x * 2, x * 3),
        pitch,
        yaw,
        fov,
        orthoZoom,
    };
}

describe("CameraTrack", () => {
    describe("evaluate", () => {
        it("throws when there are no keyframes", () => {
            expect(() => new CameraTrack([]).evaluate(0.5)).toThrow();
        });

        it("returns the single keyframe when there is only one", () => {
            const kf = view(5);
            const track = new CameraTrack([kf]);
            const result = track.evaluate(0.5);
            expect(Array.from(result.position)).toEqual([5, 10, 15]);
        });

        it("clamps time before the first keyframe", () => {
            const track = new CameraTrack([view(0), view(10)]);
            const result = track.evaluate(-1);
            expect(Array.from(result.position)).toEqual([0, 0, 0]);
        });

        it("clamps time after the last keyframe", () => {
            const track = new CameraTrack([view(0), view(10)]);
            const result = track.evaluate(2);
            expect(Array.from(result.position)).toEqual([10, 20, 30]);
        });

        it("does not mutate the stored keyframes when clamping", () => {
            const kf = view(0);
            const track = new CameraTrack([kf, view(10)]);
            track.evaluate(-1).position[0] = 999;
            expect(kf.position[0]).toBe(0);
        });

        it("linearly interpolates the midpoint between two keyframes", () => {
            const track = new CameraTrack([view(0, 0, 0, 90, 10), view(10, 100, 200, 110, 20)], {
                smoothing: 0,
                easing: EasingMode.LINEAR,
            });
            const result = track.evaluate(0.5);
            expect(Array.from(result.position)).toEqual([5, 10, 15]);
            expect(result.pitch).toBe(50);
            expect(result.fov).toBe(100);
            expect(result.orthoZoom).toBe(15);
        });

        it("passes exactly through every keyframe when smoothing is full", () => {
            const keyframes = [view(0), view(10), view(20), view(30), view(40)];
            const track = new CameraTrack(keyframes, {
                smoothing: 1,
                easing: EasingMode.LINEAR,
            });
            for (let i = 0; i < keyframes.length; i++) {
                const t = i / (keyframes.length - 1);
                const result = track.evaluate(t);
                expect(result.position[0]).toBeCloseTo(i * 10, 5);
            }
        });

        it("falls back to linear with fewer than three keyframes", () => {
            const track = new CameraTrack([view(0), view(10)], {
                smoothing: 1,
                easing: EasingMode.LINEAR,
            });
            const result = track.evaluate(0.5);
            expect(Array.from(result.position)).toEqual([5, 10, 15]);
        });

        it("smoothing blends between linear and spline", () => {
            const keyframes = [view(0), view(10), view(20)];
            const linear = new CameraTrack(keyframes, {
                smoothing: 0,
                easing: EasingMode.LINEAR,
            }).evaluate(0.25).position[0];
            const spline = new CameraTrack(keyframes, {
                smoothing: 1,
                easing: EasingMode.LINEAR,
            }).evaluate(0.25).position[0];
            const blended = new CameraTrack(keyframes, {
                smoothing: 0.5,
                easing: EasingMode.LINEAR,
            }).evaluate(0.25).position[0];
            expect(blended).toBeGreaterThan(Math.min(linear, spline));
            expect(blended).toBeLessThan(Math.max(linear, spline));
        });

        it("takes the shortest arc for yaw across the 0/2048 boundary", () => {
            const track = new CameraTrack([view(0, 0, 100), view(10, 0, 1900)], {
                smoothing: 0,
                easing: EasingMode.LINEAR,
            });
            const result = track.evaluate(0.5);
            // 100 -> 1900 forward is +1800; the shortest path is -248 across the
            // wrap, so halfway travels -124 from 100 -> -24 == 2024 (mod 2048).
            const yaw = ((result.yaw % 2048) + 2048) % 2048;
            expect(yaw).toBeCloseTo(2024, 0);
        });

        it("applies ease-in-out timing before mapping to segments", () => {
            const make = (easing: EasingMode) =>
                new CameraTrack([view(0), view(10), view(20)], {
                    smoothing: 0,
                    easing,
                });
            // At t = 0.5 the eased value is exactly 0.5 (symmetric).
            expect(make(EasingMode.EASE_IN_OUT).evaluate(0.5).position[0]).toBeCloseTo(10, 5);
            // Before the midpoint easing slows down, keeping the camera nearer
            // the start than linear timing would.
            const easedQuarter = make(EasingMode.EASE_IN_OUT).evaluate(0.25).position[0];
            const linearQuarter = make(EasingMode.LINEAR).evaluate(0.25).position[0];
            expect(easedQuarter).toBeLessThan(linearQuarter);
        });
    });

    describe("DurationMode.TOTAL_DISTANCE (arc-length constant speed)", () => {
        it("places the spatial midpoint at t = 0.5", () => {
            // An asymmetric path where the spline parameter != arc length.
            const keyframes = [view(0), view(2), view(3), view(4), view(40)];
            const track = new CameraTrack(keyframes, {
                smoothing: 1,
                easing: EasingMode.LINEAR,
                durationMode: DurationMode.TOTAL_DISTANCE,
            });
            const samples = 400;
            const path = track.samplePath(samples);
            // Total arc length (x axis dominates since x scales with index).
            let total = 0;
            const cumulative: number[] = [0];
            for (let i = 1; i < samples; i++) {
                total += Math.abs(path[i * 3] - path[(i - 1) * 3]);
                cumulative.push(total);
            }
            const mid = track.evaluate(0.5).position[0];
            // Find the arc-length fraction at the first sample whose x >= mid.
            let i = 0;
            while (i < samples - 1 && path[i * 3] < mid) {
                i++;
            }
            const fraction = cumulative[i] / total;
            expect(fraction).toBeCloseTo(0.5, 1);
        });

        it("traverses a long segment and a short segment at the same speed", () => {
            // Long segment (0->100) then a tiny one (100->101). Constant speed
            // means equal distance covered per equal time across both segments.
            const track = new CameraTrack([view(0), view(100), view(101)], {
                smoothing: 0,
                easing: EasingMode.LINEAR,
                durationMode: DurationMode.TOTAL_DISTANCE,
            });
            // Sample speeds (|dx/dt|) in the middle of each segment.
            const eps = 1e-3;
            const speedLong =
                Math.abs(track.evaluate(0.4 + eps).position[0] - track.evaluate(0.4).position[0]) /
                eps;
            const speedShort =
                Math.abs(
                    track.evaluate(0.95 + eps).position[0] - track.evaluate(0.95).position[0],
                ) / eps;
            expect(speedLong).toBeCloseTo(speedShort, 0);
        });

        it("does not crash on a degenerate (zero-length) path", () => {
            const track = new CameraTrack([view(5), view(5), view(5)], {
                durationMode: DurationMode.TOTAL_DISTANCE,
            });
            const result = track.evaluate(0.5);
            expect(result.position[0]).toBe(5);
        });
    });

    describe("DurationMode.PER_SEGMENT", () => {
        it("splits time proportional to authored segment durations", () => {
            // Segment 0 has duration 3, segment 1 has duration 1. So segment 0
            // occupies 75% of total time -> the boundary (x=10) is reached at t=0.75.
            const track = new CameraTrack([view(0), view(10), view(20)], {
                smoothing: 0,
                easing: EasingMode.LINEAR,
                durationMode: DurationMode.PER_SEGMENT,
                segmentDurations: [3, 1],
            });
            expect(track.evaluate(0.75).position[0]).toBeCloseTo(10, 5);
            expect(track.evaluate(0.375).position[0]).toBeCloseTo(5, 5);
        });
    });

    describe("samplePath", () => {
        it("returns a flat xyz array of the requested size", () => {
            const track = new CameraTrack([view(0), view(10)], { smoothing: 0 });
            const path = track.samplePath(5);
            expect(path.length).toBe(15);
            expect(path[0]).toBe(0);
            expect(path[3]).toBeCloseTo(2.5, 5);
            expect(path[12]).toBe(10);
        });

        it("samples endpoints exactly", () => {
            const track = new CameraTrack([view(0), view(10), view(20)], { smoothing: 1 });
            const path = track.samplePath(3);
            expect(path[0]).toBeCloseTo(0, 5);
            expect(path[3]).toBeCloseTo(10, 5);
            expect(path[6]).toBeCloseTo(20, 5);
        });

        it("returns an empty buffer for zero keyframes", () => {
            expect(new CameraTrack([]).samplePath(8).length).toBe(0);
        });
    });

    describe("pingPong", () => {
        it("produces a triangle wave in [0, 1]", () => {
            expect(pingPong(0)).toBeCloseTo(0, 10);
            expect(pingPong(0.5)).toBeCloseTo(0.5, 10);
            expect(pingPong(1)).toBeCloseTo(1, 10);
            expect(pingPong(1.5)).toBeCloseTo(0.5, 10);
            expect(pingPong(2)).toBeCloseTo(0, 10);
            expect(pingPong(2.25)).toBeCloseTo(0.25, 10);
        });
    });

    describe("LoopMode enum", () => {
        it("exposes the three loop modes", () => {
            expect(Object.keys(LoopMode).filter((k) => isNaN(Number(k))).length).toBe(3);
        });
    });
});
