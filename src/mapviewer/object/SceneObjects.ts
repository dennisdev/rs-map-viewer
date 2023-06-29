import { ObjectDefinition } from "../../client/fs/definition/ObjectDefinition";
import { Model } from "../../client/model/Model";
import { DynamicObject } from "../../client/scene/DynamicObject";
import { Scene } from "../../client/scene/Scene";
import { SceneObject } from "../../client/scene/SceneObject";
import { ContourGroundType } from "../buffer/RenderBuffer";
import { InteractType } from "../chunk/InteractType";
import { OcclusionMap } from "../chunk/OcclusionMap";
import { SceneModel } from "../chunk/SceneModel";
import { AnimatedSceneObject } from "./AnimatedSceneObject";

export type SceneObjects = {
    objectModels: SceneModel[];
    animatedSceneObjects: AnimatedSceneObject[];
};

function isLowDetail(
    type: number,
    def: ObjectDefinition,
    localX: number,
    localY: number,
    plane: number,
    occlusionMap: OcclusionMap
): boolean {
    if (
        type === 22 &&
        def.int1 === 0 &&
        def.clipType !== 1 &&
        !def.obstructsGround
    ) {
        return true;
    }
    if (
        (type === 10 || type === 11 || (type >= 4 && type <= 8)) &&
        def.int1 === 1
    ) {
        return occlusionMap.isOccluded(plane, localX | 0, localY | 0);
    }
    return false;
}

export function createObjectModel(
    model: Model,
    sceneObject: SceneObject,
    offsetX: number,
    offsetY: number,
    tileX: number,
    tileY: number,
    plane: number,
    priority: number,
    occlusionMap: OcclusionMap
): SceneModel {
    const def = sceneObject.def;

    const sceneX = sceneObject.sceneX + offsetX;
    const sceneY = sceneObject.sceneY + offsetY;
    const sceneHeight = sceneObject.sceneHeight;

    // const lowDetail = isLowDetail2(sceneObject.type, def);
    const lowDetail = isLowDetail(
        sceneObject.type,
        def,
        tileX,
        tileY,
        plane,
        occlusionMap
    );
    // const lowDetail = false;

    let contourGround = ContourGroundType.CENTER_TILE;
    if (def.contouredGround >= 0) {
        contourGround = ContourGroundType.VERTEX;
    }

    return {
        model,
        lowDetail,
        sceneHeight,
        sceneX,
        sceneY,
        heightOffset: 0,
        plane,
        contourGround,
        priority,
        interactType: InteractType.OBJECT,
        interactId: def.id,
    };
}

export function createAnimatedSceneObject(
    animatedObject: DynamicObject,
    sceneObject: SceneObject,
    offsetX: number,
    offsetY: number,
    plane: number,
    priority: number
): AnimatedSceneObject {
    const def = sceneObject.def;

    const sceneX = sceneObject.sceneX + offsetX;
    const sceneY = sceneObject.sceneY + offsetY;

    let contourGround = ContourGroundType.CENTER_TILE;
    if (def.contouredGround >= 0) {
        contourGround = ContourGroundType.VERTEX;
    }

    return {
        animatedObject,
        sceneObject,
        sceneX,
        sceneY,
        heightOffset: 0,
        plane,
        contourGround,
        priority,
        interactType: InteractType.OBJECT,
        interactId: def.id,
    };
}

