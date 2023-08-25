export abstract class Entity {
    height: number = 1000;

    canMergeNormals(): boolean {
        return false;
    }

    mergeNormals(
        entity: Entity,
        offsetX: number,
        offsetY: number,
        offsetZ: number,
        hideOccluded: boolean,
    ): void {}

    // light(textureLoader: TextureLoader, lightX: number, lightY: number, lightZ: number): Entity {
    //     return this;
    // }
}
