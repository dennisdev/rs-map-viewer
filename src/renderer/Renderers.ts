import { MapViewer } from "../mapviewer/MapViewer";
import { MapViewerRenderer } from "../mapviewer/MapViewerRenderer";
import { WebGLRenderer } from "./webgl/WebGLRenderer";
import { WebGPURenderer } from "./webgpu/WebGPURenderer";

export type RendererType = "webgl" | "webgpu";
export const WEBGL: RendererType = "webgl";
export const WEBGPU: RendererType = "webgpu";

export function getRendererName(type: RendererType): string {
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
    type: RendererType,
    mapViewer: MapViewer,
): MapViewerRenderer {
    switch (type) {
        case WEBGL:
            return new WebGLRenderer(mapViewer);
        case WEBGPU:
            return new WebGPURenderer(mapViewer);
        default:
            throw new Error("Unknown renderer type");
    }
}

export function getAvailableRenderers(): RendererType[] {
    const renderers: RendererType[] = [];

    if (WebGLRenderer.isSupported()) {
        renderers.push(WEBGL);
    }

    if (WebGPURenderer.isSupported()) {
        renderers.push(WEBGPU);
    }

    return renderers;
}
