import { LocModelType } from "../../../rs/config/loctype/LocModelType";
import { LocType } from "../../../rs/config/loctype/LocType";
import { LocTypeLoader } from "../../../rs/config/loctype/LocTypeLoader";
import { Model } from "../../../rs/model/Model";
import { Scene } from "../../../rs/scene/Scene";
import { SceneLoc } from "../../../rs/scene/SceneLoc";
import { getIdFromTag } from "../../../rs/scene/entity/EntityTag";
import { LocEntity } from "../../../rs/scene/entity/LocEntity";
import { INVALID_HSL_COLOR } from "../../../rs/util/ColorUtil";
import { ContourGroundType, SceneModel } from "../buffer/SceneBuffer";
import { InteractType } from "../../webgl/InteractType";
import { SceneLocEntity } from "./SceneLocEntity";

export type SceneLocs = {
    locs: SceneModel[];
    locEntities: SceneLocEntity[];
};

export function isLowDetail(
    scene: Scene,
    level: number,
    tileX: number,
    tileY: number,
    locType: LocType,
    locModelType: LocModelType,
): boolean {
    const tile = scene.tiles[level][tileX][tileY];
    const tileModel = tile?.tileModel;
    // no tile model, or tile model has invis faces
    const hasTileModel =
        tileModel && tileModel.faceColorsA.findIndex((c) => c === INVALID_HSL_COLOR) === -1;

    if (
        locModelType === LocModelType.FLOOR_DECORATION &&
        locType.isInteractive === 0 &&
        locType.clipType !== 1 &&
        !locType.obstructsGround &&
        hasTileModel
    ) {
        return true;
    }

    const isWallDecoration =
        locModelType >= LocModelType.WALL_DECORATION_INSIDE &&
        locModelType <= LocModelType.WALL_DECORATION_DIAGONAL_DOUBLE;
    if (
        (locModelType === LocModelType.NORMAL ||
            locModelType === LocModelType.NORMAL_DIAGIONAL ||
            isWallDecoration) &&
        locType.isInteractive === 1
    ) {
        return scene.isInside(level, tileX, tileY);
    }

    return false;
}

export function createSceneModel(
    locTypeLoader: LocTypeLoader,
    scene: Scene,
    model: Model,
    sceneLoc: SceneLoc,
    offsetX: number,
    offsetY: number,
    level: number,
    tileX: number,
    tileY: number,
    priority: number,
): SceneModel {
    const id = getIdFromTag(sceneLoc.tag);
    const type: LocModelType = sceneLoc.flags & 0x3f;
    const locType = locTypeLoader.load(id);

    const sceneX = sceneLoc.x + offsetX;
    const sceneZ = sceneLoc.y + offsetY;
    const sceneHeight = sceneLoc.height;

    const contourGroundType = model.contourVerticesY
        ? ContourGroundType.VERTEX
        : ContourGroundType.CENTER_TILE;

    return {
        model,
        sceneHeight,
        lowDetail: isLowDetail(scene, level, tileX, tileY, locType, type),
        forceMerge: locType.contourGroundType > 1,

        sceneX,
        sceneZ,
        heightOffset: 0,
        level,
        contourGround: contourGroundType,
        priority,
        interactType: InteractType.LOC,
        interactId: id,
    };
}

export function createSceneLocEntity(
    locTypeLoader: LocTypeLoader,
    entity: LocEntity,
    sceneLoc: SceneLoc,
    offsetX: number,
    offsetY: number,
    level: number,
    priority: number,
): SceneLocEntity {
    const id = getIdFromTag(sceneLoc.tag);
    const locType = locTypeLoader.load(id);

    const contourGroundType =
        locType.contourGroundType > 0 ? ContourGroundType.VERTEX : ContourGroundType.CENTER_TILE;

    const sceneX = sceneLoc.x + offsetX;
    const sceneZ = sceneLoc.y + offsetY;

    return {
        entity,
        sceneLoc,
        lowDetail: false,

        sceneX,
        sceneZ,
        heightOffset: 0,
        level,
        contourGround: contourGroundType,
        priority,
        interactType: InteractType.LOC,
        interactId: id,
    };
}

