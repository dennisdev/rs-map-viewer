export const checkIphone = () => {
    const u = navigator.userAgent;
    return !!u.match(/iPhone/i);
};
export const checkAndroid = () => {
    const u = navigator.userAgent;
    return !!u.match(/Android/i);
};
export const checkIpad = () => {
    const u = navigator.userAgent;
    return !!u.match(/iPad/i);
};
export const checkMobile = () => {
    const u = navigator.userAgent;
    return !!u.match(/Android/i) || !!u.match(/iPhone/i);
};

export function checkIos() {
    // iPad on iOS 13 detection
    const isIpad = navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints >= 1;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || isIpad;
}

export const isIos = checkIos();

export const isWallpaperEngine = !!window.wallpaperRegisterAudioListener;

export const isTouchDevice = !!(
    navigator.maxTouchPoints || "ontouchstart" in document.documentElement
);

export const isWebGL2Supported = !!document.createElement("canvas").getContext("webgl2");

export const isWebGPUSupported = "gpu" in navigator;
