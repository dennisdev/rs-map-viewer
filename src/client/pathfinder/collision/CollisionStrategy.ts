import { CollisionFlag } from "../flag/CollisionFlag";

export interface CollisionStrategy {
    canMove(tileFlag: number, blockFlag: number): boolean;
}

class NormalCollisionStrategy implements CollisionStrategy {
    canMove(tileFlag: number, blockFlag: number): boolean {
        return (tileFlag & blockFlag) === 0;
    }
}

class BlockedCollisionStrategy implements CollisionStrategy {
    canMove(tileFlag: number, blockFlag: number): boolean {
        const flag = blockFlag & ~CollisionFlag.FLOOR;
        return (tileFlag & flag) === 0 && (tileFlag & CollisionFlag.FLOOR) !== 0;
    }
}

const BLOCK_MOVEMENT = CollisionFlag.WALL_NORTH_WEST
    | CollisionFlag.WALL_NORTH
    | CollisionFlag.WALL_NORTH_EAST
    | CollisionFlag.WALL_EAST
    | CollisionFlag.WALL_SOUTH_EAST
    | CollisionFlag.WALL_SOUTH
    | CollisionFlag.WALL_SOUTH_WEST
    | CollisionFlag.WALL_WEST
    | CollisionFlag.OBJECT

const BLOCK_ROUTE = CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER
    | CollisionFlag.WALL_NORTH_ROUTE_BLOCKER
    | CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER
    | CollisionFlag.WALL_EAST_ROUTE_BLOCKER
    | CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER
    | CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER
    | CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER
    | CollisionFlag.WALL_WEST_ROUTE_BLOCKER
    | CollisionFlag.OBJECT_ROUTE_BLOCKER

class LineOfSightBlockFlagCollision implements CollisionStrategy {
    canMove(tileFlag: number, blockFlag: number): boolean {
        const movementFlags = (blockFlag & BLOCK_MOVEMENT) << 9;
        const routeFlags = (blockFlag & BLOCK_ROUTE) >> 13;
        const finalBlockFlag = movementFlags | routeFlags;
        return (tileFlag & finalBlockFlag) === 0;
    }
}

export const NORMAL_STRATEGY = new NormalCollisionStrategy();
export const BLOCKED_STATEGY = new BlockedCollisionStrategy();
export const FLY_STRATEGY = new LineOfSightBlockFlagCollision();
