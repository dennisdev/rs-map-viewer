import { NpcDefinition } from "../../client/fs/definition/NpcDefinition";
import { AnimationLoader } from "../../client/fs/loader/AnimationLoader";
import { CollisionMap } from "../../client/pathfinder/collision/CollisionMap";
import { Pathfinder } from "../../client/pathfinder/Pathfinder";
import { ExactRouteStrategy } from "../../client/pathfinder/RouteStrategy";
import { clamp } from "../../client/util/MathUtil";
import { NpcData } from "../chunk/ChunkDataLoader";

export enum MovementType {
    CRAWL = 0,
    WALK = 1,
    RUN = 2,
}

const strategy = new ExactRouteStrategy();

export class Npc {
    data: NpcData;

    def: NpcDefinition;

    rotation: number = 0;
    orientation: number = 0;

    pathX: number[] = new Array(10);
    pathY: number[] = new Array(10);
    pathMovementType: MovementType[] = new Array(10);
    pathLength: number = 0;

    serverPathX: number[] = new Array(25);
    serverPathY: number[] = new Array(25);
    serverPathMovementType: MovementType[] = new Array(25);
    serverPathLength: number = 0;

    x: number;
    y: number;

    movementAnimation: number = -1;
    movementFrame: number = 0;
    movementFrameTick: number = 0;
    movementLoop: number = 0;

    constructor(data: NpcData, def: NpcDefinition) {
        this.data = data;
        this.def = def;

        this.rotation = 0;

        this.pathX[0] = clamp(data.tileX, 0, 64 - this.def.size);
        this.pathY[0] = clamp(data.tileY, 0, 64 - this.def.size);

        this.x = this.pathX[0] * 128 + this.def.size * 64;
        this.y = this.pathY[0] * 128 + this.def.size * 64;
    }

    queuePathDir(dir: number, movementType: MovementType) {
        let x = this.pathX[0];
        let y = this.pathY[0];
        switch (dir) {
            case 0:
                --x;
                ++y;
                break;
            case 1:
                ++y;
                break;
            case 2:
                ++x;
                ++y;
                break;
            case 3:
                --x;
                break;
            case 4:
                ++x;
                break;
            case 5:
                --x;
                --y;
                break;
            case 6:
                --y;
                break;
            case 7:
                ++x;
                --y;
                break;
        }

        if (this.pathLength < 9) {
            this.pathLength++;
        }

        for (let i = this.pathLength; i > 0; i--) {
            this.pathX[i] = this.pathX[i - 1];
            this.pathY[i] = this.pathY[i - 1];
            this.pathMovementType[i] = this.pathMovementType[i - 1];
        }

        this.pathX[0] = clamp(x, 0, 64 - this.def.size - 1);
        this.pathY[0] = clamp(y, 0, 64 - this.def.size - 1);
        this.pathMovementType[0] = movementType;
    }

    queuePath(x: number, y: number, movementType: MovementType) {
        if (this.pathLength < 9) {
            this.pathLength++;
        }

        for (let i = this.pathLength; i > 0; i--) {
            this.pathX[i] = this.pathX[i - 1];
            this.pathY[i] = this.pathY[i - 1];
            this.pathMovementType[i] = this.pathMovementType[i - 1];
        }

        this.pathX[0] = clamp(x, 0, 64 - this.def.size - 1);
        this.pathY[0] = clamp(y, 0, 64 - this.def.size - 1);
        this.pathMovementType[0] = movementType;
    }

