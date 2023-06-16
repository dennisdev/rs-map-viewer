import { CacheInfo } from "../CacheInfo";
import { NpcData } from "../npc/NpcData";
import { AnimatedObjectData } from "../object/AnimatedObjectData";
import { DrawRange } from "./DrawRange";

export type ChunkData = {
    regionX: number;
    regionY: number;

    minimapBlob: Blob;

    vertices: Uint8Array;
    indices: Int32Array;

    modelTextureData: Uint16Array;
    modelTextureDataAlpha: Uint16Array;

    modelTextureDataInteract: Uint16Array;
    modelTextureDataInteractAlpha: Uint16Array;

    heightMapTextureData: Float32Array;

    drawRanges: DrawRange[];
    drawRangesLowDetail: DrawRange[];

    drawRangesInteract: DrawRange[];
    drawRangesInteractLowDetail: DrawRange[];

    drawRangesAlpha: DrawRange[];
    drawRangesInteractAlpha: DrawRange[];

    drawRangesNpc: DrawRange[];

    animatedObjects: AnimatedObjectData[];
    npcs: NpcData[];
    tileRenderFlags: Uint8Array[][];
    collisionFlags: Int32Array[];
    loadNpcs: boolean;
    loadItems: boolean;
    maxPlane: number;
    cacheInfo: CacheInfo;
};
