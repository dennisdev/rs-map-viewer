export enum EntityType {
    PLAYER = 0,
    NPC = 1,
    LOC = 2,
    OBJ = 3,
}

export type EntityTag = bigint;

export function calculateEntityTag(
    tileX: number,
    tileY: number,
    entityType: EntityType,
    notInteractive: boolean,
    id: number,
): EntityTag {
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

export function isEntityInteractive(tag: EntityTag): boolean {
    let interactive = tag !== 0n;
    if (interactive) {
        interactive = (Number(tag >> 16n) & 0x1) === 0;
    }
    return interactive;
}

export function getIdFromTag(tag: EntityTag): number {
    return Number(tag >> 17n);
}

export function getEntityTypeFromTag(tag: EntityTag): EntityType {
    return Number(tag >> 14n) & 0x3;
}
