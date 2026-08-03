import bzip2WasmUrl from "@foxglove/wasm-bz2/wasm/module.wasm?url";
import bzip2 from "bzip2";

interface BZ2EmscriptenModule {
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAPU8: Uint8Array;
    decompress(
        dstPtr: number,
        dstSize: number,
        srcPtr: number,
        srcSize: number,
        small: number,
    ): { code: number; error?: string; buffer?: Uint8Array };
}

export class Bzip2 {
    static bzip2Header = new Uint8Array("BZh1".split("").map((char) => char.charCodeAt(0)));

    static module: BZ2EmscriptenModule | undefined;

    static async initWasm(): Promise<void> {
        // Fetch the wasm ourselves and inject it via Emscripten's `wasmBinary`
        // option. This bypasses the bundled locateFile/require("./module.wasm")
        // discovery hack, which does not resolve to a URL string under Vite.
        const response = await fetch(bzip2WasmUrl);
        const wasmBinary = await response.arrayBuffer();
        const factory = (await import("@foxglove/wasm-bz2/wasm/module.js"))
            .default as unknown as (config: {
            wasmBinary: ArrayBuffer;
        }) => Promise<BZ2EmscriptenModule>;
        Bzip2.module = await factory({ wasmBinary });
    }

    static decompress(compressed: Uint8Array, actualSize: number): Int8Array {
        const compressedBzip = new Uint8Array(compressed.length + 4);
        compressedBzip.set(Bzip2.bzip2Header, 0);
        compressedBzip.set(compressed, 4);

        if (Bzip2.module) {
            const mod = Bzip2.module;
            const srcPtr = mod._malloc(compressedBzip.byteLength);
            const dstPtr = mod._malloc(actualSize);
            mod.HEAPU8.subarray(srcPtr, srcPtr + compressedBzip.byteLength).set(compressedBzip);
            try {
                const { code, error, buffer } = mod.decompress(
                    dstPtr,
                    actualSize,
                    srcPtr,
                    compressedBzip.byteLength,
                    0,
                );
                if (code !== 0 || buffer == undefined) {
                    throw new Error(`BZ2 decompression failed: ${code} (${error ?? "unknown"})`);
                }
                const decompressed = new Uint8Array(buffer);
                return new Int8Array(decompressed.buffer);
            } finally {
                mod._free(srcPtr);
                mod._free(dstPtr);
            }
        }

        return new Int8Array(bzip2.simple(bzip2.array(compressedBzip)).buffer);
    }
}
