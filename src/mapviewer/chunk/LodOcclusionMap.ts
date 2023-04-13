import { Scene } from "../../client/scene/Scene";

export function createOcclusionMap(renderFlags: Uint8Array[][], underlayIds: Uint16Array[][], overlayIds: Int16Array[][]): OcclusionMap {
    const occlusionMap = new OcclusionMap();

    for (let x = 0; x < Scene.MAP_SIZE; x++) {
        for (let y = 0; y < Scene.MAP_SIZE; y++) {
            let occluded = false;
            for (let plane = Scene.MAX_PLANE - 1; plane >= 0; plane--) {
                occlusionMap.setOccluded(plane, x, y, occluded);
                const underlayId = underlayIds[plane][x][y];
                const overlayId = overlayIds[plane][x][y];
                // everything below a roof or tile can be occluded
                if ((renderFlags[plane][x][y] & 16) != 0 || underlayId || overlayId) {
                    occluded = true;
                }
            }
        }
    }
    return occlusionMap;
}

export class OcclusionMap {
    flags: Uint8Array = new Uint8Array(Scene.MAX_PLANE * Scene.MAP_SIZE * Scene.MAP_SIZE);

    private getIndex(plane: number, x: number, y: number) {
        return plane * Scene.MAP_SIZE * Scene.MAP_SIZE + y * Scene.MAP_SIZE + x;
    }

    isOccluded(plane: number, x: number, y: number): boolean {
        return this.flags[this.getIndex(plane, x, y)] === 1;
    }

    setOccluded(plane: number, x: number, y: number, occluded: boolean) {
        this.flags[this.getIndex(plane, x, y)] = occluded ? 1 : 0;
    }
}
