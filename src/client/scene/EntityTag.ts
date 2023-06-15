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
        (BigInt(entityType & 0x3) << 14n) |
        (BigInt(id) << 17n);
    if (notInteractive) {
        tag |= 0x10000n;
    }
    return tag;
}

export function isEntityInteractive(tag: bigint): boolean {
    let interactive = tag !== 0n;
    if (interactive) {
        interactive = (Number(tag >> 16n) & 0x1) === 0;
    }
    return interactive;
}

export function getIdFromTag(tag: bigint): number {
    return Number(tag >> 17n);
}

export function getEntityTypeFromTag(tag: bigint): EntityType {
    return Number(tag >> 14n) & 0x3;
}
