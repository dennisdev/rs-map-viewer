import { mat4 } from "gl-matrix";
import { DrawCall, App as PicoApp, PicoGL, Program, VertexArray, VertexBuffer } from "picogl";

import { CameraPathGeometry } from "../MapViewerRenderer";

// Vivid, high-contrast colours (overlay is drawn opaque, always-on-top).
const PATH_COLOR: Float32Array = new Float32Array([1.0, 0.82, 0.2, 1.0]); // amber
const DOT_COLOR: Float32Array = new Float32Array([1.0, 0.65, 0.1, 1.0]); // orange
const KEYFRAME_COLOR: Float32Array = new Float32Array([0.25, 0.85, 1.0, 1.0]); // cyan
const AIM_COLOR: Float32Array = new Float32Array([1.0, 0.3, 0.85, 1.0]); // pink
const HIGHLIGHT_COLOR: Float32Array = new Float32Array([1.0, 1.0, 1.0, 1.0]); // white

const DOT_POINT_SIZE = 7.0;
const KEYFRAME_POINT_SIZE = 20.0;
const AIM_TIP_SIZE = 9.0;
const HIGHLIGHT_POINT_SIZE = 13.0;

/**
 * Draws the authored camera rail in world space, always rendered on top of the
 * scene (never occluded by terrain). Owned by the WebGL renderer and drawn each
 * frame while visible (typically while playback is paused).
 *
 * The path is drawn as a 1px line strip (spatially sampled) for the smooth
 * curve. A separate point trail is sampled at equal *time* intervals across the
 * recording, so dot density correlates with camera speed (slow zones bunch up,
 * fast zones spread out). Keyframes are larger markers; each also gets a short
 * aim segment showing where the camera looks.
 */
export class CameraTrackOverlay {
    private pathBuffer?: VertexBuffer;
    private pathArray?: VertexArray;
    private pathLineDrawCall?: DrawCall;
    private highlightDrawCall?: DrawCall;
    private pathVertexCount = 0;

    private dotBuffer?: VertexBuffer;
    private dotArray?: VertexArray;
    private dotDrawCall?: DrawCall;

    private keyframeBuffer?: VertexBuffer;
    private keyframeArray?: VertexArray;
    private keyframeDrawCall?: DrawCall;
    private keyframeVertexCount = 0;

    private aimBuffer?: VertexBuffer;
    private aimArray?: VertexArray;
    private aimLineDrawCall?: DrawCall;
    private aimTipDrawCall?: DrawCall;

    private visible = true;
    private highlightedSegment = -1;

    constructor(
        private readonly app: PicoApp,
        private readonly program: Program,
    ) {}

    setVisible(visible: boolean): void {
        this.visible = visible;
    }

    /** Highlight a path segment by index (the path between keyframe i and i+1). -1 clears it. */
    setHighlightedSegment(index: number): void {
        this.highlightedSegment = index;
    }

    setPath(geometry: CameraPathGeometry): void {
        this.buildPath(geometry.path);
        this.buildDots(geometry.dots);
        this.buildKeyframes(geometry.keyframes);
        this.buildAims(geometry.aims);
    }

    render(viewProjMatrix: mat4): void {
        if (!this.visible) {
            return;
        }
        const vp = viewProjMatrix as Float32Array;

        if (this.pathLineDrawCall && this.pathVertexCount > 1) {
            this.pathLineDrawCall.uniform("u_viewProjMatrix", vp);
            this.pathLineDrawCall.draw();
        }
        if (this.dotDrawCall) {
            this.dotDrawCall.uniform("u_viewProjMatrix", vp);
            this.dotDrawCall.draw();
        }
        if (this.aimLineDrawCall) {
            this.aimLineDrawCall.uniform("u_viewProjMatrix", vp);
            this.aimLineDrawCall.draw();
        }
        if (this.aimTipDrawCall) {
            this.aimTipDrawCall.uniform("u_viewProjMatrix", vp);
            this.aimTipDrawCall.draw();
        }
        if (
            this.highlightDrawCall &&
            this.highlightedSegment >= 0 &&
            this.keyframeVertexCount > 1
        ) {
            const segmentCount = this.keyframeVertexCount - 1;
            const i = Math.min(this.highlightedSegment, segmentCount - 1);
            if (i >= 0) {
                const start = Math.round((i * this.pathVertexCount) / segmentCount);
                const end = Math.round(((i + 1) * this.pathVertexCount) / segmentCount);
                const count = Math.max(1, end - start);
                this.highlightDrawCall.uniform("u_viewProjMatrix", vp);
                this.highlightDrawCall.drawRanges([start, count]);
                this.highlightDrawCall.draw();
            }
        }
        if (this.keyframeDrawCall && this.keyframeVertexCount > 0) {
            this.keyframeDrawCall.uniform("u_viewProjMatrix", vp);
            this.keyframeDrawCall.draw();
        }
    }

