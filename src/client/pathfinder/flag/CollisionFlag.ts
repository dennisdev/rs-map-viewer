export class CollisionFlag {
    public static readonly WALL_NORTH_WEST: number = 0x1;
    public static readonly WALL_NORTH: number = 0x2;
    public static readonly WALL_NORTH_EAST: number = 0x4;
    public static readonly WALL_EAST: number = 0x8;
    public static readonly WALL_SOUTH_EAST: number = 0x10;
    public static readonly WALL_SOUTH: number = 0x20;
    public static readonly WALL_SOUTH_WEST: number = 0x40;
    public static readonly WALL_WEST: number = 0x80;
    public static readonly OBJECT: number = 0x100;
    public static readonly WALL_NORTH_WEST_PROJECTILE_BLOCKER: number = 0x200;
    public static readonly WALL_NORTH_PROJECTILE_BLOCKER: number = 0x400;
    public static readonly WALL_NORTH_EAST_PROJECTILE_BLOCKER: number = 0x800;
    public static readonly WALL_EAST_PROJECTILE_BLOCKER: number = 0x1000;
    public static readonly WALL_SOUTH_EAST_PROJECTILE_BLOCKER: number = 0x2000;
    public static readonly WALL_SOUTH_PROJECTILE_BLOCKER: number = 0x4000;
    public static readonly WALL_SOUTH_WEST_PROJECTILE_BLOCKER: number = 0x8000;
    public static readonly WALL_WEST_PROJECTILE_BLOCKER: number = 0x10000;
    public static readonly OBJECT_PROJECTILE_BLOCKER: number = 0x20000;
    public static readonly FLOOR_DECORATION: number = 0x40000;

    /**
     * Custom flag dedicated to blocking NPCs.
     * It should be noted that this is a custom flag, and you do not need to use this.
     * The pathfinder takes the flag as a custom option, so you may use any other flag, this just defines
     * a reliable constant to use
     */
    public static readonly BLOCK_NPCS: number = 0x80000;

    /**
     * Custom flag dedicated to blocking players, projectiles as well as NPCs.
     * An example of a monster to set this flag is Brawler. Note that it is unclear if this flag
     * prevents NPCs, as there is a separate flag option for it.
     * This flag is similar to the one above, except it's strictly for NPCs.
     */
    public static readonly BLOCK_PLAYERS: number = 0x100000;

    public static readonly FLOOR: number = 0x200000;
    public static readonly WALL_NORTH_WEST_ROUTE_BLOCKER: number = 0x400000;
    public static readonly WALL_NORTH_ROUTE_BLOCKER: number = 0x800000;
    public static readonly WALL_NORTH_EAST_ROUTE_BLOCKER: number = 0x1000000;
    public static readonly WALL_EAST_ROUTE_BLOCKER: number = 0x2000000;
    public static readonly WALL_SOUTH_EAST_ROUTE_BLOCKER: number = 0x4000000;
    public static readonly WALL_SOUTH_ROUTE_BLOCKER: number = 0x8000000;
    public static readonly WALL_SOUTH_WEST_ROUTE_BLOCKER: number = 0x10000000;
    public static readonly WALL_WEST_ROUTE_BLOCKER: number = 0x20000000;
    public static readonly OBJECT_ROUTE_BLOCKER: number = 0x40000000;

    public static readonly FLOOR_BLOCKED: number = CollisionFlag.FLOOR | CollisionFlag.FLOOR_DECORATION;

    /* Mixed masks of the above flags */
    public static readonly BLOCK_WEST: number = CollisionFlag.WALL_EAST
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_EAST: number = CollisionFlag.WALL_WEST
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_SOUTH: number = CollisionFlag.WALL_NORTH
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_NORTH: number = CollisionFlag.WALL_SOUTH
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_SOUTH_WEST: number = CollisionFlag.WALL_NORTH
        | CollisionFlag.WALL_NORTH_EAST
        | CollisionFlag.WALL_EAST
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_SOUTH_EAST: number = CollisionFlag.WALL_NORTH_WEST
        | CollisionFlag.WALL_NORTH
        | CollisionFlag.WALL_WEST
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_NORTH_WEST: number = CollisionFlag.WALL_EAST
        | CollisionFlag.WALL_SOUTH_EAST
        | CollisionFlag.WALL_SOUTH
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_NORTH_EAST: number = CollisionFlag.WALL_SOUTH
        | CollisionFlag.WALL_SOUTH_WEST
        | CollisionFlag.WALL_WEST
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_NORTH_AND_SOUTH_EAST: number = CollisionFlag.WALL_NORTH
        | CollisionFlag.WALL_NORTH_EAST
        | CollisionFlag.WALL_EAST
        | CollisionFlag.WALL_SOUTH_EAST
        | CollisionFlag.WALL_SOUTH
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_NORTH_AND_SOUTH_WEST: number = CollisionFlag.WALL_NORTH_WEST
        | CollisionFlag.WALL_NORTH
        | CollisionFlag.WALL_SOUTH
        | CollisionFlag.WALL_SOUTH_WEST
        | CollisionFlag.WALL_WEST
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_NORTH_EAST_AND_WEST: number = CollisionFlag.WALL_NORTH_WEST
        | CollisionFlag.WALL_NORTH
        | CollisionFlag.WALL_NORTH_EAST
        | CollisionFlag.WALL_EAST
        | CollisionFlag.WALL_WEST
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    public static readonly BLOCK_SOUTH_EAST_AND_WEST: number = CollisionFlag.WALL_EAST
        | CollisionFlag.WALL_SOUTH_EAST
        | CollisionFlag.WALL_SOUTH
        | CollisionFlag.WALL_SOUTH_WEST
        | CollisionFlag.WALL_WEST
        | CollisionFlag.OBJECT
        | CollisionFlag.FLOOR_BLOCKED

    /* Route blocker flags. These are used in ~550+ clients to generate paths through bankers and such. */
    public static readonly BLOCK_WEST_ROUTE_BLOCKER: number = CollisionFlag.WALL_EAST_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_EAST_ROUTE_BLOCKER: number = CollisionFlag.WALL_WEST_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_SOUTH_ROUTE_BLOCKER: number = CollisionFlag.WALL_NORTH_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_NORTH_ROUTE_BLOCKER: number = CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_SOUTH_WEST_ROUTE_BLOCKER: number = CollisionFlag.WALL_NORTH_ROUTE_BLOCKER
        | CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_EAST_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_SOUTH_EAST_ROUTE_BLOCKER: number = CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER
        | CollisionFlag.WALL_NORTH_ROUTE_BLOCKER
        | CollisionFlag.WALL_WEST_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_NORTH_WEST_ROUTE_BLOCKER: number = CollisionFlag.WALL_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_NORTH_EAST_ROUTE_BLOCKER: number = CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER
        | CollisionFlag.WALL_WEST_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_NORTH_AND_SOUTH_EAST_ROUTE_BLOCKER: number = CollisionFlag.WALL_NORTH_ROUTE_BLOCKER
        | CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_NORTH_AND_SOUTH_WEST_ROUTE_BLOCKER: number = CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER
        | CollisionFlag.WALL_NORTH_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER
        | CollisionFlag.WALL_WEST_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_NORTH_EAST_AND_WEST_ROUTE_BLOCKER: number = CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER
        | CollisionFlag.WALL_NORTH_ROUTE_BLOCKER
        | CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_WEST_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
    public static readonly BLOCK_SOUTH_EAST_AND_WEST_ROUTE_BLOCKER: number = CollisionFlag.WALL_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER
        | CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER
        | CollisionFlag.WALL_WEST_ROUTE_BLOCKER
        | CollisionFlag.OBJECT_ROUTE_BLOCKER
        | CollisionFlag.FLOOR_BLOCKED
}
