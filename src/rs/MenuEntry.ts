export enum MenuTargetType {
    NONE,
    PLAYER,
    NPC,
    LOC,
    OBJ,
}

export interface MenuEntry {
    option: string;
    targetId: number;
    targetType: MenuTargetType;
    targetName: string;
    targetLevel: number;
}
