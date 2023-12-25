import { MapViewer } from "./MapViewer";
import { MapViewerRenderer } from "./MapViewerRenderer";
import { WebGLMapViewerRenderer } from "./webgl/WebGLMapViewerRenderer";

export type MapViewerRendererType = "webgl" | "webgl-test";
export const WEBGL: MapViewerRendererType = "webgl";
export const WEBGL_TEST: MapViewerRendererType = "webgl-test";

export function getRendererName(type: MapViewerRendererType): string {
    switch (type) {
        case WEBGL:
            return "WebGL";
        case WEBGL_TEST:
            return "WebGL Test";
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
            return new WebGLMapViewerRenderer(mapViewer, false);
        case WEBGL_TEST:
            return new WebGLMapViewerRenderer(mapViewer, true);
        default:
            throw new Error("Unknown renderer type");
    }
}

export function getAvailableRenderers(): MapViewerRendererType[] {
    return [WEBGL, WEBGL_TEST];
}
