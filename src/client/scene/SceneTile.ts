import { FloorDecoration, GameObject, WallDecoration, WallObject } from "./SceneObject";
import { SceneTileModel } from "./SceneTileModel";

export class SceneTile {
    plane: number;

    x: number;

    y: number;

    tileModel?: SceneTileModel;

    wallObject?: WallObject;

    wallDecoration?: WallDecoration;

    floorDecoration?: FloorDecoration;

    gameObjects: GameObject[];

    constructor(plane: number, x: number, y: number) {
        this.plane = plane;
        this.x = x;
        this.y = y;
        this.gameObjects = [];
    }
}
