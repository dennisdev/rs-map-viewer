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

export const isIos = checkIphone() || checkIpad();

export const isWallpaperEngine = !!window.wallpaperRegisterAudioListener;

export const isTouchDevice = !!(
    navigator.maxTouchPoints || "ontouchstart" in document.documentElement
);
