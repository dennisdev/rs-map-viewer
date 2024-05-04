import { MapViewer } from "../mapviewer/MapViewer";
import { MapViewerRenderer } from "../mapviewer/MapViewerRenderer";
import { WebGLRenderer } from "./webgl/WebGLRenderer";

export type RendererType = "webgl";
export const WEBGL: RendererType = "webgl";

export function getRendererName(type: RendererType): string {
    switch (type) {
        case WEBGL:
            return "WebGL";
        default:
            throw new Error("Unknown renderer type");
    }
}

export function createRenderer(
    type: RendererType,
    mapViewer: MapViewer,
): MapViewerRenderer {
    switch (type) {
        case WEBGL:
            return new WebGLRenderer(mapViewer);
        default:
            throw new Error("Unknown renderer type");
    }
}

export function getAvailableRenderers(): RendererType[] {
    const renderers: RendererType[] = [];

    if (WebGLRenderer.isSupported()) {
        renderers.push(WEBGL);
    }

    return renderers;
}