export function getSceneObjects(
    scene: Scene,
    occlusionMap: OcclusionMap,
    maxPlane: number
): SceneObjects {
    const objectModels: SceneModel[] = [];
    const animatedObjects: AnimatedSceneObject[] = [];

    const startX = scene.borderRadius;
    const startY = scene.borderRadius;
    const endX = scene.borderRadius + Scene.MAP_SIZE;
    const endY = scene.borderRadius + Scene.MAP_SIZE;

    const sceneOffset = -scene.borderRadius * 128;

    for (let plane = 0; plane < scene.planes; plane++) {
        for (let tileX = startX; tileX < endX; tileX++) {
            for (let tileY = startY; tileY < endY; tileY++) {
                const tile = scene.tiles[plane][tileX][tileY];
                if (!tile || tile.minPlane > maxPlane) {
                    continue;
                }

                if (tile.floorDecoration) {
                    if (tile.floorDecoration.renderable instanceof Model) {
                        objectModels.push(
                            createObjectModel(
                                tile.floorDecoration.renderable,
                                tile.floorDecoration,
                                sceneOffset,
                                sceneOffset,
                                tileX,
                                tileY,
                                plane,
                                1,
                                occlusionMap
                            )
                        );
                    } else if (
                        tile.floorDecoration.renderable instanceof DynamicObject
                    ) {
                        animatedObjects.push(
                            createAnimatedSceneObject(
                                tile.floorDecoration.renderable,
                                tile.floorDecoration,
                                sceneOffset,
                                sceneOffset,
                                plane,
                                1
                            )
                        );
                    }
                }

                if (tile.wallObject) {
                    if (tile.wallObject.renderable0 instanceof Model) {
                        objectModels.push(
                            createObjectModel(
                                tile.wallObject.renderable0,
                                tile.wallObject,
                                sceneOffset,
                                sceneOffset,
                                tileX,
                                tileY,
                                plane,
                                1,
                                occlusionMap
                            )
                        );
                    } else if (
                        tile.wallObject.renderable0 instanceof DynamicObject
                    ) {
                        animatedObjects.push(
                            createAnimatedSceneObject(
                                tile.wallObject.renderable0,
                                tile.wallObject,
                                sceneOffset,
                                sceneOffset,
                                plane,
                                1
                            )
                        );
                    }
                    if (tile.wallObject.renderable1 instanceof Model) {
                        objectModels.push(
                            createObjectModel(
                                tile.wallObject.renderable1,
                                tile.wallObject,
                                sceneOffset,
                                sceneOffset,
                                tileX,
                                tileY,
                                plane,
                                1,
                                occlusionMap
                            )
                        );
                    } else if (
                        tile.wallObject.renderable1 instanceof DynamicObject
                    ) {
                        animatedObjects.push(
                            createAnimatedSceneObject(
                                tile.wallObject.renderable1,
                                tile.wallObject,
                                sceneOffset,
                                sceneOffset,
                                plane,
                                1
                            )
                        );
                    }
                }

                if (tile.wallDecoration) {
                    const offsetX = tile.wallDecoration.offsetX;
                    const offsetY = tile.wallDecoration.offsetY;
                    if (tile.wallDecoration.renderable0 instanceof Model) {
                        objectModels.push(
                            createObjectModel(
                                tile.wallDecoration.renderable0,
                                tile.wallDecoration,
                                offsetX + sceneOffset,
                                offsetY + sceneOffset,
                                tileX,
                                tileY,
                                plane,
                                10,
                                occlusionMap
                            )
                        );
                    } else if (
                        tile.wallDecoration.renderable0 instanceof DynamicObject
                    ) {
                        animatedObjects.push(
                            createAnimatedSceneObject(
                                tile.wallDecoration.renderable0,
                                tile.wallDecoration,
                                sceneOffset,
                                sceneOffset,
                                plane,
                                10
                            )
                        );
                    }
                    if (tile.wallDecoration.renderable1 instanceof Model) {
                        objectModels.push(
                            createObjectModel(
                                tile.wallDecoration.renderable1,
                                tile.wallDecoration,
                                sceneOffset,
                                sceneOffset,
                                tileX,
                                tileY,
                                plane,
                                10,
                                occlusionMap
                            )
                        );
                    } else if (
                        tile.wallDecoration.renderable1 instanceof DynamicObject
                    ) {
                        animatedObjects.push(
                            createAnimatedSceneObject(
                                tile.wallDecoration.renderable1,
                                tile.wallDecoration,
                                sceneOffset,
                                sceneOffset,
                                plane,
                                10
                            )
                        );
                    }
                }

                for (const gameObject of tile.gameObjects) {
                    const renderable = gameObject.renderable;

                    if (
                        gameObject.startX !== tileX ||
                        gameObject.startY !== tileY
                    ) {
                        continue;
                    }

                    if (renderable instanceof Model) {
                        objectModels.push(
                            createObjectModel(
                                renderable,
                                gameObject,
                                sceneOffset,
                                sceneOffset,
                                tileX,
                                tileY,
                                plane,
                                1,
                                occlusionMap
                            )
                        );
                    } else if (renderable instanceof DynamicObject) {
                        animatedObjects.push(
                            createAnimatedSceneObject(
                                renderable,
                                gameObject,
                                sceneOffset,
                                sceneOffset,
                                plane,
                                1
                            )
                        );
                    }
                }
            }
        }
    }

    return {
        objectModels,
        animatedSceneObjects: animatedObjects,
    };
}
