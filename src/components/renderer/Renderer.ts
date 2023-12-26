import { RenderStats } from "./RenderStats";

function resizeCanvas(canvas: HTMLCanvasElement) {
    const devicePixelRatio = window.devicePixelRatio;
    const width = canvas.offsetWidth * devicePixelRatio;
    const height = canvas.offsetHeight * devicePixelRatio;

    if (width !== canvas.width || height !== canvas.height) {
        canvas.width = width;
        canvas.height = height;
        return true;
    }

    return false;
}

export abstract class Renderer {
    canvas: HTMLCanvasElement;
    animationId: number | undefined;
    running: boolean = false;

    fpsLimit: number = 999;

    stats: RenderStats = new RenderStats();

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.tabIndex = 0;
    }

    abstract init(): Promise<void>;

    abstract cleanUp(): void;

    start() {
        this.running = true;
        this.animationId = requestAnimationFrame(this.frameCallback);
    }

    stop() {
        this.running = false;
        if (this.animationId !== undefined) {
            cancelAnimationFrame(this.animationId);
            this.animationId = undefined;
        }
        this.cleanUp();
    }

    onResize(width: number, height: number) {}

    frameCallback = (time: DOMHighResTimeStamp) => {
        try {
            const resized = resizeCanvas(this.canvas);
            if (resized) {
                this.onResize(this.canvas.width, this.canvas.height);
            }

            const deltaTime = this.stats.getDeltaTime(time);

            if (this.fpsLimit && deltaTime > 0) {
                const tolerance = 1;
                if (deltaTime < 1000 / this.fpsLimit - tolerance) {
                    return;
                }
            }

            this.stats.update(time);

            this.render(time, deltaTime, resized);

            this.onFrameEnd();
        } finally {
            if (this.running) {
                this.animationId = requestAnimationFrame(this.frameCallback);
            }
        }
    };

    abstract render(
        time: DOMHighResTimeStamp,
        deltaTime: DOMHighResTimeStamp,
        resized: boolean,
    ): void;

    onFrameEnd() {
        this.stats.onFrameEnd();
    }
}