    dispose(): void {
        this.pathBuffer?.delete();
        this.pathArray?.delete();
        this.dotBuffer?.delete();
        this.dotArray?.delete();
        this.keyframeBuffer?.delete();
        this.keyframeArray?.delete();
        this.aimBuffer?.delete();
        this.aimArray?.delete();
        this.pathBuffer = undefined;
        this.pathArray = undefined;
        this.dotBuffer = undefined;
        this.dotArray = undefined;
        this.keyframeBuffer = undefined;
        this.keyframeArray = undefined;
        this.aimBuffer = undefined;
        this.aimArray = undefined;
        this.pathLineDrawCall = undefined;
        this.highlightDrawCall = undefined;
        this.dotDrawCall = undefined;
        this.keyframeDrawCall = undefined;
        this.aimLineDrawCall = undefined;
        this.aimTipDrawCall = undefined;
        this.pathVertexCount = 0;
        this.keyframeVertexCount = 0;
    }

    private buildPath(positions: Float32Array): void {
        this.pathBuffer?.delete();
        this.pathArray?.delete();
        this.pathVertexCount = Math.floor(positions.length / 3);
        if (positions.length === 0) {
            this.pathLineDrawCall = undefined;
            this.highlightDrawCall = undefined;
            return;
        }
        this.pathBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 3, positions);
        this.pathArray = this.app.createVertexArray().vertexAttributeBuffer(0, this.pathBuffer);
        this.pathLineDrawCall = this.app
            .createDrawCall(this.program, this.pathArray)
            .primitive(PicoGL.LINE_STRIP)
            .uniform("u_color", PATH_COLOR)
            .uniform("u_pointSize", 1.0);
        this.highlightDrawCall = this.app
            .createDrawCall(this.program, this.pathArray)
            .primitive(PicoGL.POINTS)
            .uniform("u_color", HIGHLIGHT_COLOR)
            .uniform("u_pointSize", HIGHLIGHT_POINT_SIZE);
    }

    /** Point trail sampled at equal time intervals (density ∝ 1/speed). */
    private buildDots(positions: Float32Array): void {
        this.dotBuffer?.delete();
        this.dotArray?.delete();
        if (positions.length === 0) {
            this.dotDrawCall = undefined;
            return;
        }
        this.dotBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 3, positions);
        this.dotArray = this.app.createVertexArray().vertexAttributeBuffer(0, this.dotBuffer);
        this.dotDrawCall = this.app
            .createDrawCall(this.program, this.dotArray)
            .primitive(PicoGL.POINTS)
            .uniform("u_color", DOT_COLOR)
            .uniform("u_pointSize", DOT_POINT_SIZE);
    }

    private buildKeyframes(positions: Float32Array): void {
        this.keyframeBuffer?.delete();
        this.keyframeArray?.delete();
        this.keyframeVertexCount = Math.floor(positions.length / 3);
        if (positions.length === 0) {
            this.keyframeDrawCall = undefined;
            return;
        }
        this.keyframeBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 3, positions);
        this.keyframeArray = this.app
            .createVertexArray()
            .vertexAttributeBuffer(0, this.keyframeBuffer);
        this.keyframeDrawCall = this.app
            .createDrawCall(this.program, this.keyframeArray)
            .primitive(PicoGL.POINTS)
            .uniform("u_color", KEYFRAME_COLOR)
            .uniform("u_pointSize", KEYFRAME_POINT_SIZE);
    }

    private buildAims(positions: Float32Array): void {
        this.aimBuffer?.delete();
        this.aimArray?.delete();
        if (positions.length === 0) {
            this.aimLineDrawCall = undefined;
            this.aimTipDrawCall = undefined;
            return;
        }
        this.aimBuffer = this.app.createVertexBuffer(PicoGL.FLOAT, 3, positions);
        this.aimArray = this.app.createVertexArray().vertexAttributeBuffer(0, this.aimBuffer);
        // LINES draws each consecutive vertex pair as a segment.
        this.aimLineDrawCall = this.app
            .createDrawCall(this.program, this.aimArray)
            .primitive(PicoGL.LINES)
            .uniform("u_color", AIM_COLOR)
            .uniform("u_pointSize", 1.0);
        // The tip vertex of each pair (every 2nd vertex) marks the aim direction.
        this.aimTipDrawCall = this.app
            .createDrawCall(this.program, this.aimArray)
            .primitive(PicoGL.POINTS)
            .uniform("u_color", AIM_COLOR)
            .uniform("u_pointSize", AIM_TIP_SIZE);
    }
}
