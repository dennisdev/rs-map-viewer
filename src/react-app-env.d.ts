/// <reference types="react-scripts" />

import Bzip2 from "@foxglove/wasm-bz2";

declare global {
    interface Window {
        wallpaperRegisterAudioListener: any;

        wallpaperPropertyListener: any;

        wallpaperFpsLimit?: number;
    }
}

// declare module 'bz2' {
//     function decompress(input: Uint8Array): Uint8Array;
//     export = decompress;
// }

// declare module 'bz2';

// declare module 'gzip-js';

// interface Window {
//     bzip2: Bzip2;
// }
