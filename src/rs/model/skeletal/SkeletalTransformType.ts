export enum SkeletalTransformType {
    TYPE_0 = 0,
    BONE = 1,
    TYPE_2 = 2,
    TYPE_3 = 3,
    ALPHA = 4,
    TYPE_5 = 5,
}

export function getTransformTypeForId(id: number): SkeletalTransformType {
    if (id < 0 || id > SkeletalTransformType.TYPE_5) {
        return SkeletalTransformType.TYPE_0;
    }
    return id;
}

const CURVE_COUNTS = [0, 9, 3, 6, 1, 3];

export function getCurveCount(type: SkeletalTransformType): number {
    return CURVE_COUNTS[type];
}
