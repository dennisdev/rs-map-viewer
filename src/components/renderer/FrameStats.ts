export class FrameStats {
    frameCount: number = 0;

    frameTime: number = 0;
    frameTimeFps: number = 0;

    lastFrameTime: DOMHighResTimeStamp | undefined;

    frameTimeStart: number = 0;
    frameTimeJs: number = 0;

    getDeltaTime(time: DOMHighResTimeStamp): number {
        return time - (this.lastFrameTime ?? time);
    }

    update(time: DOMHighResTimeStamp) {
        this.frameTime = this.getDeltaTime(time);
        this.lastFrameTime = time;
        this.frameTimeStart = performance.now();
        if (this.frameTime !== 0) {
            this.frameTimeFps = 1000 / this.frameTime;
        }
    }

    onFrameEnd() {
        this.frameCount++;
        if (this.lastFrameTime !== undefined) {
            this.frameTimeJs = performance.now() - this.frameTimeStart;
        }
    }
}
