import pako from "pako";

export class Gzip {
    static async initWasm(): Promise<void> {}

    static decompress(compressed: Uint8Array): Int8Array {
        const decompressed = new Int8Array(pako.ungzip(compressed).buffer);
        return decompressed;
    }
}
