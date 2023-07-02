/// <reference types="react-scripts" />

import Bzip2 from "@foxglove/wasm-bz2";

declare global {
    interface Window {
        wallpaperRegisterAudioListener: any;

        wallpaperPropertyListener: any;

        wallpaperFpsLimit?: number;
    }
}

declare module "react" {
    function memo<T extends React.ComponentType<any>>(
        c: T,
        areEqual?: (
            prev: Readonly<React.ComponentProps<T>>,
            next: Readonly<React.ComponentProps<T>>
        ) => boolean
    ): T;
}
