import { useRef, useEffect, memo } from "react";

function resizeCanvas(canvas: HTMLCanvasElement) {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    if (width !== canvas.width || height !== canvas.height) {
        canvas.width = width;
        canvas.height = height;
        return true;
    }

    return false;
}

export interface GlCanvasProps {
    onInit: (gl: WebGL2RenderingContext) => void;
    onRender: (gl: WebGL2RenderingContext, time: DOMHighResTimeStamp, resized: boolean) => void;
    onCleanup: (gl: WebGL2RenderingContext) => void;
    options?: WebGLContextAttributes;
}

export const GlCanvas = memo(function GlCanvas({
    onInit,
    onRender,
    onCleanup,
    options = { antialias: false },
}: GlCanvasProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const gl = canvas.getContext("webgl2", options);
        if (!gl) {
            throw new Error("Failed to get WebGL context");
        }

        onInit(gl);

        let animationId = -1;
        const animate = (time: DOMHighResTimeStamp) => {
            const resized = resizeCanvas(canvas);

            onRender(gl, time, resized);

            animationId = requestAnimationFrame(animate);
        };

        // Start animating
        animationId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationId);
            onCleanup(gl);
        };
    }, [onInit, onRender, onCleanup, options]);

    return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} tabIndex={0}></canvas>;
});
