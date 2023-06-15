import {
    FloorDecoration,
    GameObject,
    WallDecoration,
    WallObject,
} from "./SceneObject";
import { SceneTileModel } from "./SceneTileModel";

export class SceneTile {
    originalPlane: number;

    plane: number;

    x: number;

    y: number;

    minPlane: number;

    tileModel?: SceneTileModel;

    wallObject?: WallObject;

    wallDecoration?: WallDecoration;

    floorDecoration?: FloorDecoration;

    gameObjects: GameObject[];

    linkedBelowTile?: SceneTile;

    constructor(plane: number, x: number, y: number) {
        this.plane = this.originalPlane = plane;
        this.x = x;
        this.y = y;
        this.minPlane = 0;
        this.gameObjects = [];
    }
}