export function getSceneLocs(
    locTypeLoader: LocTypeLoader,
    scene: Scene,
    borderSize: number,
    maxLevel: number,
): SceneLocs {
    const locs: SceneModel[] = [];
    const locEntities: SceneLocEntity[] = [];

    const startX = borderSize;
    const startY = borderSize;
    const endX = borderSize + Scene.MAP_SQUARE_SIZE;
    const endY = borderSize + Scene.MAP_SQUARE_SIZE;

    const sceneOffset = borderSize * -128;

    for (let level = 0; level < scene.levels; level++) {
        for (let tileX = startX; tileX < endX; tileX++) {
            for (let tileY = startY; tileY < endY; tileY++) {
                const tile = scene.tiles[level][tileX][tileY];
                // if (!tile || tile.minLevel > maxLevel) {
                //     continue;
                // }
                if (
                    !tile ||
                    (tile.minLevel > maxLevel &&
                        !scene.isPlayerLevel(level, tileX, tileY, maxLevel))
                ) {
                    continue;
                }

                if (tile.floorDecoration) {
                    if (tile.floorDecoration.entity instanceof Model) {
                        locs.push(
                            createSceneModel(
                                locTypeLoader,
                                scene,
                                tile.floorDecoration.entity,
                                tile.floorDecoration,
                                sceneOffset,
                                sceneOffset,
                                level,
                                tileX,
                                tileY,
                                3,
                            ),
                        );
                    } else if (tile.floorDecoration.entity instanceof LocEntity) {
                        locEntities.push(
                            createSceneLocEntity(
                                locTypeLoader,
                                tile.floorDecoration.entity,
                                tile.floorDecoration,
                                sceneOffset,
                                sceneOffset,
                                level,
                                3,
                            ),
                        );
                    }
                }

                if (tile.wall) {
                    if (tile.wall.entity0 instanceof Model) {
                        locs.push(
                            createSceneModel(
                                locTypeLoader,
                                scene,
                                tile.wall.entity0,
                                tile.wall,
                                sceneOffset,
                                sceneOffset,
                                level,
                                tileX,
                                tileY,
                                1,
                            ),
                        );
                    } else if (tile.wall.entity0 instanceof LocEntity) {
                        locEntities.push(
                            createSceneLocEntity(
                                locTypeLoader,
                                tile.wall.entity0,
                                tile.wall,
                                sceneOffset,
                                sceneOffset,
                                level,
                                1,
                            ),
                        );
                    }

                    if (tile.wall.entity1 instanceof Model) {
                        locs.push(
                            createSceneModel(
                                locTypeLoader,
                                scene,
                                tile.wall.entity1,
                                tile.wall,
                                sceneOffset,
                                sceneOffset,
                                level,
                                tileX,
                                tileY,
                                1,
                            ),
                        );
                    } else if (tile.wall.entity1 instanceof LocEntity) {
                        locEntities.push(
                            createSceneLocEntity(
                                locTypeLoader,
                                tile.wall.entity1,
                                tile.wall,
                                sceneOffset,
                                sceneOffset,
                                level,
                                1,
                            ),
                        );
                    }
                }

                if (tile.wallDecoration) {
                    const offsetX = tile.wallDecoration.offsetX;
                    const offsetY = tile.wallDecoration.offsetY;
                    if (tile.wallDecoration.entity0 instanceof Model) {
                        locs.push(
                            createSceneModel(
                                locTypeLoader,
                                scene,
                                tile.wallDecoration.entity0,
                                tile.wallDecoration,
                                offsetX + sceneOffset,
                                offsetY + sceneOffset,
                                level,
                                tileX,
                                tileY,
                                10,
                            ),
                        );
                    } else if (tile.wallDecoration.entity0 instanceof LocEntity) {
                        locEntities.push(
                            createSceneLocEntity(
                                locTypeLoader,
                                tile.wallDecoration.entity0,
                                tile.wallDecoration,
                                offsetX + sceneOffset,
                                offsetY + sceneOffset,
                                level,
                                10,
                            ),
                        );
                    }

                    if (tile.wallDecoration.entity1 instanceof Model) {
                        locs.push(
                            createSceneModel(
                                locTypeLoader,
                                scene,
                                tile.wallDecoration.entity1,
                                tile.wallDecoration,
                                sceneOffset,
                                sceneOffset,
                                level,
                                tileX,
                                tileY,
                                10,
                            ),
                        );
                    } else if (tile.wallDecoration.entity1 instanceof LocEntity) {
                        locEntities.push(
                            createSceneLocEntity(
                                locTypeLoader,
                                tile.wallDecoration.entity1,
                                tile.wallDecoration,
                                sceneOffset,
                                sceneOffset,
                                level,
                                10,
                            ),
                        );
                    }
                }

                for (const loc of tile.locs) {
                    if (loc.startX !== tileX || loc.startY !== tileY) {
                        continue;
                    }

                    if (loc.entity instanceof Model) {
                        locs.push(
                            createSceneModel(
                                locTypeLoader,
                                scene,
                                loc.entity,
                                loc,
                                sceneOffset,
                                sceneOffset,
                                level,
                                tileX,
                                tileY,
                                1,
                            ),
                        );
                    } else if (loc.entity instanceof LocEntity) {
                        locEntities.push(
                            createSceneLocEntity(
                                locTypeLoader,
                                loc.entity,
                                loc,
                                sceneOffset,
                                sceneOffset,
                                level,
                                1,
                            ),
                        );
                    }
                }
            }
        }
    }

    return {
        locs: locs,
        locEntities: locEntities,
    };
}
