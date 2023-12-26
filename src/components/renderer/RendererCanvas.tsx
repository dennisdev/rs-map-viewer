import { useEffect, useRef } from "react";

import { Renderer } from "./Renderer";

export interface RendererCanvasProps {
    renderer: Renderer;
}

export function RendererCanvas({ renderer }: RendererCanvasProps): JSX.Element {
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!divRef.current) {
            return;
        }
        divRef.current.appendChild(renderer.canvas);

        renderer.init().then(() => {
            renderer.start();
        });

        return () => {
            renderer.stop();
            divRef.current?.removeChild(renderer.canvas);
        };
    }, [renderer]);

    return <div ref={divRef} style={{ width: "100%", height: "100%" }} tabIndex={0} />;
}
