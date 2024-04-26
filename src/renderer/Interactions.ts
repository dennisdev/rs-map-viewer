import PicoGL from "picogl";

export class Interactions {
    interactSize: number;

    interactBuffer: Float32Array;

    pixelBuf: WebGLBuffer | null = null;

    sync: WebGLSync | null = null;

    offsetX = 0;
    offsetY = 0;

    readWidth = 0;
    readHeight = 0;

    constructor(readonly interactRadius: number) {
        this.interactSize = interactRadius * 2 + 1;
        this.interactBuffer = new Float32Array(this.interactSize * this.interactSize * 4);
    }

    read(gl: WebGL2RenderingContext, x: number, y: number): void {
        if (this.sync) {
            return;
        }

        const canvasWidth = gl.canvas.width;
        const canvasHeight = gl.canvas.height;

        const startX = x - this.interactRadius;
        const startY = canvasHeight - y - this.interactRadius - 1;

        const readX = Math.max(startX, 0);
        const readY = Math.max(startY, 0);

        this.offsetX = readX - startX;
        this.offsetY = readY - startY;

        this.readWidth = Math.min(startX + this.interactSize, canvasWidth) - readX;
        this.readHeight = Math.min(startY + this.interactSize, canvasHeight) - readY;

        this.pixelBuf = gl.createBuffer();
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pixelBuf);
        gl.bufferData(gl.PIXEL_PACK_BUFFER, this.interactBuffer.byteLength, gl.STREAM_READ);
        gl.readPixels(readX, readY, this.readWidth, this.readHeight, PicoGL.RGBA, PicoGL.FLOAT, 0);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

        this.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    }

    check(
        gl: WebGL2RenderingContext,
        hoveredMapIds: Set<number>,
        closestInteractIndices: Map<number, number[]>,
    ): boolean {
        if (!this.sync) {
            return false;
        }

        const status = gl.clientWaitSync(this.sync, 0, 0);
        if (status === gl.WAIT_FAILED || status === gl.TIMEOUT_EXPIRED) {
            return false;
        }

        gl.deleteSync(this.sync);
        this.sync = null;

        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pixelBuf);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.interactBuffer);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

        gl.deleteBuffer(this.pixelBuf);

        hoveredMapIds.clear();
        closestInteractIndices.clear();

        for (let y = 0; y < this.readHeight; y++) {
            for (let x = 0; x < this.readWidth; x++) {
                const index = (y * this.readWidth + x) * 4;

                const mapId = this.interactBuffer[index + 1];
                if (mapId !== 0) {
                    hoveredMapIds.add(mapId);
                }

                const interactType = this.interactBuffer[index + 2];
                if (interactType !== 0) {
                    const dist = Math.max(
                        Math.abs(x + this.offsetX - this.interactRadius),
                        Math.abs(y + this.offsetY - this.interactRadius),
                    );

                    const indices = closestInteractIndices.get(dist);
                    if (indices) {
                        indices.push(index);
                    } else {
                        closestInteractIndices.set(dist, [index]);
                    }
                }
            }
        }

        return true;
    }
}
