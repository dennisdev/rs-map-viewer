import { useRef, useEffect } from 'react';

function resizeCanvas(canvas: HTMLCanvasElement) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (canvas.width !== width || canvas.height !== height) {
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        canvas.width = width;
        canvas.height = height;
        return true;
    }

    return false;
}

const useCanvas = (init: (gl: WebGL2RenderingContext) => void,
    draw: (gl: WebGL2RenderingContext, time: DOMHighResTimeStamp, resized: boolean) => void) => {

    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const gl = canvas.getContext('webgl2');
        if (!gl) {
            throw new Error('This browser does not support webgl2');
        }

        init(gl);

        let animationFrameId = -1;

        const render: FrameRequestCallback = (time) => {
            const resized = resizeCanvas(canvas);
            draw(gl, time, resized);
            animationFrameId = window.requestAnimationFrame(render);
        };

        window.requestAnimationFrame(render);

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [draw]);

    return canvasRef;
};


interface CanvasProps {
    init: (gl: WebGL2RenderingContext) => void;
    draw: (gl: WebGL2RenderingContext, time: DOMHighResTimeStamp, resized: boolean) => void;
}

function WebGLCanvas({ init, draw }: CanvasProps): JSX.Element {
    const ref = useCanvas(init, draw);

    return <canvas ref={ref} tabIndex={0}></canvas>;
}

export default WebGLCanvas;
