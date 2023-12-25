import { MapViewer } from "./MapViewer";
import { MapViewerRenderer } from "./MapViewerRenderer";
import { WebGLMapViewerRenderer } from "./webgl/WebGLMapViewerRenderer";

export type MapViewerRendererType = "webgl";
export const WEBGL: MapViewerRendererType = "webgl";

export function getRendererName(type: MapViewerRendererType): string {
    switch (type) {
        case WEBGL:
            return "WebGL";
        default:
            throw new Error("Unknown renderer type");
    }
}

export function createRenderer(
    type: MapViewerRendererType,
    mapViewer: MapViewer,
): MapViewerRenderer {
    switch (type) {
        case WEBGL:
            return new WebGLMapViewerRenderer(mapViewer);
        default:
            throw new Error("Unknown renderer type");
    }
}

export function getAvailableRenderers(): MapViewerRendererType[] {
    return [WEBGL];
}
