import { isWebGPUSupported } from "../../util/DeviceUtil";
import { MapViewerRenderer } from "../MapViewerRenderer";
import { MapViewerRendererType, WEBGPU } from "../MapViewerRenderers";
import redFragShader from "./shaders/red.frag.wgsl?source";
import triangleVertShader from "./shaders/triangle.vert.wgsl?source";

const ENABLED = false;

export class WebGPUMapViewerRenderer extends MapViewerRenderer {
    type: MapViewerRendererType = WEBGPU;

    adapter!: GPUAdapter;
    device!: GPUDevice;

    context!: GPUCanvasContext;

    pipeline!: GPURenderPipeline;

    static isSupported(): boolean {
        return isWebGPUSupported && ENABLED;
    }

    async init(): Promise<void> {
        await super.init();

        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) {
            throw new Error("No adapter found");
        }
        this.adapter = adapter;
        this.device = await adapter.requestDevice();

        this.context = this.canvas.getContext("webgpu")!;

        const preferredFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: preferredFormat,
            alphaMode: "premultiplied",
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: this.device.createShaderModule({
                    code: triangleVertShader,
                }),
                entryPoint: "main",
            },
            fragment: {
                module: this.device.createShaderModule({
                    code: redFragShader,
                }),
                entryPoint: "main",
                targets: [
                    {
                        format: preferredFormat,
                    },
                ],
            },
            primitive: {
                topology: "triangle-list",
            },
        });
    }

    render(time: number, deltaTime: number, resized: boolean): void {
        const camera = this.mapViewer.camera;

        this.handleInput(deltaTime);

        camera.update(this.canvas.width, this.canvas.height);

        const device = this.device;
        const context = this.context;
        const pipeline = this.pipeline;

        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.draw(3);
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
    }
}
