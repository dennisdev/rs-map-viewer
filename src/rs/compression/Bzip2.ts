import WasmBzip2 from "@foxglove/wasm-bz2";

const bzip2 = require("bzip2");

export class Bzip2 {
    static bzip2Header = new Uint8Array("BZh1".split("").map((char) => char.charCodeAt(0)));

    static wasmBzip: WasmBzip2;

    static async initWasm(): Promise<WasmBzip2> {
        const bzip = await WasmBzip2.init();
        Bzip2.wasmBzip = bzip;
        return bzip;
    }

    static decompress(compressed: Uint8Array, actualSize: number): Int8Array {
        const compressedBzip = new Uint8Array(compressed.length + 4);
        compressedBzip.set(Bzip2.bzip2Header, 0);
        compressedBzip.set(compressed, 4);

        if (Bzip2.wasmBzip) {
            const decompressed = Bzip2.wasmBzip.decompress(compressedBzip, actualSize, {
                small: false,
            });
            return new Int8Array(decompressed.buffer);
        }

        return new Int8Array(bzip2.simple(bzip2.array(compressedBzip)).buffer);
    }
}
