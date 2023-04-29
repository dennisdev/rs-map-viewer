export const clamp = (num: number, min: number, max: number) =>
    Math.min(Math.max(num, min), max);

export const lerp = (start: number, end: number, progress: number) => {
    if (progress <= 0) {
        return start;
    } else if (progress >= 1) {
        return end;
    }
    return start + (end - start) * progress;
};
