import { TextureLoader } from "../../client/fs/loader/TextureLoader";
import { RegionLoader } from "../../client/RegionLoader";
import { Scene } from "../../client/scene/Scene";
import { ObjectModelLoader } from "../../client/fs/loader/model/ObjectModelLoader";
import { ModelHashBuffer } from "../buffer/ModelHashBuffer";
import {
    addTerrain,
    createModelTextureData,
    DrawCommand,
    RenderBuffer,
} from "../buffer/RenderBuffer";
import { createOcclusionMap } from "./OcclusionMap";
import { NpcModelLoader } from "../../client/fs/loader/model/NpcModelLoader";
import { NpcSpawn } from "../npc/NpcSpawn";
import { CacheInfo } from "../CacheInfo";
import { ItemModelLoader } from "../../client/fs/loader/model/ItemModelLoader";
import { DrawRange, newDrawRange } from "./DrawRange";
import { createAnimatedObjectDataArray } from "../object/AnimatedObjectData";
import { createNpcDataArray } from "../npc/NpcData";
import { ChunkData } from "./ChunkData";
import { groupModels } from "./SceneModel";
import { getSceneObjects } from "../object/SceneObjects";
import { createNpcSpawnGroups, NpcSpawnGroup } from "../npc/NpcSpawnGroup";
import {
    AnimatedObjectGroup,
    createAnimatedObjectGroups,
} from "../object/AnimatedObjectGroup";
import { addModelGroup, createModelGroups } from "./ModelGroup";
import { createItemModelArray, ItemSpawn } from "../item/ItemSpawn";
import { MapImageLoader } from "../../client/scene/MapImageLoader";

function loadHeightMapTextureData(
    regionLoader: RegionLoader,
    regionX: number,
    regionY: number
): Float32Array {
    const heightMapTextureData = new Float32Array(Scene.MAX_PLANE * 72 * 72);

    const baseX = regionX * 64;
    const baseY = regionY * 64;

    let dataIndex = 0;
    for (let plane = 0; plane < Scene.MAX_PLANE; plane++) {
        for (let y = 0; y < 72; y++) {
            for (let x = 0; x < 72; x++) {
                heightMapTextureData[dataIndex++] =
                    (-regionLoader.getHeight(baseX + x, baseY + y, plane) / 8) |
                    0;
            }
        }
    }

    return heightMapTextureData;
}

export class ChunkDataLoader {
    cacheInfo: CacheInfo;

    regionLoader: RegionLoader;

    objectModelLoader: ObjectModelLoader;
    npcModelLoader: NpcModelLoader;
    itemModelLoader: ItemModelLoader;

    textureLoader: TextureLoader;

    mapImageLoader: MapImageLoader;

    modelHashBuf: ModelHashBuffer;

    npcSpawns: NpcSpawn[];
    itemSpawns: ItemSpawn[];

    constructor(
        cacheInfo: CacheInfo,
        regionLoader: RegionLoader,
        objectModelLoader: ObjectModelLoader,
        npcModelLoader: NpcModelLoader,
        itemModelLoader: ItemModelLoader,
        textureProvider: TextureLoader,
        mapImageLoader: MapImageLoader,
        npcSpawns: NpcSpawn[],
        itemSpawns: ItemSpawn[]
    ) {
        this.cacheInfo = cacheInfo;
        this.regionLoader = regionLoader;
        this.objectModelLoader = objectModelLoader;
        this.npcModelLoader = npcModelLoader;
        this.itemModelLoader = itemModelLoader;
        this.textureLoader = textureProvider;
        this.mapImageLoader = mapImageLoader;
        this.npcSpawns = npcSpawns;
        this.itemSpawns = itemSpawns;
        this.modelHashBuf = new ModelHashBuffer(5000);
    }