    updateMovement(animationLoader: AnimationLoader) {
        this.movementAnimation = this.def.idleSequence;
        if (this.pathLength > 0) {
            const currX = this.x;
            const currY = this.y;
            const nextX =
                this.pathX[this.pathLength - 1] * 128 + this.def.size * 64;
            const nextY =
                this.pathY[this.pathLength - 1] * 128 + this.def.size * 64;

            if (currX < nextX) {
                if (currY < nextY) {
                    this.orientation = 1280;
                } else if (currY > nextY) {
                    this.orientation = 1792;
                } else {
                    this.orientation = 1536;
                }
            } else if (currX > nextX) {
                if (currY < nextY) {
                    this.orientation = 768;
                } else if (currY > nextY) {
                    this.orientation = 256;
                } else {
                    this.orientation = 512;
                }
            } else if (currY < nextY) {
                this.orientation = 1024;
            } else if (currY > nextY) {
                this.orientation = 0;
            }

            this.movementAnimation = this.def.walkSequence;

            const movementType = this.pathMovementType[this.pathLength - 1];
            if (
                nextX - currX <= 256 &&
                nextX - currX >= -256 &&
                nextY - currY <= 256 &&
                nextY - currY >= -256
            ) {
                let movementSpeed = 4;

                if (this.def.isClickable) {
                    if (
                        this.rotation !== this.orientation &&
                        this.def.rotationSpeed !== 0
                    ) {
                        movementSpeed = 2;
                    }
                    if (this.pathLength > 2) {
                        movementSpeed = 6;
                    }
                    if (this.pathLength > 3) {
                        movementSpeed = 8;
                    }
                } else {
                    if (this.pathLength > 1) {
                        movementSpeed = 6;
                    }
                    if (this.pathLength > 2) {
                        movementSpeed = 8;
                    }
                }

                if (movementType === MovementType.RUN) {
                    movementSpeed <<= 1;
                } else if (movementType === MovementType.CRAWL) {
                    movementSpeed >>= 1;
                }

                if (currX !== nextX || currY !== nextY) {
                    if (currX < nextX) {
                        this.x += movementSpeed;
                        if (this.x > nextX) {
                            this.x = nextX;
                        }
                    } else if (currX > nextX) {
                        this.x -= movementSpeed;
                        if (this.x < nextX) {
                            this.x = nextX;
                        }
                    }

                    if (currY < nextY) {
                        this.y += movementSpeed;
                        if (this.y > nextY) {
                            this.y = nextY;
                        }
                    } else if (currY > nextY) {
                        this.y -= movementSpeed;
                        if (this.y < nextY) {
                            this.y = nextY;
                        }
                    }
                }

                if (this.x === nextX && this.y === nextY) {
                    this.pathLength--;
                }
            } else {
                this.x = nextX;
                this.y = nextY;
                this.pathLength--;
            }
        }

        const deltaRotation = (this.orientation - this.rotation) & 2047;
        if (deltaRotation !== 0) {
            const rotateDir = deltaRotation > 1024 ? -1 : 1;
            this.rotation += rotateDir * this.def.rotationSpeed;
            if (
                deltaRotation < this.def.rotationSpeed ||
                deltaRotation > 2048 - this.def.rotationSpeed
            ) {
                this.rotation = this.orientation;
            }

            this.rotation &= 2047;
        }

        this.updateMovementAnim(animationLoader);
    }

    updateMovementAnim(animationLoader: AnimationLoader) {
        if (this.movementAnimation !== -1) {
            const anim = animationLoader.getDefinition(this.movementAnimation);
            if (!anim.isAnimMaya() && anim.frameIds) {
                this.movementFrameTick++;
                if (
                    this.movementFrame < anim.frameIds.length &&
                    this.movementFrameTick >
                        anim.frameLengths[this.movementFrame]
                ) {
                    this.movementFrameTick = 1;
                    this.movementFrame++;
                }

                if (this.movementFrame >= anim.frameIds.length) {
                    if (anim.frameStep > 0) {
                        this.movementFrame -= anim.frameStep;
                        if (anim.looping) {
                            this.movementLoop++;
                        }

                        if (
                            this.movementFrame < 0 ||
                            this.movementFrame >= anim.frameIds.length ||
                            (anim.looping && this.movementLoop >= anim.maxLoops)
                        ) {
                            this.movementFrameTick = 0;
                            this.movementFrame = 0;
                            this.movementLoop = 0;
                        } else {
                            this.movementFrameTick = 0;
                            this.movementFrame = 0;
                        }
                    } else {
                        this.movementFrameTick = 0;
                        this.movementFrame = 0;
                    }
                }
            }
        }
    }

