import { ObjectType } from "../../scene/ObjectType";

export interface CollisionData {
    sizeX: number;
    sizeY: number;
    flags: Int32Array;
}

export class CollisionMap {
    sizeX: number;
    sizeY: number;

    offsetX: number;
    offsetY: number;

    flags: Int32Array;

    static fromData(data: CollisionData): CollisionMap {
        return new CollisionMap(data.sizeX, data.sizeY, data.flags);
    }

    constructor(sizeX: number, sizeY: number, flags?: Int32Array) {
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.offsetX = 0;
        this.offsetY = 0;
        if (flags) {
            this.flags = flags;
        } else {
            this.flags = new Int32Array(this.sizeX * this.sizeY);
            this.reset();
        }
    }

    reset(): void {
        for (let x = 0; x < this.sizeX; x++) {
            for (let y = 0; y < this.sizeY; y++) {
                if (
                    x !== 0 &&
                    y !== 0 &&
                    x < this.sizeX - 5 &&
                    y < this.sizeY - 5
                ) {
                    // this.setFlag(x, y, 0x1000000);
                } else {
                    // this.setFlag(x, y, 0xFFFFFF);
                }
                // this.setFlag(x, y, 0x1000000);
            }
        }
    }

    isWithinBounds(x: number, y: number): boolean {
        return x >= 0 && x < this.sizeX && y >= 0 && y < this.sizeY;
    }

    getFlag(x: number, y: number): number {
        return this.flags[x + y * this.sizeX];
    }

    hasFlag(x: number, y: number, flag: number): boolean {
        return (this.getFlag(x, y) & flag) !== 0;
    }

    setFlag(x: number, y: number, flag: number): void {
        this.flags[x + y * this.sizeX] = flag;
    }

    flag(x: number, y: number, flag: number): void {
        this.flags[x + y * this.sizeX] |= flag;
    }

    unflag(x: number, y: number, flag: number): void {
        this.flags[x + y * this.sizeX] &= ~flag;
    }

    setBlockedByFloor(x: number, y: number) {
        this.flag(x, y, 0x200000);
    }

    setBlockedByFloorDec(x: number, y: number) {
        this.flag(x, y, 0x40000);
    }

    addObject(
        x: number,
        y: number,
        sizeX: number,
        sizeY: number,
        blockProjectile: boolean
    ) {
        let flag = 0x100;
        if (blockProjectile) {
            flag += 0x20000;
        }

        for (let fx = x; fx < sizeX + x; fx++) {
            if (fx >= 0 && fx < this.sizeX) {
                for (let fy = y; fy < y + sizeY; fy++) {
                    if (fy >= 0 && fy < this.sizeY) {
                        this.flag(fx, fy, flag);
                    }
                }
            }
        }
    }

    addWall(
        x: number,
        y: number,
        type: ObjectType,
        rotation: number,
        blockProjectile: boolean
    ) {
        if (type === ObjectType.WALL) {
            if (rotation === 0) {
                this.flag(x, y, 128);
                this.flag(x - 1, y, 8);
            }

            if (rotation === 1) {
                this.flag(x, y, 2);
                this.flag(x, y + 1, 32);
            }

            if (rotation === 2) {
                this.flag(x, y, 8);
                this.flag(x + 1, y, 128);
            }

            if (rotation === 3) {
                this.flag(x, y, 32);
                this.flag(x, y - 1, 2);
            }
        }

        if (
            type === ObjectType.WALL_TRI_CORNER ||
            type === ObjectType.WALL_RECT_CORNER
        ) {
            if (rotation === 0) {
                this.flag(x, y, 1);
                this.flag(x - 1, y + 1, 16);
            }

            if (rotation === 1) {
                this.flag(x, y, 4);
                this.flag(x + 1, y + 1, 64);
            }

            if (rotation === 2) {
                this.flag(x, y, 16);
                this.flag(x + 1, y - 1, 1);
            }

            if (rotation === 3) {
                this.flag(x, y, 64);
                this.flag(x - 1, y - 1, 4);
            }
        }

        if (type === ObjectType.WALL_CORNER) {
            if (rotation === 0) {
                this.flag(x, y, 130);
                this.flag(x - 1, y, 8);
                this.flag(x, y + 1, 32);
            }

            if (rotation === 1) {
                this.flag(x, y, 10);
                this.flag(x, y + 1, 32);
                this.flag(x + 1, y, 128);
            }

            if (rotation === 2) {
                this.flag(x, y, 40);
                this.flag(x + 1, y, 128);
                this.flag(x, y - 1, 2);
            }

            if (rotation === 3) {
                this.flag(x, y, 160);
                this.flag(x, y - 1, 2);
                this.flag(x - 1, y, 8);
            }
        }

        if (blockProjectile) {
            if (type === ObjectType.WALL) {
                if (rotation === 0) {
                    this.flag(x, y, 65536);
                    this.flag(x - 1, y, 4096);
                }

                if (rotation === 1) {
                    this.flag(x, y, 1024);
                    this.flag(x, y + 1, 16384);
                }

                if (rotation === 2) {
                    this.flag(x, y, 4096);
                    this.flag(x + 1, y, 65536);
                }

                if (rotation === 3) {
                    this.flag(x, y, 16384);
                    this.flag(x, y - 1, 1024);
                }
            }

            if (
                type === ObjectType.WALL_TRI_CORNER ||
                type === ObjectType.WALL_RECT_CORNER
            ) {
                if (rotation === 0) {
                    this.flag(x, y, 512);
                    this.flag(x - 1, y + 1, 8192);
                }

                if (rotation === 1) {
                    this.flag(x, y, 2048);
                    this.flag(x + 1, y + 1, 32768);
                }

                if (rotation === 2) {
                    this.flag(x, y, 8192);
                    this.flag(x + 1, y - 1, 512);
                }

                if (rotation === 3) {
                    this.flag(x, y, 32768);
                    this.flag(x - 1, y - 1, 2048);
                }
            }

            if (type === ObjectType.WALL_CORNER) {
                if (rotation === 0) {
                    this.flag(x, y, 66560);
                    this.flag(x - 1, y, 4096);
                    this.flag(x, y + 1, 16384);
                }

                if (rotation === 1) {
                    this.flag(x, y, 5120);
                    this.flag(x, y + 1, 16384);
                    this.flag(x + 1, y, 65536);
                }

                if (rotation === 2) {
                    this.flag(x, y, 20480);
                    this.flag(x + 1, y, 65536);
                    this.flag(x, y - 1, 1024);
                }

                if (rotation === 3) {
                    this.flag(x, y, 81920);
                    this.flag(x, y - 1, 1024);
                    this.flag(x - 1, y, 4096);
                }
            }
        }
    }
}