    async load(
        regionX: number,
        regionY: number,
        minimizeDrawCalls: boolean,
        loadNpcs: boolean,
        loadItems: boolean,
        maxPlane: number
    ): Promise<ChunkData | undefined> {
        const region = this.regionLoader.getRegion(regionX, regionY);
        if (!region) {
            return undefined;
        }

        let npcSpawns: NpcSpawn[] = [];
        if (loadNpcs && this.cacheInfo.game === "oldschool") {
            npcSpawns = this.npcSpawns.filter((npc) => {
                const npcRegionX = (npc.x / 64) | 0;
                const npcRegionY = (npc.y / 64) | 0;
                return (
                    regionX === npcRegionX &&
                    regionY === npcRegionY &&
                    npc.p <= maxPlane
                );
            });
        }

        let itemSpawns: ItemSpawn[] = [];
        if (loadItems) {
            itemSpawns = this.itemSpawns.filter((item) => {
                const itemRegionX = (item.x / 64) | 0;
                const itemRegionY = (item.y / 64) | 0;
                return (
                    regionX === itemRegionX &&
                    regionY === itemRegionY &&
                    item.plane <= maxPlane
                );
            });
        }

        console.time("read landscape data");
        const landscapeData = this.regionLoader.getLandscapeData(
            regionX,
            regionY
        );
        console.timeEnd("read landscape data");

        if (landscapeData) {
            console.time("load landscape");
            region.decodeLandscape(
                this.regionLoader,
                this.objectModelLoader,
                landscapeData
            );
            console.timeEnd("load landscape");
        }

        // Create scene tile models from map data
        region.addTileModels(this.regionLoader, this.textureLoader);
        region.setTileMinPlanes();

        const renderBuf = new RenderBuffer(100000);

        const terrainVertexCount = addTerrain(
            this.textureLoader,
            renderBuf,
            region,
            maxPlane
        );

        let animatedObjectGroups: AnimatedObjectGroup[] = [];
        let npcSpawnGroups: NpcSpawnGroup[] = [];
        if (landscapeData) {
            console.time("light scene");
            region.applyLighting(-50, -10, -50);
            console.timeEnd("light scene");

            const occlusionMap = createOcclusionMap(
                region.tileRenderFlags,
                region.tileUnderlays,
                region.tileOverlays
            );

            const { objectModels: sceneModels, animatedSceneObjects } =
                getSceneObjects(region, occlusionMap, maxPlane);

            sceneModels.push(
                ...createItemModelArray(
                    this.itemModelLoader,
                    this.regionLoader,
                    region,
                    itemSpawns
                )
            );

            const groupedModels = groupModels(this.modelHashBuf, sceneModels);

            animatedObjectGroups = createAnimatedObjectGroups(
                this.regionLoader,
                this.objectModelLoader,
                this.textureLoader,
                renderBuf,
                animatedSceneObjects
            );
            npcSpawnGroups = createNpcSpawnGroups(
                this.npcModelLoader,
                this.textureLoader,
                renderBuf,
                npcSpawns
            );

            const modelGroups = createModelGroups(
                this.textureLoader,
                groupedModels,
                minimizeDrawCalls
            );

            // alpha last, planes low to high
            modelGroups.sort(
                (a, b) =>
                    (a.alpha ? 1 : 0) - (b.alpha ? 1 : 0) ||
                    (a.merge ? 0 : 1) - (b.merge ? 0 : 1) ||
                    a.plane - b.plane
            );

            for (const modelGroup of modelGroups) {
                addModelGroup(this.textureLoader, renderBuf, modelGroup);
            }
        }

        const triangles = renderBuf.drawCommands
            .map((cmd) => (cmd.elements / 3) * cmd.datas.length)
            .reduce((a, b) => a + b, 0);
        const lowDetailTriangles = renderBuf.drawCommandsLowDetail
            .map((cmd) => (cmd.elements / 3) * cmd.datas.length)
            .reduce((a, b) => a + b, 0);
        const totalTriangles = triangles + lowDetailTriangles;

        const drawCommands: DrawCommand[] = [];
        drawCommands.push(...renderBuf.drawCommandsLowDetail);
        drawCommands.push(...renderBuf.drawCommands);

        const drawCommandsAlpha: DrawCommand[] = [];
        drawCommandsAlpha.push(...renderBuf.drawCommandsAlpha);

        const drawCommandsInteract: DrawCommand[] = [];
        drawCommandsInteract.push(...renderBuf.drawCommandsInteractLowDetail);
        drawCommandsInteract.push(...renderBuf.drawCommandsInteract);

        const drawCommandsInteractAlpha: DrawCommand[] = [];
        drawCommandsInteractAlpha.push(...renderBuf.drawCommandsInteractAlpha);

        const animatedObjects = createAnimatedObjectDataArray(
            animatedObjectGroups,
            drawCommands,
            drawCommandsAlpha,
            drawCommandsInteract,
            drawCommandsInteractAlpha
        );

        const npcs = createNpcDataArray(npcSpawnGroups);

        // Normal (merged)
        const drawRanges: DrawRange[] = drawCommands.map((cmd) =>
            newDrawRange(cmd.offset, cmd.elements, cmd.datas.length)
        );
        const drawRangesLowDetail = drawRanges.slice(
            renderBuf.drawCommandsLowDetail.length
        );
        const drawRangesAlpha: DrawRange[] = drawCommandsAlpha.map((cmd) =>
            newDrawRange(cmd.offset, cmd.elements, cmd.datas.length)
        );

        // Interact (non merged)
        const drawRangesInteract: DrawRange[] = drawCommandsInteract.map(
            (cmd) => newDrawRange(cmd.offset, cmd.elements, cmd.datas.length)
        );
        const drawRangesInteractLowDetail = drawRangesInteract.slice(
            renderBuf.drawCommandsInteractLowDetail.length
        );
        const drawRangesInteractAlpha: DrawRange[] =
            drawCommandsInteractAlpha.map((cmd) =>
                newDrawRange(cmd.offset, cmd.elements, cmd.datas.length)
            );

        const drawRangesNpc: DrawRange[] = npcs.map((_npc) =>
            newDrawRange(0, 0, 1)
        );
        // const drawRangesNpc: MultiDrawCommand[] = npcs.map(npc => npc.idleAnim.frames[0]);

        const modelTextureData = createModelTextureData(drawCommands);
        const modelTextureDataAlpha = createModelTextureData(drawCommandsAlpha);

        const modelTextureDataInteract =
            createModelTextureData(drawCommandsInteract);
        const modelTextureDataInteractAlpha = createModelTextureData(
            drawCommandsInteractAlpha
        );

        const heightMapTextureData = loadHeightMapTextureData(
            this.regionLoader,
            regionX,
            regionY
        );

        const uniqTotalTriangles = drawCommands
            .map((cmd) => cmd.elements / 3)
            .reduce((a, b) => a + b, 0);
        const indexBufferBytes = renderBuf.indices.length * 4;
        const currentBytes =
            renderBuf.vertexBuf.byteOffset() + indexBufferBytes;

        const alphaTriangles = drawCommandsAlpha
            .map((cmd) => (cmd.elements / 3) * cmd.datas.length)
            .reduce((a, b) => a + b, 0);

        console.log(
            "total triangles",
            totalTriangles,
            "low detail: ",
            triangles,
            "uniq triangles: ",
            uniqTotalTriangles,
            "terrain verts: ",
            terrainVertexCount,
            "total vertices: ",
            renderBuf.vertexBuf.offset,
            "now: ",
            currentBytes,
            currentBytes - indexBufferBytes,
            "uniq vertices: ",
            renderBuf.vertexBuf.vertexIndices.size,
            "data texture size: ",
            modelTextureData.length,
            "draw calls: ",
            drawRanges.length,
            "indices: ",
            renderBuf.indices.length,
            "alpha triangles: ",
            alphaTriangles,
            "alpha data texture size: ",
            modelTextureDataAlpha.length,
            "alpha draw calls: ",
            drawRangesAlpha.length
        );

        const minimapBlob = await this.loadMinimapBlob(region, 0);

        return {
            regionX,
            regionY,

            minimapBlob,

            vertices: renderBuf.vertexBuf.byteArray(),
            indices: new Int32Array(renderBuf.indices),

            modelTextureData,
            modelTextureDataAlpha,

            modelTextureDataInteract,
            modelTextureDataInteractAlpha,

            heightMapTextureData,

            drawRanges,
            drawRangesLowDetail,

            drawRangesInteract,
            drawRangesInteractLowDetail,

            drawRangesAlpha,
            drawRangesInteractAlpha,

            drawRangesNpc,

            animatedObjects,

            npcs,

            tileRenderFlags: region.tileRenderFlags,
            collisionFlags: region.collisionMaps.map((map) => map.flags),

            loadNpcs,
            loadItems,
            maxPlane,
            cacheInfo: this.cacheInfo,
        };
    }