    updateServerMovement(
        pathfinder: Pathfinder,
        collisionMaps: CollisionMap[]
    ) {
        const canWalk =
            this.def.walkSequence !== -1 &&
            this.def.walkSequence !== this.def.idleSequence;
        const size = this.def.size;

        const collisionMap = collisionMaps[this.data.plane];

        if (canWalk && Math.random() < 0.1) {
            const deltaX = Math.round(Math.random() * 10.0 - 5.0);
            const deltaY = Math.round(Math.random() * 10.0 - 5.0);

            const srcX = this.pathX[0];
            const srcY = this.pathY[0];

            const spawnX = this.data.tileX;
            const spawnY = this.data.tileY;

            const targetX = clamp(spawnX + deltaX, 0, 64 - size - 1);
            const targetY = clamp(spawnY + deltaY, 0, 64 - size - 1);

            strategy.approxDestX = targetX;
            strategy.approxDestY = targetY;
            strategy.destSizeX = 1;
            strategy.destSizeY = 1;

            pathfinder.setCollisionFlags(
                srcX,
                srcY,
                this.data.tileX,
                this.data.tileY,
                5,
                collisionMap
            );

            let steps = pathfinder.findPath(
                srcX,
                srcY,
                size,
                this.data.plane,
                strategy,
                true
            );
            if (steps > 0) {
                if (steps > 24) {
                    steps = 24;
                }
                for (let s = 0; s < steps; s++) {
                    this.serverPathX[s] = pathfinder.bufferX[s];
                    this.serverPathY[s] = pathfinder.bufferY[s];
                    this.serverPathMovementType[s] = MovementType.WALK;
                }
                this.serverPathLength = steps;
            }
        }

        if (this.serverPathLength > 0) {
            const currentX = this.pathX[0];
            const currentY = this.pathY[0];
            const targetX = this.serverPathX[this.serverPathLength - 1];
            const targetY = this.serverPathY[this.serverPathLength - 1];
            const deltaX = clamp(targetX - currentX, -1, 1);
            const deltaY = clamp(targetY - currentY, -1, 1);
            // const deltaX = 0;
            // const deltaY = 0;
            const nextX = currentX + deltaX;
            const nextY = currentY + deltaY;

            for (let flagX = currentX; flagX < currentX + size; flagX++) {
                for (let flagY = currentY; flagY < currentY + size; flagY++) {
                    collisionMap.unflag(flagX, flagY, 0x1000000);
                }
            }

            let canMove = true;
            exit: for (let flagX = nextX; flagX < nextX + size; flagX++) {
                for (let flagY = nextY; flagY < nextY + size; flagY++) {
                    if (collisionMap.hasFlag(flagX, flagY, 0x1000000)) {
                        canMove = false;
                        break exit;
                    }
                }
            }

            if (canMove) {
                for (let flagX = nextX; flagX < nextX + size; flagX++) {
                    for (let flagY = nextY; flagY < nextY + size; flagY++) {
                        collisionMap.flag(flagX, flagY, 0x1000000);
                    }
                }

                this.queuePath(nextX, nextY, MovementType.WALK);
            } else {
                for (let flagX = currentX; flagX < currentX + size; flagX++) {
                    for (
                        let flagY = currentY;
                        flagY < currentY + size;
                        flagY++
                    ) {
                        collisionMap.flag(flagX, flagY, 0x1000000);
                    }
                }
            }

            if (nextX === targetX && nextY === targetY) {
                this.serverPathLength--;
            }
        }
    }

    getAnimationFrames() {
        return this.data.walkAnim &&
            this.movementAnimation === this.def.walkSequence
            ? this.data.walkAnim
            : this.data.idleAnim;
    }
}
