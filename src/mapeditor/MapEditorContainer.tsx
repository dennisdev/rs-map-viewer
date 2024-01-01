import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { RendererCanvas } from "../components/renderer/RendererCanvas";
import { MapEditor } from "./MapEditor";

export interface MapEditorContainerProps {
    mapEditor: MapEditor;
}

export function MapEditorContainer({ mapEditor }: MapEditorContainerProps): JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();

    const [fps, setFps] = useState<string>();
    const [debugText, setDebugText] = useState<string>();

    const requestRef = useRef<number | undefined>();

    const animate = (time: DOMHighResTimeStamp) => {
        // Wait for 200ms before updating search params
        if (
            mapEditor.needsSearchParamUpdate &&
            performance.now() - mapEditor.lastTimeSearchParamsUpdated > 200
        ) {
            setSearchParams(mapEditor.getSearchParams(), { replace: true });
            mapEditor.needsSearchParamUpdate = false;
            console.log("Updated search params");
        }

        setFps(Math.round(mapEditor.renderer.stats.frameTimeFps).toString());
        setDebugText(mapEditor.debugText);

        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [searchParams]);

    return (
        <div className="max-height">
            <div className="hud left-top">
                <div className="fps-counter content-text">{fps}</div>
                <div className="fps-counter content-text">{debugText}</div>
            </div>

            <RendererCanvas renderer={mapEditor.renderer} />
        </div>
    );
}
