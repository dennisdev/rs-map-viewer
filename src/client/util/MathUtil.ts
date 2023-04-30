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

/**
 * Circular lerp looping around after its range
 * A range of [0, 100] can jump between 100 and 0, so the shortest path will go through through 100
 * EX: 10, 2, .5, 10 will return `1`, as `10` is equal to `0`
 */
export const slerp = (
    start: number,
    end: number,
    progress: number,
    range: number
) => {
    if (progress <= 0) {
        return start;
    } else if (progress >= 1) {
        return end;
    }
    const shortest_distance =
        ((((end - start) % range) + range * 1.5) % range) - range / 2;
    const movement = shortest_distance * progress;
    return start + movement;
};
