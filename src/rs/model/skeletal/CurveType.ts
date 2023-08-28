export enum CurveType {
    TYPE_0 = 0,
    TYPE_1 = 1,
    TYPE_2 = 2,
    TYPE_3 = 3,
    TYPE_4 = 4,
    TYPE_5 = 5,
    TYPE_6 = 6,
    TYPE_7 = 7,
    TYPE_8 = 8,
    TYPE_9 = 9,
    TYPE_10 = 10,
    TYPE_11 = 11,
    TYPE_12 = 12,
    TYPE_13 = 13,
    TYPE_14 = 14,
    TYPE_15 = 15,
    TYPE_16 = 16,
}

export function getCurveTypeForId(id: number): CurveType {
    if (id < 0 || id > CurveType.TYPE_16) {
        return CurveType.TYPE_0;
    }
    return id;
}

const CURVE_INDICES = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 4, 5, 0];

export function getCurveIndex(type: CurveType): number {
    return CURVE_INDICES[type];
}
