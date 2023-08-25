import { CollisionMap } from "../scene/CollisionMap";
import { CollisionStrategy } from "./CollisionStrategy";
import { CollisionFlag } from "./flag/CollisionFlag";
import { DirectionFlag } from "./flag/DirectionFlag";
import { RouteStrategy } from "./RouteStrategy";

const DEFAULT_GRAPH_SIZE = 128;
const DEFAULT_DISTANCE = 99999999;

const ALTERNATIVE_ROUTE_MAX_DISTANCE = 100;
const ALTERNATIVE_ROUTE_RANGE = 10;

export class Pathfinder {
    directions: Int32Array[];
    distances: Int32Array[];
    flags: Int32Array[];

    queueSize: number;

    bufferX: Int32Array;
    bufferY: Int32Array;

    exitX: number = -1;
    exitY: number = -1;

    bufReaderIndex: number = 0;
    bufWriterIndex: number = 0;

    constructor(public graphSize: number = DEFAULT_GRAPH_SIZE) {
        this.directions = new Array(graphSize);
        this.distances = new Array(graphSize);
        this.flags = new Array(graphSize);
        for (let i = 0; i < graphSize; i++) {
            this.directions[i] = new Int32Array(graphSize);
            this.distances[i] = new Int32Array(graphSize);
            this.flags[i] = new Int32Array(graphSize);
        }

        this.queueSize = (graphSize * graphSize) / 4;

        this.bufferX = new Int32Array(this.queueSize);
        this.bufferY = new Int32Array(this.queueSize);
    }

    reset() {
        for (let i = 0; i < this.graphSize; i++) {
            this.directions[i].fill(0);
            this.distances[i].fill(DEFAULT_DISTANCE);
        }
        this.bufReaderIndex = 0;
        this.bufWriterIndex = 0;
    }

    setNpcFlags(
        srcX: number,
        srcY: number,
        spawnX: number,
        spawnY: number,
        wanderRadius: number,
        borderSize: number,
        collisionMap: CollisionMap,
    ) {
        const graphBaseX = srcX - this.graphSize / 2;
        const graphBaseY = srcY - this.graphSize / 2;

        for (let i = 0; i < this.graphSize; i++) {
            this.flags[i].fill(-1);
        }

        const startX = Math.max(spawnX - wanderRadius, 0);
        const startY = Math.max(spawnY - wanderRadius, 0);
        const endX = Math.min(spawnX + wanderRadius, 64);
        const endY = Math.min(spawnY + wanderRadius, 64);

        for (let fillX = startX; fillX < endX; fillX++) {
            for (let fillY = startY; fillY < endY; fillY++) {
                const x = fillX & 0x3f;
                const y = fillY & 0x3f;

                this.flags[fillX - graphBaseX][fillY - graphBaseY] = collisionMap.getFlag(
                    x + borderSize,
                    y + borderSize,
                );
            }
        }
    }

