export class DirectionFlag {
    public static readonly NORTH: number = 0x1;
    public static readonly EAST: number = 0x2;
    public static readonly SOUTH: number = 0x4;
    public static readonly WEST: number = 0x8;

    public static readonly SOUTH_WEST: number =
        DirectionFlag.WEST | DirectionFlag.SOUTH;
    public static readonly NORTH_WEST: number =
        DirectionFlag.WEST | DirectionFlag.NORTH;
    public static readonly SOUTH_EAST: number =
        DirectionFlag.EAST | DirectionFlag.SOUTH;
    public static readonly NORTH_EAST: number =
        DirectionFlag.EAST | DirectionFlag.NORTH;
}
