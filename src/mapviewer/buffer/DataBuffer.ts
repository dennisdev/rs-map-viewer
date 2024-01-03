export class DataBuffer {
    stride: number;

    view: DataView;

    bytes: Uint8Array;

    offset: number;

    constructor(stride: number, count: number, offset: number = 0) {
        this.stride = stride;
        this.view = new DataView(new ArrayBuffer(count * this.stride));
        this.bytes = new Uint8Array(this.view.buffer);
        this.offset = offset;
    }

    clear(): void {
        this.bytes.fill(0);
        this.offset = 0;
    }

    ensureSize(count: number): boolean {
        const byteOffset = this.offset * this.stride;
        if (byteOffset + count * this.stride >= this.view.byteLength) {
            const newLength = Math.max(
                this.view.byteLength * 2,
                this.stride * 128,
                byteOffset + count * this.stride,
            );
            const newView = new DataView(new ArrayBuffer(newLength));
            const newBytes = new Uint8Array(newView.buffer);
            newBytes.set(this.bytes, 0);
            this.view = newView;
            this.bytes = newBytes;
            return true;
        }
        return false;
    }

    byteOffset(): number {
        return this.offset * this.stride;
    }

    byteArray(): Uint8Array {
        return this.bytes.subarray(0, this.byteOffset());
    }
}
