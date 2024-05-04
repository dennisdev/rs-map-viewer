import { isWebGPUSupported } from "../../util/DeviceUtil";
import { MapViewerRenderer } from "../../mapviewer/MapViewerRenderer";
import { RendererType, WEBGPU } from "../Renderers";
import fullscreenTexturedQuadShader from "./shaders/fullscreenTexturedQuad.wgsl?source";
import redFragShader from "./shaders/red.frag.wgsl?source";
import triangleVertShader from "./shaders/triangle.vert.wgsl?source";

const ENABLED = false;

export class WebGPURenderer extends MapViewerRenderer {
    type: RendererType = WEBGPU;

    adapter!: GPUAdapter;
    device!: GPUDevice;

    context!: GPUCanvasContext;

    pipeline!: GPURenderPipeline;
    fullscreenQuadPipeline!: GPURenderPipeline;

    sampler!: GPUSampler;

    textureArray!: GPUTexture;

    showResultBindGroup!: GPUBindGroup;

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
        const device = (this.device = await adapter.requestDevice());

        this.context = this.canvas.getContext("webgpu")!;

        const preferredFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: preferredFormat,
            alphaMode: "premultiplied",
        });

        this.pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: device.createShaderModule({
                    code: triangleVertShader,
                }),
                entryPoint: "main",
            },
            fragment: {
                module: device.createShaderModule({
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

        const fullscreenTexturedQuadShaderModule = device.createShaderModule({
            code: fullscreenTexturedQuadShader,
        });

        this.fullscreenQuadPipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: fullscreenTexturedQuadShaderModule,
                entryPoint: "vert_main",
            },
            fragment: {
                module: fullscreenTexturedQuadShaderModule,
                entryPoint: "frag_main",
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

        this.sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });

        console.log(adapter.limits);

        this.initTextures();

        this.showResultBindGroup = device.createBindGroup({
            layout: this.fullscreenQuadPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: this.sampler,
                },
                {
                    binding: 1,
                    resource: this.textureArray.createView(),
                },
            ],
        });
    }

    initTextures(): void {
        const textureLoader = this.mapViewer.cacheLoaders.textureLoader;

        const textureIds = textureLoader
            .getTextureIds()
            .slice(0, this.device.limits.maxTextureArrayLayers - 1);
        const textureCount = textureIds.length + 1;

        const textureSize = 128;

        const pixelCount = textureSize * textureSize;

        const pixels = new Int32Array(textureCount * pixelCount);
        // White texture
        pixels.fill(0xffffffff, 0, pixelCount);

        this.textureArray = this.device.createTexture({
            size: {
                width: textureSize,
                height: textureSize,
                depthOrArrayLayers: textureCount,
            },
            format: "rgba8unorm",
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        });

        for (let i = 0; i < textureIds.length; i++) {
            const textureId = textureIds[i];
            try {
                const texturePixels = this.mapViewer.cacheLoaders.textureLoader.getPixelsArgb(
                    textureId,
                    textureSize,
                    true,
                    1.0,
                );
                pixels.set(texturePixels, (i + 1) * pixelCount);
                // pixels.set(texturePixels, (i) * pixelCount);
            } catch (e) {
                console.error("Failed loading texture", textureId, e);
            }
        }

        this.device.queue.writeTexture(
            {
                texture: this.textureArray,
            },
            pixels,
            {
                bytesPerRow: textureSize * 4,
                rowsPerImage: textureSize,
            },
            {
                width: textureSize,
                height: textureSize,
                depthOrArrayLayers: textureCount,
            },
        );
    }

    rendererUpdate(): void { }

    render(time: number, deltaTime: number, resized: boolean): void {
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
        // passEncoder.setPipeline(pipeline);
        // passEncoder.draw(3);

        passEncoder.setPipeline(this.fullscreenQuadPipeline);
        passEncoder.setBindGroup(0, this.showResultBindGroup);
        passEncoder.draw(6);

        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
    }
}
