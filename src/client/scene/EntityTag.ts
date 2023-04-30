export enum EntityType {
    OBJECT = 2,
}

export function calculateEntityTag(
    tileX: number,
    tileY: number,
    entityType: EntityType,
    notInteractive: boolean,
    id: number
): bigint {
    let tag =
        BigInt(tileX & 0x7f) |
        (BigInt(tileY & 0x7f) << 7n) |
        (BigInt(entityType & 3) << 14n) |
        (BigInt(id) << 17n);
    if (notInteractive) {
        tag |= 0x10000n;
    }
    return tag;
}

export function getIdFromEntityTag(tag: bigint) {
    return Number(tag >> 17n);
}
