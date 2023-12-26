import gzip from "gzip-js";
import init, { decompressGzip } from "wasm-gzip";

const wasmGzipUrl = require("wasm-gzip/wasm_gzip_bg.wasm");

export class Gzip {
    static wasmLoaded = false;

    static async initWasm(): Promise<void> {
        await init(wasmGzipUrl);
        Gzip.wasmLoaded = true;
    }

    static decompress(compressed: Uint8Array): Int8Array {
        if (!Gzip.wasmLoaded) {
            const decompressed = new Int8Array(gzip.unzip(compressed));
            return decompressed;
        }
        const decompressed = decompressGzip(compressed);
        if (!decompressed) {
            throw new Error("Failed to decompress gzip");
        }
        return new Int8Array(decompressed.buffer);
    }
}
