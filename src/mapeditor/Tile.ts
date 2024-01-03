export class Tile {
    private hash: number;

    constructor(x: number, y: number, z: number = 0, mapId?: number) {
        if (typeof mapId === "number") {
            const mapX = (mapId >> 8) & 0xffff;
            const mapY = mapId & 255;
            x = mapX + x;
            y = mapY + y;
        }
        this.hash = y | (x << 14) | (z << 28);
    }

    static compareDistance(from: Tile): (left: Tile, right: Tile) => number {
        return (left, right) => {
            return from.getTileDistance(left) - from.getTileDistance(right);
        };
    }

    transform(diffX: number, diffY: number, diffZ: number): Tile;

    transform(diffX: number, diffY: number): Tile;

    transform(diffX: number, diffY: number, diffZ?: number): Tile {
        if (typeof diffZ === "number") {
            return new Tile(
                this.getWorldX() + diffX,
                this.getWorldY() + diffY,
                this.getPlane() + diffZ,
            );
        } else {
            return new Tile(this.getWorldX() + diffX, this.getWorldY() + diffY, this.getPlane());
        }
    }

    translate(x: number, y: number): Tile {
        return new Tile(this.getWorldX() + x, this.getWorldY() + y, this.getPlane());
    }

    moveLocation(xOffset: number, yOffset: number, planeOffset: number): Tile {
        let x = this.getWorldX();
        let y = this.getWorldY();
        let z = this.getPlane();
        x += xOffset;
        y += yOffset;
        z += planeOffset;
        this.hash = y | (x << 14) | (z << 28);
        return this;
    }

    setLocation(x: number, y: number, plane: number): void;

    setLocation(hash: number): void;

    setLocation(tile: Tile): void;

    setLocation(x: number | Tile, y?: number, plane?: number): void {
        if (typeof x === "number" && typeof y === "number" && typeof plane === "number") {
            this.hash = y | (x << 14) | (plane << 28);
        } else if (typeof x === "number") {
            this.hash = x;
        } else {
            this.hash = x.getWorldTileId();
        }
    }

    withinDistance(x: number, y: number, distance: number): boolean;

    withinDistance(position: Tile, distance: number): boolean;

    withinDistance(arg1: number | Tile, arg2: number, distance?: number): boolean {
        if (typeof arg1 === "number" && typeof arg2 === "number" && typeof distance === "number") {
            const deltaX = arg1 - this.getWorldX();
            const deltaY = arg2 - this.getWorldY();
            return (
                deltaX <= distance &&
                deltaX >= -distance &&
                deltaY <= distance &&
                deltaY >= -distance
            );
        } else if (arg1 instanceof Tile && typeof arg2 === "number") {
            const tile = arg1;
            if (tile.getPlane() !== this.getPlane()) {
                return false;
            }
            const deltaX = tile.getWorldX() - this.getWorldX();
            const deltaY = tile.getWorldY() - this.getWorldY();
            return deltaX <= arg2 && deltaX >= -arg2 && deltaY <= arg2 && deltaY >= -arg2;
        } else {
            throw new Error("Invalid arguments");
        }
    }

    getWorldX(): number {
        return (this.hash >> 14) & 16383;
    }

    getWorldY(): number {
        return this.hash & 16383;
    }

    getPlane(): number {
        return (this.hash >> 28) & 3;
    }

    getLocalX(): number {
        return (this.getWorldX() % 64) + 6;
    }

    getLocalY(): number {
        return (this.getWorldY() % 64) + 6;
    }

    getMapId(): number {
        return (this.getMapX() << 8) + this.getMapY();
    }

    hashInRegion(): number {
        return (
            ((this.getWorldX() & 63) << 6) | (this.getWorldY() & 63) | ((this.getPlane() & 3) << 12)
        );
    }

    get18BitHash(): number {
        return (this.getWorldY() >> 13) | ((this.getWorldX() >> 13) << 8) | (this.getPlane() << 16);
    }

    getRegionHash(): number {
        return this.getMapY() + (this.getMapX() << 8) + (this.getPlane() << 16);
    }

    getChunkHash(): number {
        return this.getChunkX() | (this.getChunkY() << 11) | ((this.getPlane() & 3) << 22);
    }

    getChunkX(): number {
        return this.getWorldX() >> 3;
    }

    getChunkY(): number {
        return this.getWorldY() >> 3;
    }

    getMapX(): number {
        return this.getWorldX() >> 6;
    }

    getMapY(): number {
        return this.getWorldY() >> 6;
    }

    getXInRegion(): number {
        return this.getWorldX() & 63;
    }

    getYInRegion(): number {
        return this.getWorldY() & 63;
    }

    getXInChunk(): number {
        return this.getWorldX() & 7;
    }

    getYInChunk(): number {
        return this.getWorldY() & 7;
    }

    getDistance(other: Tile): number;

    getDistance(x: number, y: number): number;

    getDistance(arg1: Tile | number, y?: number): number {
        if (arg1 instanceof Tile && typeof y === "undefined") {
            const xdiff = this.getWorldX() - arg1.getWorldX();
            const ydiff = this.getWorldY() - arg1.getWorldY();
            return Math.sqrt(xdiff * xdiff + ydiff * ydiff);
        } else if (typeof arg1 === "number" && typeof y === "number") {
            const xdiff = this.getWorldX() - arg1;
            const ydiff = this.getWorldY() - y;
            return Math.sqrt(xdiff * xdiff + ydiff * ydiff);
        } else {
            throw new Error("Invalid arguments");
        }
    }

    getTileDistance(other: Tile): number {
        const deltaX = other.getWorldX() - this.getWorldX();
        const deltaY = other.getWorldY() - this.getWorldY();
        return Math.max(Math.abs(deltaX), Math.abs(deltaY));
    }

    deltaAbsolute(b: Tile): Tile {
        return new Tile(
            Math.abs(b.getWorldX() - this.getWorldX()),
            Math.abs(b.getWorldY() - this.getWorldY()),
        );
    }

    getWorldTileId(): number {
        return this.hash;
    }

    equals(x: number, y: number, plane: number): boolean;

    equals(other: Tile): boolean;

    equals(arg1: number | Tile, y?: number, plane?: number): boolean {
        if (typeof arg1 === "number" && typeof y === "number" && typeof plane === "number") {
            return this.getWorldX() === arg1 && this.getWorldY() === y && this.getPlane() === plane;
        } else if (
            arg1 instanceof Tile &&
            typeof y === "undefined" &&
            typeof plane === "undefined"
        ) {
            return arg1.getWorldTileId() === this.getWorldTileId();
        } else {
            throw new Error("Invalid arguments");
        }
    }

    toString(): string {
        return `Tile: ${this.getWorldX()}, ${this.getWorldY()}, ${this.getPlane()}, region[${this.getMapId()}, ${this.getMapX()}, ${this.getMapY()}], chunk[${this.getChunkX()}, ${this.getChunkY()}], hash [${this.getWorldTileId()}]`;
    }

    distanceWithSize(other: Tile, thisSize: number): number {
        if (this.isInside(other, thisSize)) {
            return 0;
        }

        let minDistance = this.getDistance(other);

        for (let xx = 0; xx < thisSize - 1; xx++) {
            const dx = other.getWorldX() - (this.getWorldX() + xx);
            const dz = other.getWorldY() - this.getWorldY();
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        for (let yy = 0; yy < thisSize - 1; yy++) {
            const dx = other.getWorldX() - this.getWorldX();
            const dz = other.getWorldY() - (this.getWorldY() + yy);
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        for (let xx = 0; xx < thisSize - 1; xx++) {
            const dx = other.getWorldX() - (this.getWorldX() + xx);
            const dz = other.getWorldY() - (this.getWorldY() + (thisSize - 1));
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        for (let yy = 0; yy < thisSize - 1; yy++) {
            const dx = other.getWorldX() - (this.getWorldX() + (thisSize - 1));
            const dz = other.getWorldY() - (this.getWorldY() + yy);
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        return minDistance;
    }

    isInside(other: Tile, thisSize: number): boolean {
        if (this.equals(other)) {
            return true;
        }
        const insideHorizontal =
            other.getWorldX() >= this.getWorldX() &&
            other.getWorldX() <= this.getWorldX() + (thisSize - 1);
        const insideVertical =
            other.getWorldY() >= this.getWorldY() &&
            other.getWorldY() <= this.getWorldY() + (thisSize - 1);
        return insideVertical && insideHorizontal;
    }

    copy(): Tile {
        return new Tile(this.getWorldX(), this.getWorldY(), this.getPlane());
    }

    add(other: Tile): Tile {
        return new Tile(this.getWorldX() + other.getWorldX(), this.getWorldY() + other.getWorldY());
    }
}
