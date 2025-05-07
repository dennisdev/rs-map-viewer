import { CollisionData } from "../../../rs/scene/CollisionMap";
import { DrawRange } from "../DrawRange";
import { LocAnimatedData } from "../loc/LocAnimatedData";
import { NpcData } from "../npc/NpcData";

export type SdMapData = {
    mapX: number;
    mapY: number;

    cacheName: string;

    maxLevel: number;
    loadObjs: boolean;
    loadNpcs: boolean;
    loadLocs: boolean;

    smoothTerrain: boolean;

    borderSize: number;

    tileRenderFlags: Uint8Array[][];
    collisionDatas: CollisionData[];

    minimapBlob: Blob;

    vertices: Uint8Array;
    indices: Int32Array;

    modelTextureData: Uint16Array;
    modelTextureDataAlpha: Uint16Array;

    modelTextureDataLod: Uint16Array;
    modelTextureDataLodAlpha: Uint16Array;

    modelTextureDataInteract: Uint16Array;
    modelTextureDataInteractAlpha: Uint16Array;

    modelTextureDataInteractLod: Uint16Array;
    modelTextureDataInteractLodAlpha: Uint16Array;

    heightMapTextureData: Int16Array;

    drawRanges: DrawRange[];
    drawRangesAlpha: DrawRange[];

    drawRangesLod: DrawRange[];
    drawRangesLodAlpha: DrawRange[];

    drawRangesInteract: DrawRange[];
    drawRangesInteractAlpha: DrawRange[];

    drawRangesInteractLod: DrawRange[];
    drawRangesInteractLodAlpha: DrawRange[];

    locsAnimated: LocAnimatedData[];
    npcs: NpcData[];

    loadedTextures: Map<number, Int32Array>;
};
