import pako from "pako";
import init, { decompress as wasmDecompress } from "wasm-gzip";

export class Gzip {
    static wasmLoaded = false;

    static async initWasm(): Promise<void> {
        // wasm-gzip v2 auto-discovers its wasm via `new URL(..., import.meta.url)`,
        // so no explicit wasm URL needs to be passed.
        await init();
        Gzip.wasmLoaded = true;
    }

    static decompress(compressed: Uint8Array): Int8Array {
        if (!Gzip.wasmLoaded) {
            return new Int8Array(pako.ungzip(compressed));
        }
        // wasm-gzip returns a view into a reused WASM buffer (see its NOTE: the
        // buffer is only valid until the next call). Copy the exact slice out —
        // using `.buffer` would capture the entire WASM memory and cause a size
        // mismatch against the container's declared decompressed length.
        return new Int8Array(wasmDecompress(compressed));
    }
}