    findPath(
        srcX: number,
        srcY: number,
        srcSize: number,
        level: number,
        routeStrategy: RouteStrategy,
        collisionStrategy: CollisionStrategy,
        customFlag: number = 0,
        findAlternative: boolean = true,
    ): number {
        this.reset();

        let found = false;
        switch (srcSize) {
            case 1:
                found = this.findPathS1(
                    srcX,
                    srcY,
                    level,
                    routeStrategy,
                    collisionStrategy,
                    customFlag,
                );
                break;
            case 2:
                found = this.findPathS2(
                    srcX,
                    srcY,
                    level,
                    routeStrategy,
                    collisionStrategy,
                    customFlag,
                );
                break;
            default:
                found = this.findPathSX(
                    srcX,
                    srcY,
                    srcSize,
                    level,
                    routeStrategy,
                    collisionStrategy,
                    customFlag,
                );
                break;
        }

        if (!found && !findAlternative) {
            return -1;
        }

        // when we start searching for path, we position ourselves in the middle of graph
        // so the base(minimum) position is source_pos - HALF_GRAPH_SIZE.
        const graphBaseX = srcX - this.graphSize / 2;
        const graphBaseY = srcY - this.graphSize / 2;
        let endX = this.exitX;
        let endY = this.exitY;
        if (!found && findAlternative) {
            let lowestCost = Number.MAX_SAFE_INTEGER;
            let lowestDistance = Number.MAX_SAFE_INTEGER;

            const approxDestX = routeStrategy.approxDestX;
            const approxDestY = routeStrategy.approxDestY;

            // what we will do here is search the coordinates range of destination +- ALTERNATIVE_ROUTE_RANGE
            // to see if at least one position in that range is reachable, and reaching it takes no longer than ALTERNATIVE_ROUTE_MAX_DISTANCE steps.
            // if we have multiple positions in our range that fits all the conditions, we will choose the one which takes fewer steps.

            for (
                let checkX = approxDestX - ALTERNATIVE_ROUTE_RANGE;
                checkX <= approxDestX + ALTERNATIVE_ROUTE_RANGE;
                checkX++
            ) {
                for (
                    let checkY = approxDestY - ALTERNATIVE_ROUTE_RANGE;
                    checkY <= approxDestY + ALTERNATIVE_ROUTE_RANGE;
                    checkY++
                ) {
                    const graphX = checkX - graphBaseX;
                    const graphY = checkY - graphBaseY;
                    if (
                        graphX < 0 ||
                        graphY < 0 ||
                        graphX >= this.graphSize ||
                        graphY >= this.graphSize ||
                        this.distances[graphX][graphY] >= ALTERNATIVE_ROUTE_MAX_DISTANCE
                    ) {
                        continue; // we are out of graph's bounds or too much steps.
                    }
                    // calculate the delta's.
                    // when calculating, we are also taking the approximated destination size into account to increase precise.
                    let deltaX = 0;
                    let deltaY = 0;
                    if (approxDestX <= checkX) {
                        deltaX = 1 - approxDestX - (routeStrategy.destSizeX - checkX);
                        //deltaX = (approxDestX + (strategy.getApproxDestinationSizeX() - 1)) < checkX ? (approxDestX - (checkX - (strategy.getApproxDestinationSizeX() + 1))) : 0;
                    } else {
                        deltaX = approxDestX - checkX;
                    }
                    if (approxDestY <= checkY) {
                        deltaY = 1 - approxDestY - (routeStrategy.destSizeY - checkY);
                        //deltaY = (approxDestY + (strategy.getApproxDestinationSizeY() - 1)) < checkY ? (approxDestY - (checkY - (strategy.getApproxDestinationSizeY() + 1))) : 0;
                    } else {
                        deltaY = approxDestY - checkY;
                    }

                    const cost = deltaX * deltaX + deltaY * deltaY;
                    if (
                        cost < lowestCost ||
                        (cost <= lowestCost && this.distances[graphX][graphY] < lowestDistance)
                    ) {
                        // if the cost is lower than the lowest one, or same as the lowest one, but less steps, we accept this position as alternate.
                        lowestCost = cost;
                        lowestDistance = this.distances[graphX][graphY];
                        endX = checkX;
                        endY = checkY;
                    }
                }
            }

            if (
                lowestCost === Number.MAX_SAFE_INTEGER ||
                lowestDistance === Number.MAX_SAFE_INTEGER
            ) {
                return -1; // we didn't find any alternative route, sadly.
            }
        }

        if (endX === srcX && endY === srcY) {
            this.bufferX[0] = endX;
            this.bufferY[0] = endY;
            return 0; // path was found, but we didn't move
        }
        // what we will do now is trace the path from the end position
        // for faster performance, we are reusing our queue buffer for another purpose.
        let steps = 0;
        let traceX = endX;
        let traceY = endY;
        let direction = this.directions[traceX - graphBaseX][traceY - graphBaseY];
        let lastDirection = direction;
        // queue destination position and start tracing from it
        this.bufferX[steps] = traceX;
        this.bufferY[steps++] = traceY;
        while (traceX !== srcX || traceY !== srcY) {
            if (lastDirection !== direction) {
                // we changed our direction, write it
                this.bufferX[steps] = traceX;
                this.bufferY[steps++] = traceY;
                lastDirection = direction;
            }

            if ((direction & DirectionFlag.EAST) !== 0) {
                traceX++;
            } else if ((direction & DirectionFlag.WEST) !== 0) {
                traceX--;
            }

            if ((direction & DirectionFlag.NORTH) !== 0) {
                traceY++;
            } else if ((direction & DirectionFlag.SOUTH) !== 0) {
                traceY--;
            }

            direction = this.directions[traceX - graphBaseX][traceY - graphBaseY];
        }

        return steps;
    }

