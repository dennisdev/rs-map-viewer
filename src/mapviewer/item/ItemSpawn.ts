import { RegionLoader } from "../../client/RegionLoader";
import { ItemModelLoader } from "../../client/fs/loader/model/ItemModelLoader";
import { Model } from "../../client/model/Model";
import { Scene } from "../../client/scene/Scene";
import { ContourGroundType } from "../buffer/RenderBuffer";
import { InteractType } from "../chunk/InteractType";
import { SceneModel } from "../chunk/SceneModel";

export type ItemSpawn = {
    id: number;
    count: number;
    x: number;
    y: number;
    plane: number;
};

export async function fetchItemSpawns(): Promise<ItemSpawn[]> {
    const response = await fetch("/item-spawns.json");
    return await response.json();
}

export function createItemModelArray(
    itemModelLoader: ItemModelLoader,
    regionLoader: RegionLoader,
    region: Scene,
    spawns: ItemSpawn[]
): SceneModel[] {
    return spawns
        .map((spawn) =>
            createItemModel(itemModelLoader, regionLoader, region, spawn)
        )
        .filter((model): model is SceneModel => !!model);
}

export function createItemModel(
    itemModelLoader: ItemModelLoader,
    regionLoader: RegionLoader,
    region: Scene,
    spawn: ItemSpawn
): SceneModel | undefined {
    const tileX = spawn.x % 64;
    const tileY = spawn.y % 64;

    const model = itemModelLoader.getModel(spawn.id, spawn.count);
    if (!model) {
        return undefined;
    }
    let renderPlane = spawn.plane;
    if (
        renderPlane < 3 &&
        (region.tileRenderFlags[1][tileX][tileY] & 0x2) === 2
    ) {
        renderPlane = spawn.plane + 1;
    }

    const baseX = region.regionX * 64;
    const baseY = region.regionY * 64;

    const sceneHeight = regionLoader.getHeightInterp(
        baseX + tileX + 0.5,
        baseY + tileY + 0.5,
        renderPlane
    );

    let heightOffset = 0;
    const tile = region.tiles[renderPlane][tileX][tileY];
    if (tile) {
        for (const object of tile.gameObjects) {
            if (
                (object.flags & 256) === 256 &&
                object.renderable instanceof Model
            ) {
                const model = object.renderable;
                model.calculateBoundsCylinder();
                if (model.contourHeight > heightOffset) {
                    heightOffset = model.contourHeight;
                }
            }
        }
    }

    let contourGround = ContourGroundType.CENTER_TILE;

    if (heightOffset !== 0) {
        heightOffset += -sceneHeight;
        contourGround = ContourGroundType.NONE;
    }

    return {
        model,
        lowDetail: false,
        sceneHeight,
        sceneX: tileX * 128 + 64,
        sceneY: tileY * 128 + 64,
        heightOffset,
        plane: renderPlane,
        contourGround,
        priority: 4,
        interactType: InteractType.ITEM,
        interactId: spawn.id,
    };
}
