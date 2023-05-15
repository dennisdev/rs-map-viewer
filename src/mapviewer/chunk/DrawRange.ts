export type DrawRange = [number, number, number];

export function newDrawRange(
    offset: number,
    elements: number,
    instances: number
): DrawRange {
    return [offset, elements, instances];
}