    findPathS1(
        srcX: number,
        srcY: number,
        plane: number,
        routeStrategy: RouteStrategy,
        collisionStrategy: CollisionStrategy,
        customFlag: number,
    ): boolean {
        const _directions = this.directions;
        const _distances = this.distances;
        const _clip = this.flags;
        const _bufferX = this.bufferX;
        const _bufferY = this.bufferY;

        // when we start searching for path, we position ourselves in the middle of graph
        // so the base(minimum) position is source_pos - HALF_GRAPH_SIZE.
        let graphBaseX = srcX - this.graphSize / 2;
        let graphBaseY = srcY - this.graphSize / 2;
        let currentX = srcX;
        let currentY = srcY;
        let currentGraphX = srcX - graphBaseX;
        let currentGraphY = srcY - graphBaseY;

        // setup information about source tile.
        _distances[currentGraphX][currentGraphY] = 0;
        _directions[currentGraphX][currentGraphY] = 99;

        // queue variables
        let read = 0,
            write = 0;
        // insert our current position as first queued position.
        _bufferX[write] = currentX;
        _bufferY[write++] = currentY;

        while (read !== write) {
            currentX = _bufferX[read];
            currentY = _bufferY[read];
            read = (read + 1) & (this.queueSize - 1);

            currentGraphX = currentX - graphBaseX;
            currentGraphY = currentY - graphBaseY;

            if (routeStrategy.hasArrived(currentX, currentY, plane)) {
                // we found a path!
                this.exitX = currentX;
                this.exitY = currentY;
                return true;
            }

            // if we can't exit at current tile, check where we can go from this tile
            let nextDistance = _distances[currentGraphX][currentGraphY] + 1;
            if (
                currentGraphX > 0 &&
                _directions[currentGraphX - 1][currentGraphY] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX - 1][currentGraphY],
                    CollisionFlag.BLOCK_WEST | customFlag,
                )
            ) {
                // we can go to west, queue it
                _bufferX[write] = currentX - 1;
                _bufferY[write] = currentY;
                write = (write + 1) & (this.queueSize - 1);

                _directions[currentGraphX - 1][currentGraphY] = DirectionFlag.EAST;
                _distances[currentGraphX - 1][currentGraphY] = nextDistance;
            }
            if (
                currentGraphX < this.graphSize - 1 &&
                _directions[currentGraphX + 1][currentGraphY] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + 1][currentGraphY],
                    CollisionFlag.BLOCK_EAST | customFlag,
                )
            ) {
                // we can go to east, queue it
                _bufferX[write] = currentX + 1;
                _bufferY[write] = currentY;
                write = (write + 1) & (this.queueSize - 1);

                _directions[currentGraphX + 1][currentGraphY] = DirectionFlag.WEST;
                _distances[currentGraphX + 1][currentGraphY] = nextDistance;
            }
            if (
                currentGraphY > 0 &&
                _directions[currentGraphX][currentGraphY - 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX][currentGraphY - 1],
                    CollisionFlag.BLOCK_SOUTH | customFlag,
                )
            ) {
                // we can go to south, queue it
                _bufferX[write] = currentX;
                _bufferY[write] = currentY - 1;
                write = (write + 1) & (this.queueSize - 1);

                _directions[currentGraphX][currentGraphY - 1] = DirectionFlag.NORTH;
                _distances[currentGraphX][currentGraphY - 1] = nextDistance;
            }
            if (
                currentGraphY < this.graphSize - 1 &&
                _directions[currentGraphX][currentGraphY + 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX][currentGraphY + 1],
                    CollisionFlag.BLOCK_NORTH | customFlag,
                )
            ) {
                // we can go to north, queue it
                _bufferX[write] = currentX;
                _bufferY[write] = currentY + 1;
                write = (write + 1) & (this.queueSize - 1);

                _directions[currentGraphX][currentGraphY + 1] = DirectionFlag.SOUTH;
                _distances[currentGraphX][currentGraphY + 1] = nextDistance;
            }
            // diagonal checks, comment them to disable diagonal routes.
            if (
                currentGraphX > 0 &&
                currentGraphY > 0 &&
                _directions[currentGraphX - 1][currentGraphY - 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX - 1][currentGraphY - 1],
                    CollisionFlag.BLOCK_SOUTH_WEST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX - 1][currentGraphY],
                    CollisionFlag.BLOCK_WEST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX][currentGraphY - 1],
                    CollisionFlag.BLOCK_SOUTH | customFlag,
                )
            ) {
                // we can go to south west, queue it
                _bufferX[write] = currentX - 1;
                _bufferY[write] = currentY - 1;
                write = (write + 1) & (this.queueSize - 1);

                _directions[currentGraphX - 1][currentGraphY - 1] =
                    DirectionFlag.NORTH | DirectionFlag.EAST;
                _distances[currentGraphX - 1][currentGraphY - 1] = nextDistance;
            }
            if (
                currentGraphX < this.graphSize - 1 &&
                currentGraphY > 0 &&
                _directions[currentGraphX + 1][currentGraphY - 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + 1][currentGraphY - 1],
                    CollisionFlag.BLOCK_SOUTH_EAST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + 1][currentGraphY],
                    CollisionFlag.BLOCK_EAST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX][currentGraphY - 1],
                    CollisionFlag.BLOCK_SOUTH | customFlag,
                )
            ) {
                // we can go to south east, queue it
                _bufferX[write] = currentX + 1;
                _bufferY[write] = currentY - 1;
                write = (write + 1) & (this.queueSize - 1);

                _directions[currentGraphX + 1][currentGraphY - 1] =
                    DirectionFlag.NORTH | DirectionFlag.WEST;
                _distances[currentGraphX + 1][currentGraphY - 1] = nextDistance;
            }
            if (
                currentGraphX > 0 &&
                currentGraphY < this.graphSize - 1 &&
                _directions[currentGraphX - 1][currentGraphY + 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX - 1][currentGraphY + 1],
                    CollisionFlag.BLOCK_NORTH_WEST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX - 1][currentGraphY],
                    CollisionFlag.BLOCK_WEST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX][currentGraphY + 1],
                    CollisionFlag.BLOCK_NORTH | customFlag,
                )
            ) {
                // we can go to north west, queue it.
                _bufferX[write] = currentX - 1;
                _bufferY[write] = currentY + 1;
                write = (write + 1) & (this.queueSize - 1);

                _directions[currentGraphX - 1][currentGraphY + 1] =
                    DirectionFlag.SOUTH | DirectionFlag.EAST;
                _distances[currentGraphX - 1][currentGraphY + 1] = nextDistance;
            }
            if (
                currentGraphX < this.graphSize - 1 &&
                currentGraphY < this.graphSize - 1 &&
                _directions[currentGraphX + 1][currentGraphY + 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + 1][currentGraphY + 1],
                    CollisionFlag.BLOCK_NORTH_EAST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + 1][currentGraphY],
                    CollisionFlag.BLOCK_EAST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX][currentGraphY + 1],
                    CollisionFlag.BLOCK_NORTH | customFlag,
                )
            ) {
                // we can go to north east, queue it.
                _bufferX[write] = currentX + 1;
                _bufferY[write] = currentY + 1;
                write = (write + 1) & (this.queueSize - 1);

                _directions[currentGraphX + 1][currentGraphY + 1] =
                    DirectionFlag.SOUTH | DirectionFlag.WEST;
                _distances[currentGraphX + 1][currentGraphY + 1] = nextDistance;
            }
        }

        this.exitX = currentX;
        this.exitY = currentY;
        return false;
    }

    findPathS2(
        srcX: number,
        srcY: number,
        plane: number,
        routeStrategy: RouteStrategy,
        collisionStrategy: CollisionStrategy,
        customFlag: number,
    ): boolean {
        return this.findPathSX(srcX, srcY, 2, plane, routeStrategy, collisionStrategy, customFlag);
    }

    findPathSX(
        srcX: number,
        srcY: number,
        size: number,
        plane: number,
        routeStrategy: RouteStrategy,
        collisionStrategy: CollisionStrategy,
        customFlag: number,
    ): boolean {
        const _directions = this.directions;
        const _distances = this.distances;
        const _clip = this.flags;
        const _bufferX = this.bufferX;
        const _bufferY = this.bufferY;

        // when we start searching for path, we position ourselves in the middle of graph
        // so the base(minimum) position is source_pos - HALF_GRAPH_SIZE.
        const graphBaseX = srcX - this.graphSize / 2;
        const graphBaseY = srcY - this.graphSize / 2;
        let currentX = srcX;
        let currentY = srcY;
        let currentGraphX = srcX - graphBaseX;
        let currentGraphY = srcY - graphBaseY;

        // setup information about source tile.
        _distances[currentGraphX][currentGraphY] = 0;
        _directions[currentGraphX][currentGraphY] = 99;

        // queue variables
        let read = 0;
        let write = 0;
        // insert our current position as first queued position.
        _bufferX[write] = currentX;
        _bufferY[write++] = currentY;

        while (read !== write) {
            currentX = _bufferX[read];
            currentY = _bufferY[read];
            read = (read + 1) & (this.queueSize - 1);

            currentGraphX = currentX - graphBaseX;
            currentGraphY = currentY - graphBaseY;

            if (routeStrategy.hasArrived(currentX, currentY, plane)) {
                // we found a path!
                this.exitX = currentX;
                this.exitY = currentY;
                return true;
            }

            // if we can't exit at current tile, check where we can go from this tile
            let nextDistance = _distances[currentGraphX][currentGraphY] + 1;
            if (
                currentGraphX > 0 &&
                _directions[currentGraphX - 1][currentGraphY] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX - 1][currentGraphY],
                    CollisionFlag.BLOCK_SOUTH_WEST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX - 1][currentGraphY + (size - 1)],
                    CollisionFlag.BLOCK_NORTH_WEST | customFlag,
                )
            ) {
                exit: do {
                    for (let y = 1; y < size - 1; y++) {
                        if (
                            !collisionStrategy.canMove(
                                _clip[currentGraphX - 1][currentGraphY + y],
                                CollisionFlag.BLOCK_NORTH_AND_SOUTH_WEST | customFlag,
                            )
                        ) {
                            break exit;
                        }
                    }
                    // we can go to west, queue it
                    _bufferX[write] = currentX - 1;
                    _bufferY[write] = currentY;
                    write = (write + 1) & (this.queueSize - 1);

                    _directions[currentGraphX - 1][currentGraphY] = DirectionFlag.EAST;
                    _distances[currentGraphX - 1][currentGraphY] = nextDistance;
                } while (false);
            }
            if (
                currentGraphX < this.graphSize - size &&
                _directions[currentGraphX + 1][currentGraphY] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + size][currentGraphY],
                    CollisionFlag.BLOCK_SOUTH_EAST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + size][currentGraphY + (size - 1)],
                    CollisionFlag.BLOCK_NORTH_EAST | customFlag,
                )
            ) {
                exit: do {
                    for (let y = 1; y < size - 1; y++) {
                        if (
                            !collisionStrategy.canMove(
                                _clip[currentGraphX + size][currentGraphY + y],
                                CollisionFlag.BLOCK_NORTH_AND_SOUTH_EAST | customFlag,
                            )
                        ) {
                            break exit;
                        }
                    }
                    // we can go to east, queue it
                    _bufferX[write] = currentX + 1;
                    _bufferY[write] = currentY;
                    write = (write + 1) & (this.queueSize - 1);

                    _directions[currentGraphX + 1][currentGraphY] = DirectionFlag.WEST;
                    _distances[currentGraphX + 1][currentGraphY] = nextDistance;
                } while (false);
            }
            if (
                currentGraphY > 0 &&
                _directions[currentGraphX][currentGraphY - 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX][currentGraphY - 1],
                    CollisionFlag.BLOCK_SOUTH_WEST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + (size - 1)][currentGraphY - 1],
                    CollisionFlag.BLOCK_SOUTH_EAST | customFlag,
                )
            ) {
                exit: do {
                    for (let y = 1; y < size - 1; y++) {
                        if (
                            !collisionStrategy.canMove(
                                _clip[currentGraphX + y][currentGraphY - 1],
                                CollisionFlag.BLOCK_NORTH_EAST_AND_WEST | customFlag,
                            )
                        ) {
                            break exit;
                        }
                    }
                    // we can go to south, queue it
                    _bufferX[write] = currentX;
                    _bufferY[write] = currentY - 1;
                    write = (write + 1) & (this.queueSize - 1);

                    _directions[currentGraphX][currentGraphY - 1] = DirectionFlag.NORTH;
                    _distances[currentGraphX][currentGraphY - 1] = nextDistance;
                } while (false);
            }
            if (
                currentGraphY < this.graphSize - size &&
                _directions[currentGraphX][currentGraphY + 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX][currentGraphY + size],
                    CollisionFlag.BLOCK_NORTH_WEST | customFlag,
                ) &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + (size - 1)][currentGraphY + size],
                    CollisionFlag.BLOCK_NORTH_EAST | customFlag,
                )
            ) {
                exit: do {
                    for (let y = 1; y < size - 1; y++) {
                        if (
                            !collisionStrategy.canMove(
                                _clip[currentGraphX + y][currentGraphY + size],
                                CollisionFlag.BLOCK_SOUTH_EAST_AND_WEST | customFlag,
                            )
                        ) {
                            break exit;
                        }
                    }
                    // we can go to north, queue it
                    _bufferX[write] = currentX;
                    _bufferY[write] = currentY + 1;
                    write = (write + 1) & (this.queueSize - 1);

                    _directions[currentGraphX][currentGraphY + 1] = DirectionFlag.SOUTH;
                    _distances[currentGraphX][currentGraphY + 1] = nextDistance;
                } while (false);
            }
            // diagonal checks, comment them to disable diagonal routes.
            if (
                currentGraphX > 0 &&
                currentGraphY > 0 &&
                _directions[currentGraphX - 1][currentGraphY - 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX - 1][currentGraphY - 1],
                    CollisionFlag.BLOCK_SOUTH_WEST | customFlag,
                )
            ) {
                exit: do {
                    for (let y = 1; y < size; y++) {
                        if (
                            !collisionStrategy.canMove(
                                _clip[currentGraphX - 1][currentGraphY + (y - 1)],
                                CollisionFlag.BLOCK_NORTH_AND_SOUTH_EAST | customFlag,
                            ) ||
                            !collisionStrategy.canMove(
                                _clip[currentGraphX + (y - 1)][currentGraphY - 1],
                                CollisionFlag.BLOCK_NORTH_EAST_AND_WEST | customFlag,
                            )
                        ) {
                            break exit;
                        }
                    }
                    // we can go to south west, queue it
                    _bufferX[write] = currentX - 1;
                    _bufferY[write] = currentY - 1;
                    write = (write + 1) & (this.queueSize - 1);

                    _directions[currentGraphX - 1][currentGraphY - 1] = DirectionFlag.NORTH_EAST;
                    _distances[currentGraphX - 1][currentGraphY - 1] = nextDistance;
                } while (false);
            }
            if (
                currentGraphX < this.graphSize - size &&
                currentGraphY > 0 &&
                _directions[currentGraphX + 1][currentGraphY - 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + size][currentGraphY - 1],
                    CollisionFlag.BLOCK_SOUTH_EAST | customFlag,
                )
            ) {
                exit: do {
                    for (let y = 1; y < size; y++) {
                        if (
                            !collisionStrategy.canMove(
                                _clip[currentGraphX + size][currentGraphY + (y - 1)],
                                CollisionFlag.BLOCK_NORTH_AND_SOUTH_WEST | customFlag,
                            ) ||
                            !collisionStrategy.canMove(
                                _clip[currentGraphX + y][currentGraphY - 1],
                                CollisionFlag.BLOCK_NORTH_EAST_AND_WEST | customFlag,
                            )
                        ) {
                            break exit;
                        }
                    }
                    // we can go to south east, queue it
                    _bufferX[write] = currentX + 1;
                    _bufferY[write] = currentY - 1;
                    write = (write + 1) & (this.queueSize - 1);

                    _directions[currentGraphX + 1][currentGraphY - 1] = DirectionFlag.NORTH_WEST;
                    _distances[currentGraphX + 1][currentGraphY - 1] = nextDistance;
                } while (false);
            }
            if (
                currentGraphX > 0 &&
                currentGraphY < this.graphSize - size &&
                _directions[currentGraphX - 1][currentGraphY + 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX - 1][currentGraphY + size],
                    CollisionFlag.BLOCK_NORTH_WEST | customFlag,
                )
            ) {
                exit: do {
                    for (let y = 1; y < size; y++) {
                        if (
                            !collisionStrategy.canMove(
                                _clip[currentGraphX - 1][currentGraphY + y],
                                CollisionFlag.BLOCK_NORTH_AND_SOUTH_EAST | customFlag,
                            ) ||
                            !collisionStrategy.canMove(
                                _clip[currentGraphX + (y - 1)][currentGraphY + size],
                                CollisionFlag.BLOCK_SOUTH_EAST_AND_WEST | customFlag,
                            )
                        ) {
                            break exit;
                        }
                    }
                    // we can go to north west, queue it.
                    _bufferX[write] = currentX - 1;
                    _bufferY[write] = currentY + 1;
                    write = (write + 1) & (this.queueSize - 1);

                    _directions[currentGraphX - 1][currentGraphY + 1] = DirectionFlag.SOUTH_EAST;
                    _distances[currentGraphX - 1][currentGraphY + 1] = nextDistance;
                } while (false);
            }
            if (
                currentGraphX < this.graphSize - size &&
                currentGraphY < this.graphSize - size &&
                _directions[currentGraphX + 1][currentGraphY + 1] === 0 &&
                collisionStrategy.canMove(
                    _clip[currentGraphX + size][currentGraphY + size],
                    CollisionFlag.BLOCK_NORTH_EAST | customFlag,
                )
            ) {
                exit: do {
                    for (let y = 1; y < size; y++) {
                        if (
                            !collisionStrategy.canMove(
                                _clip[currentGraphX + y][currentGraphY + size],
                                CollisionFlag.BLOCK_SOUTH_EAST_AND_WEST | customFlag,
                            ) ||
                            !collisionStrategy.canMove(
                                _clip[currentGraphX + size][currentGraphY + y],
                                CollisionFlag.BLOCK_NORTH_AND_SOUTH_WEST | customFlag,
                            )
                        ) {
                            break exit;
                        }
                    }
                    // we can go to north east, queue it.
                    _bufferX[write] = currentX + 1;
                    _bufferY[write] = currentY + 1;
                    write = (write + 1) & (this.queueSize - 1);

                    _directions[currentGraphX + 1][currentGraphY + 1] = DirectionFlag.SOUTH_WEST;
                    _distances[currentGraphX + 1][currentGraphY + 1] = nextDistance;
                } while (false);
            }
        }

        this.exitX = currentX;
        this.exitY = currentY;
        return false;
    }
}
