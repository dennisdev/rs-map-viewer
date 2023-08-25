export class RenderStats {
    frameCount: number = 0;

    frameTimeSec: number = 0;
    frameTimeFps: number = 0;

    lastFrameTimeSec: DOMHighResTimeStamp = 0;

    update(time: DOMHighResTimeStamp) {
        const timeSec = time * 0.001;
        this.frameTimeSec = timeSec - this.lastFrameTimeSec;
        this.lastFrameTimeSec = timeSec;
        this.frameTimeFps = 1.0 / this.frameTimeSec;
    }

    onFrameEnd() {
        this.frameCount++;
    }
}