    private async loadMinimapBlob(region: Scene, plane: number): Promise<Blob> {
        console.time("create minimap " + region.regionX + "," + region.regionY);
        // For bridges
        for (let tileX = 0; tileX < Scene.MAP_SIZE; tileX++) {
            for (let tileY = 0; tileY < Scene.MAP_SIZE; tileY++) {
                if ((region.tileRenderFlags[1][tileX][tileY] & 0x2) === 2) {
                    region.setLinkBelow(tileX, tileY);
                }
            }
        }
        const minimapPixels = this.mapImageLoader.createMinimapPixels(
            region,
            plane
        );
        // convert to rgba
        const minimapView = new DataView(minimapPixels.buffer);
        for (let i = 0; i < minimapPixels.length; i++) {
            minimapView.setUint32(i * 4, (minimapPixels[i] << 8) | 0xff);
        }
        const minimapBlob = await pixelsToBlob(minimapPixels);
        console.timeEnd(
            "create minimap " + region.regionX + "," + region.regionY
        );

        return minimapBlob;
    }

    async loadMinimap(
        regionX: number,
        regionY: number,
        plane: number
    ): Promise<Blob | undefined> {
        const region = this.regionLoader.getRegion(regionX, regionY);
        if (!region) {
            return undefined;
        }

        console.time("read landscape data");
        const landscapeData = this.regionLoader.getLandscapeData(
            regionX,
            regionY
        );
        console.timeEnd("read landscape data");

        if (landscapeData) {
            console.time("load landscape");
            region.decodeLandscape(
                this.regionLoader,
                this.objectModelLoader,
                landscapeData
            );
            console.timeEnd("load landscape");
        }

        // Create scene tile models from map data
        region.addTileModels(this.regionLoader, this.textureLoader);
        region.setTileMinPlanes();

        return this.loadMinimapBlob(region, plane);
    }
}

async function pixelsToBlob(pixels: Int32Array): Promise<Blob> {
    const canvas = new OffscreenCanvas(256, 256);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Could not get canvas context");
    }

    const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imgd.data.set(new Uint8ClampedArray(pixels.buffer));

    ctx.putImageData(imgd, 0, 0);

    return canvas.convertToBlob();
}
