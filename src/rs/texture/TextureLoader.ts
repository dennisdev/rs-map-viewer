export interface TextureLoader {
    getTextureIds(): number[];

    getTextureIndex(id: number): number;

    isSmall(id: number): boolean;

    isSd(id: number): boolean;

    isTransparent(id: number): boolean;

    getAverageHsl(id: number): number;

    getAnimationUv(id: number): [number, number];
    // getMoveU(id: number): number;
    // getMoveV(id: number): number;

    getPixelsRgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array;
}
