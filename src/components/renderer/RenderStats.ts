export class RenderStats {
    frameCount: number = 0;

    frameTime: number = 0;
    frameTimeFps: number = 0;

    lastFrameTime: DOMHighResTimeStamp | undefined;

    frameTimeJs: number = 0;

    getDeltaTime(time: DOMHighResTimeStamp): number {
        return time - (this.lastFrameTime ?? time);
    }

    update(time: DOMHighResTimeStamp) {
        this.frameTime = this.getDeltaTime(time);
        this.lastFrameTime = time;
        if (this.frameTime !== 0) {
            this.frameTimeFps = 1000 / this.frameTime;
        }
    }

    onFrameEnd() {
        this.frameCount++;
        if (this.lastFrameTime !== undefined) {
            this.frameTimeJs = performance.now() - this.lastFrameTime;
        }
    }
}
