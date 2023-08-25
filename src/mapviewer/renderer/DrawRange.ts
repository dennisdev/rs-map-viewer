export type DrawRange = [number, number, number];

export function newDrawRange(offset: number, elements: number, instances: number = 1): DrawRange {
    return [offset, elements, instances];
}

export const NULL_DRAW_RANGE = newDrawRange(0, 0, 0);
