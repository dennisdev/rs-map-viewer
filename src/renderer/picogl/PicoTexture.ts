import PicoGL, { App, Texture as TextureType } from "picogl";

const { Texture } = require("picogl/build/module/texture.js");

// Hack to fix invalid mipmap levels

export function createTextureArray(
    app: App,
    image: ArrayBufferView,
    width: number,
    height: number,
    depth: number,
    options: any,
): TextureType {
    return new PicoTexture(
        app.gl,
        app.state,
        PicoGL.TEXTURE_2D_ARRAY,
        image,
        width,
        height,
        depth,
        true,
        options,
    ) as TextureType;
}

export class PicoTexture extends Texture {
    constructor(
        gl: WebGLRenderingContext,
        appState: any,
        binding: number,
        image: ArrayBufferView,
        width: number,
        height: number,
        depth: number,
        mipmaps: boolean,
        options: any,
    ) {
        // @ts-ignore
        super(gl, appState, binding, image, width, height, depth, mipmaps, options);
    }

    resize(width: number, height: number, depth?: number | undefined) {
        if (!(this.gl instanceof WebGL2RenderingContext)) {
            throw new Error("Only WebGL2 is supported");
        }
        const gl = this.gl;
        depth = depth || 0;

        if (
            this.texture &&
            width === this.width &&
            height === this.height &&
            depth === this.depth
        ) {
            return this;
        }

        this.gl.deleteTexture(this.texture);
        if (this.currentUnit !== -1) {
            this.appState.textures[this.currentUnit] = null;
        }

        const thisAny = this as any;

        this.texture = this.gl.createTexture() as any;
        thisAny.bind(Math.max(this.currentUnit, 0));

        this.width = width;
        this.height = height;
        this.depth = depth;

        this.gl.texParameteri(this.binding, gl.TEXTURE_MIN_FILTER, thisAny.minFilter);
        this.gl.texParameteri(this.binding, gl.TEXTURE_MAG_FILTER, thisAny.magFilter);
        this.gl.texParameteri(this.binding, gl.TEXTURE_WRAP_S, thisAny.wrapS);
        this.gl.texParameteri(this.binding, gl.TEXTURE_WRAP_T, thisAny.wrapT);
        this.gl.texParameteri(this.binding, gl.TEXTURE_WRAP_R, thisAny.wrapR);
        this.gl.texParameteri(this.binding, gl.TEXTURE_COMPARE_FUNC, thisAny.compareFunc);
        this.gl.texParameteri(this.binding, gl.TEXTURE_COMPARE_MODE, thisAny.compareMode);

        if (thisAny.minLOD !== null) {
            this.gl.texParameterf(this.binding, gl.TEXTURE_MIN_LOD, thisAny.minLOD);
        }

        if (thisAny.maxLOD !== null) {
            this.gl.texParameterf(this.binding, gl.TEXTURE_MAX_LOD, thisAny.maxLOD);
        }

        if (thisAny.baseLevel !== null) {
            this.gl.texParameteri(this.binding, gl.TEXTURE_BASE_LEVEL, thisAny.baseLevel);
        }

        if (thisAny.maxLevel !== null) {
            this.gl.texParameteri(this.binding, gl.TEXTURE_MAX_LEVEL, thisAny.maxLevel);
        }

        if (thisAny.maxAnisotropy > 1) {
            this.gl.texParameteri(
                this.binding,
                PicoGL.TEXTURE_MAX_ANISOTROPY_EXT,
                thisAny.maxAnisotropy,
            );
        }

        let levels;
        if (this.is3D) {
            if (this.mipmaps) {
                levels = Math.floor(Math.log2(Math.max(this.width, this.height))) + 1;
            } else {
                levels = 1;
            }
            // console.error("creating mip maps for 3d texture", levels)
            this.gl.texStorage3D(
                this.binding,
                levels,
                this.internalFormat,
                this.width,
                this.height,
                this.depth,
            );
        } else {
            if (this.mipmaps) {
                levels = Math.floor(Math.log2(Math.max(this.width, this.height))) + 1;
            } else {
                levels = 1;
            }
            this.gl.texStorage2D(
                this.binding,
                levels,
                this.internalFormat,
                this.width,
                this.height,
            );
        }

        return this;
    }
}
