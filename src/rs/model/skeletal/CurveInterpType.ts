export enum CurveInterpType {
    TYPE_0 = 0,
    TYPE_1 = 1,
    TYPE_2 = 2,
    TYPE_3 = 3,
    TYPE_4 = 4,
}

export function getInterpTypeForId(id: number): CurveInterpType {
    if (id < 0 || id > CurveInterpType.TYPE_4) {
        return CurveInterpType.TYPE_0;
    }
    return id;
}
