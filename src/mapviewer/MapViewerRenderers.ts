import { MapViewer } from "./MapViewer";
import { MapViewerRenderer } from "./MapViewerRenderer";
import { WebGLMapViewerRenderer } from "../renderer/webgl/WebGLMapViewerRenderer";
import { WebGPUMapViewerRenderer } from "../renderer/webgpu/WebGPUMapViewerRenderer";

export type MapViewerRendererType = "webgl" | "webgpu";
export const WEBGL: MapViewerRendererType = "webgl";
export const WEBGPU: MapViewerRendererType = "webgpu";

export function getRendererName(type: MapViewerRendererType): string {
    switch (type) {
        case WEBGL:
            return "WebGL";
        case WEBGPU:
            return "WebGPU";
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
        case WEBGPU:
            return new WebGPUMapViewerRenderer(mapViewer);
        default:
            throw new Error("Unknown renderer type");
    }
}

export function getAvailableRenderers(): MapViewerRendererType[] {
    const renderers: MapViewerRendererType[] = [];

    if (WebGLMapViewerRenderer.isSupported()) {
        renderers.push(WEBGL);
    }

    if (WebGPUMapViewerRenderer.isSupported()) {
        renderers.push(WEBGPU);
    }

    return renderers;
}
