import gzip from 'gzip-js';
// import 'bz2';
// import bzip2 from 'bzip2';

import Bzip2 from '@foxglove/wasm-bz2';
import initWasmGzip, { decompressGzip } from 'wasm-gzip/wasm_gzip.js';
const wasmGzipUrl = require('wasm-gzip/wasm_gzip_bg.wasm');

const bzip2 = require('bzip2');

const bzip2Header = new Uint8Array('BZh1'.split('').map(char => char.charCodeAt(0)));

// declare const bz2: any;

export enum CompressionType {
    None,
    Bzip2,
    Gzip
}

export class Compression {
    private static wasmGzipLoaded: boolean;

    private static wasmBzip2: Bzip2;

    private static wasmPromise?: Promise<[boolean, Bzip2]>;

    public static initWasm() {
        if (Compression.wasmPromise) {
            return Compression.wasmPromise;
        }

        const gzipPromise = initWasmGzip(wasmGzipUrl).then(output => Compression.wasmGzipLoaded = true);
        const bzip2Promise = Bzip2.init().then(instance => Compression.wasmBzip2 = instance);

        Compression.wasmPromise = Promise.all([gzipPromise, bzip2Promise]);
        return Compression.wasmPromise;
    }

    public static decompressGzip(compressed: Uint8Array): Int8Array {
        if (!Compression.wasmGzipLoaded) {
            // console.log('gzip pure')
            return new Int8Array(gzip.unzip(compressed));
        }
        // console.log('gzip wasm')
        // const gunzip = new Zlib.Gunzip(new Uint8Array(compressed));
        // return new Int8Array(gzip.unzip(new Uint8Array(compressed)));
        const decompressed = decompressGzip(compressed);
        if (decompressed) {
            return new Int8Array(decompressed.buffer);
        }
        throw new Error('Failed decompressing gzip');
        // return new Int8Array(window.flate.gzip_decode_raw(new Uint8Array(compressed)));
    }

    public static decompressBzip2(compressed: Uint8Array, actualSize: number): Int8Array {
        // console.log('bzip2', actualSize);
        const compressedBzip = new Uint8Array(compressed.length + 4);
        compressedBzip.set(bzip2Header, 0);
		compressedBzip.set(compressed, 4);
        // if (actualSize > 100000 || true) {
            // return new Int8Array(window.bzip2.decompress(compressedBzip, actualSize, { small: false }));
        // }
        // return new Int8Array(bz2.decompress(compressedBzip));
        
        if (Compression.wasmBzip2) {
            return new Int8Array(Compression.wasmBzip2.decompress(compressedBzip, actualSize, { small: false }).buffer);
        }
        // console.log('bzip2 pure');
        return new Int8Array(bzip2.simple(bzip2.array(compressedBzip)).buffer);
    }
}
