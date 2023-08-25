import { FloorDecoration } from "./FloorDecoration";
import { Loc } from "./Loc";
import { SceneTileModel } from "./SceneTileModel";
import { Wall } from "./Wall";
import { WallDecoration } from "./WallDecoration";

export class SceneTile {
    initLevel: number;
    level: number;
    x: number;
    y: number;
    minLevel: number;

    tileModel?: SceneTileModel;
    floorDecoration?: FloorDecoration;
    wall?: Wall;
    wallDecoration?: WallDecoration;
    locs: Loc[];

    linkedBelowTile?: SceneTile;

    constructor(level: number, x: number, y: number) {
        this.level = this.initLevel = level;
        this.x = x;
        this.y = y;
        this.minLevel = 0;
        this.locs = [];
    }
}
