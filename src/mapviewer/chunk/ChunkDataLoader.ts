import { ObjectDefinition } from "../../client/fs/definition/ObjectDefinition";
import { TextureLoader } from "../../client/fs/loader/TextureLoader";
import { Model } from "../../client/model/Model";
import { RegionLoader } from "../../client/RegionLoader";
import { Scene } from "../../client/scene/Scene";
import { DynamicObject } from "../../client/scene/DynamicObject";
import { vec3 } from "gl-matrix";
import { ObjectModelLoader } from "../../client/scene/ObjectModelLoader";
import { getModelHash, ModelHashBuffer } from "../buffer/ModelHashBuffer";
import {
    addModel,
    addTerrain,
    ContourGroundType,
    DrawCommand,
    DrawData,
    getModelFaces,
    NpcDrawCommand,
    NpcDrawData,
    RenderBuffer,
} from "../buffer/RenderBuffer";
import { createOcclusionMap, OcclusionMap } from "./OcclusionMap";
import { GameObject, SceneObject } from "../../client/scene/SceneObject";
import { NpcModelLoader } from "../../client/scene/NpcModelLoader";
import { NpcSpawn } from "../npc/NpcSpawn";
import { NpcDefinition } from "../../client/fs/definition/NpcDefinition";
import { CacheInfo } from "../CacheInfo";

export type ChunkData = {
    regionX: number;
    regionY: number;

    vertices: Uint8Array;
    indices: Int32Array;

    modelTextureData: Uint16Array;
    modelTextureDataAlpha: Uint16Array;

    modelTextureDataInteract: Uint16Array;
    modelTextureDataInteractAlpha: Uint16Array;

    heightMapTextureData: Float32Array;

    drawRanges: MultiDrawCommand[];
    drawRangesLowDetail: MultiDrawCommand[];

    drawRangesInteract: MultiDrawCommand[];
    drawRangesInteractLowDetail: MultiDrawCommand[];

    drawRangesAlpha: MultiDrawCommand[];
    drawRangesInteractAlpha: MultiDrawCommand[];

    drawRangesNpc: MultiDrawCommand[];

    animatedObjects: AnimatedModelData[];
    npcs: NpcData[];
    tileRenderFlags: Uint8Array[][];
    collisionFlags: Int32Array[];
    loadNpcs: boolean;
    maxPlane: number;
    cacheInfo: CacheInfo;
};

type MultiDrawCommand = [number, number, number];

function newMultiDrawCommand(
    offset: number,
    elements: number,
    instances: number
): MultiDrawCommand {
    return [offset, elements, instances];
}

type DrawRangeSingle = [number, number];
type DrawRangeInstanced = [number, number, number];

type DrawRange = DrawRangeSingle | DrawRangeInstanced;

function newDrawRange(
    offset: number,
    elements: number,
    instances: number
): DrawRange {
    if (instances === 1) {
        return [offset, elements];
    } else {
        return [offset, elements, instances];
    }
}

type ObjectModel = {
    model: Model;
    lowDetail: boolean;
    sceneHeight: number;
} & DrawData;

type AnimatedSceneObject = {
    animatedObject: DynamicObject;
    sceneObject: SceneObject;
} & DrawData;

type AnimatedObjectGroup = {
    animationId: number;
    frames: DrawRangeInstanced[];
    framesAlpha: DrawRangeInstanced[] | undefined;
    objects: AnimatedSceneObject[];
};

type AnimatedNpc = {} & DrawData;

type AnimationFrames = {
    frames: DrawRangeInstanced[];
    framesAlpha: DrawRangeInstanced[] | undefined;
};

type AnimatedNpcGroup = {
    animationId: number;
    frames: DrawRangeInstanced[];
    framesAlpha: DrawRangeInstanced[] | undefined;
    npcs: AnimatedNpc[];
};

type NpcSpawnGroup = {
    idleAnim: AnimationFrames;
    walkAnim: AnimationFrames | undefined;
    npcSpawns: NpcSpawn[];
};

export type NpcData = {
    id: number;
    tileX: number;
    tileY: number;
    plane: number;
    idleAnim: AnimationFrames;
    walkAnim: AnimationFrames | undefined;
};

export type AnimatedModelData = {
    drawRangeIndex: number;
    drawRangeAlphaIndex: number;

    drawRangeInteractIndex: number;
    drawRangeInteractAlphaIndex: number;

    frames: DrawRangeInstanced[];
    framesAlpha: DrawRangeInstanced[] | undefined;

    animationId: number;
    randomStart: boolean;
};

type SceneObjects = {
    objectModels: ObjectModel[];
    animatedObjects: AnimatedSceneObject[];
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
        def.clipType != 1 &&
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

function createObjectModel(
    model: Model,
    sceneObject: SceneObject,
    offsetX: number,
    offsetY: number,
    tileX: number,
    tileY: number,
    plane: number,
    priority: number,
    occlusionMap: OcclusionMap
): ObjectModel {
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
        plane,
        contourGround,
        priority,
        id: def.id,
    };
}

function createAnimatedSceneObject(
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
        plane,
        contourGround,
        priority,
        id: def.id,
    };
}

function getSceneObjects(
    scene: Scene,
    occlusionMap: OcclusionMap,
    maxPlane: number
): SceneObjects {
    const objectModels: ObjectModel[] = [];

    const animatedObjects: AnimatedSceneObject[] = [];

    const gameObjects: Set<GameObject> = new Set();

    for (let plane = 0; plane < scene.planes; plane++) {
        for (let tileX = 0; tileX < scene.sizeX; tileX++) {
            for (let tileY = 0; tileY < scene.sizeY; tileY++) {
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
                                0,
                                0,
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
                                0,
                                0,
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
                                0,
                                0,
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
                                0,
                                0,
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
                                0,
                                0,
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
                                0,
                                0,
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
                                offsetX,
                                offsetY,
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
                                0,
                                0,
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
                                0,
                                0,
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
                                0,
                                0,
                                plane,
                                10
                            )
                        );
                    }
                }

                for (const gameObject of tile.gameObjects) {
                    const renderable = gameObject.renderable;

                    if (gameObjects.has(gameObject)) {
                        continue;
                    }

                    if (renderable instanceof Model) {
                        objectModels.push(
                            createObjectModel(
                                renderable,
                                gameObject,
                                0,
                                0,
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
                                0,
                                0,
                                plane,
                                1
                            )
                        );
                    }
                    gameObjects.add(gameObject);
                }
            }
        }
    }

    return {
        objectModels,
        animatedObjects,
    };
}

function getUniqueObjects(
    modelDataBuf: ModelHashBuffer,
    objects: ObjectModel[]
): ObjectModel[][] {
    const uniqueObjectsMap: Map<number, ObjectModel[]> = new Map();

    const modelMap: Map<Model, number> = new Map();

    for (const object of objects) {
        const model = object.model;

        if (model.faceCount === 0) {
            continue;
        }

        let hash = modelMap.get(model);

        if (hash === undefined) {
            hash = getModelHash(modelDataBuf, model);

            modelMap.set(model, hash);
        }

        const uniqueObjects = uniqueObjectsMap.get(hash);
        if (uniqueObjects) {
            uniqueObjects.push(object);
        } else {
            uniqueObjectsMap.set(hash, [object]);
        }
    }

    return Array.from(uniqueObjectsMap.values());
}

function getAnimatedModelKey(
    id: number,
    type: number,
    rotation: number,
    animationId: number
): bigint {
    // BigInt(tileX & 0x7F) | BigInt(tileY & 0x7F) << 7n | BigInt(entityType & 3) << 14n | BigInt(id) << 17n;
    return (
        BigInt(id) |
        (BigInt(type) << 16n) |
        (BigInt(rotation) << 21n) |
        (BigInt(animationId) << 24n)
    );
}

function addModelAnimFrame(
    textureLoader: TextureLoader,
    renderBuf: RenderBuffer,
    model: Model,
    alphaOnly: boolean | undefined = undefined
): DrawRangeInstanced {
    let faces = getModelFaces(textureLoader, model);

    if (alphaOnly !== undefined) {
        faces = faces.filter(
            (face) =>
                (face.alpha !== 0xff ||
                    textureLoader.hasAlpha(face.textureId)) === alphaOnly
        );
    }

    const indexByteOffset = renderBuf.indexByteOffset();
    if (faces.length > 0) {
        addModel(renderBuf, model, faces);
    }
    const modelVertexCount =
        (renderBuf.indexByteOffset() - indexByteOffset) / 4;

    return [indexByteOffset, modelVertexCount, 1];
}

function getAnimatedObjectGroups(
    regionLoader: RegionLoader,
    objectModelLoader: ObjectModelLoader,
    textureLoader: TextureLoader,
    renderBuf: RenderBuffer,
    animatedObjects: AnimatedSceneObject[]
): AnimatedObjectGroup[] {
    const uniqueObjectsMap: Map<bigint, AnimatedSceneObject[]> = new Map();

    for (const object of animatedObjects) {
        const animatedObject = object.animatedObject;
        const key = getAnimatedModelKey(
            animatedObject.id,
            animatedObject.type,
            animatedObject.rotation,
            animatedObject.animationId
        );

        const uniqueObjects = uniqueObjectsMap.get(key);
        if (uniqueObjects) {
            uniqueObjects.push(object);
        } else {
            uniqueObjectsMap.set(key, [object]);
        }
    }

    const groups: AnimatedObjectGroup[] = [];
    for (const objects of uniqueObjectsMap.values()) {
        const { animatedObject, sceneObject } = objects[0];

        const animDef = objectModelLoader.animationLoader.getDefinition(
            animatedObject.animationId
        );
        if (!animDef.frameIds) {
            continue;
        }

        let defTransform: ObjectDefinition | undefined = sceneObject.def;
        if (sceneObject.def.transforms) {
            defTransform = defTransform.transform(
                regionLoader.varpManager,
                regionLoader.objectLoader
            );
        }
        if (!defTransform) {
            continue;
        }
        const frames: DrawRangeInstanced[] = [];
        let framesAlpha: DrawRangeInstanced[] = [];
        let alphaFrameCount = 0;
        for (let i = 0; i < animDef.frameIds.length; i++) {
            const model = objectModelLoader.getObjectModelAnimated(
                defTransform,
                animatedObject.type,
                animatedObject.rotation,
                animatedObject.animationId,
                i
            );
            if (model) {
                frames.push(
                    addModelAnimFrame(textureLoader, renderBuf, model, false)
                );
                const alphaFrame = addModelAnimFrame(
                    textureLoader,
                    renderBuf,
                    model,
                    true
                );
                if (alphaFrame[1] > 0) {
                    alphaFrameCount++;
                }
                framesAlpha.push(alphaFrame);
            }
        }
        if (frames.length > 0) {
            groups.push({
                animationId: animatedObject.animationId,
                frames,
                framesAlpha: alphaFrameCount > 0 ? framesAlpha : undefined,
                objects: objects,
            });
        }
    }

    return groups;
}

function getNpcAnimationFrames(
    npcModelLoader: NpcModelLoader,
    textureLoader: TextureLoader,
    renderBuf: RenderBuffer,
    def: NpcDefinition,
    animationId: number
): AnimationFrames | undefined {
    if (animationId === -1) {
        return undefined;
    }

    const animDef = npcModelLoader.animationLoader.getDefinition(animationId);
    if (!animDef.frameIds) {
        return undefined;
    }

    const frames: DrawRangeInstanced[] = [];
    const framesAlpha: DrawRangeInstanced[] = [];
    let alphaFrameCount = 0;
    for (let i = 0; i < animDef.frameIds.length; i++) {
        const model = npcModelLoader.getModel(def, animationId, i);
        if (model) {
            frames.push(
                addModelAnimFrame(textureLoader, renderBuf, model, false)
            );
            const alphaFrame = addModelAnimFrame(
                textureLoader,
                renderBuf,
                model,
                true
            );
            if (alphaFrame[1] > 0) {
                alphaFrameCount++;
            }
            framesAlpha.push(alphaFrame);
        } else {
            frames.push([0, 0, 0]);
        }
    }

    if (frames.length === 0) {
        return undefined;
    }

    return {
        frames,
        framesAlpha: alphaFrameCount > 0 ? framesAlpha : undefined,
    };
}

function getNpcSpawnGroups(
    npcModelLoader: NpcModelLoader,
    textureLoader: TextureLoader,
    renderBuf: RenderBuffer,
    npcs: NpcSpawn[]
): NpcSpawnGroup[] {
    const idNpcSpawnsMap: Map<number, NpcSpawn[]> = new Map();

    for (const spawn of npcs) {
        const spawns = idNpcSpawnsMap.get(spawn.id);
        if (spawns) {
            spawns.push(spawn);
        } else {
            idNpcSpawnsMap.set(spawn.id, [spawn]);
        }
    }

    const groups: NpcSpawnGroup[] = [];
    for (const spawns of idNpcSpawnsMap.values()) {
        const def = npcModelLoader.npcLoader.getDefinition(spawns[0].id);

        const idleAnim = getNpcAnimationFrames(
            npcModelLoader,
            textureLoader,
            renderBuf,
            def,
            def.idleSequence
        );
        const walkAnim =
            def.idleSequence !== def.walkSequence
                ? getNpcAnimationFrames(
                      npcModelLoader,
                      textureLoader,
                      renderBuf,
                      def,
                      def.walkSequence
                  )
                : idleAnim;

        if (idleAnim) {
            // console.log(def, def.transform(npcModelLoader.varpManager, npcModelLoader.npcLoader), idleAnim);
            groups.push({
                idleAnim,
                walkAnim,
                npcSpawns: spawns,
            });
        }
    }
    return groups;
}

function getModelGroupId(
    lowDetail: boolean,
    alpha: boolean,
    plane: number,
    priority: number
): number {
    return (
        (lowDetail ? 1 : 0) |
        ((alpha ? 1 : 0) << 1) |
        (plane << 2) |
        (priority << 4)
    );
}

type ModelGroup = {
    merge: boolean;
    lowDetail: boolean;
    alpha: boolean;
    plane: number;
    priority: number;
    objects: ObjectModel[];
};

function createModelGroups(
    textureProvider: TextureLoader,
    uniqueObjects: ObjectModel[][],
    minimizeDrawCalls: boolean
): ModelGroup[] {
    const groups: ModelGroup[] = [];

    const mergeGroups: Map<number, ModelGroup> = new Map();

    for (const uniqObject of uniqueObjects) {
        const model = uniqObject[0].model;

        const alpha = model.hasAlpha(textureProvider);

        const totalFaceCount = model.faceCount * uniqObject.length;

        let merge =
            uniqObject.length == 1 || totalFaceCount < 100 || minimizeDrawCalls;

        // merge = false;
        // merge = true;

        // in the future we can sort alpha objects every frame
        if (alpha && !minimizeDrawCalls && 0) {
            for (const object of uniqObject) {
                groups.push({
                    merge: true,
                    lowDetail: false,
                    alpha,
                    plane: object.plane,
                    priority: object.priority,
                    objects: [object],
                });
            }
        } else if (merge) {
            for (const object of uniqObject) {
                const lowDetail = !alpha && object.lowDetail;

                const groupId = getModelGroupId(
                    lowDetail,
                    alpha,
                    object.plane,
                    object.priority
                );

                let group = mergeGroups.get(groupId);
                if (group === undefined) {
                    group = {
                        merge,
                        lowDetail,
                        alpha,
                        plane: object.plane,
                        priority: object.priority,
                        objects: [],
                    };
                    mergeGroups.set(groupId, group);
                }
                group.objects.push(object);
            }
        } else {
            if (alpha) {
                groups.push({
                    merge,
                    lowDetail: false,
                    alpha: true,
                    plane: 0,
                    priority: 1,
                    objects: uniqObject,
                });
                groups.push({
                    merge,
                    lowDetail: false,
                    alpha: false,
                    plane: 0,
                    priority: 1,
                    objects: uniqObject,
                });
            } else {
                groups.push({
                    merge,
                    lowDetail: false,
                    alpha,
                    plane: 0,
                    priority: 1,
                    objects: uniqObject.filter((obj) => !obj.lowDetail),
                });
                groups.push({
                    merge,
                    lowDetail: true,
                    alpha,
                    plane: 0,
                    priority: 1,
                    objects: uniqObject.filter((obj) => obj.lowDetail),
                });
            }
        }
    }

    groups.push(...mergeGroups.values());

    for (const group of mergeGroups.values()) {
        if (group.alpha) {
            groups.push({
                merge: true,
                lowDetail: false,
                alpha: false,
                plane: group.plane,
                priority: group.priority,
                objects: group.objects,
            });
        }
    }

    return groups;
}

function addModelGroup(
    textureProvider: TextureLoader,
    renderBuf: RenderBuffer,
    modelGroup: ModelGroup
) {
    const indexByteOffset = renderBuf.indexByteOffset();

    for (const object of modelGroup.objects) {
        const model = object.model;

        let faces = getModelFaces(textureProvider, model);

        // faces = faces.filter(face => face.alpha === 0xFF && face.textureId === -1);

        faces = faces.filter(
            (face) =>
                (face.alpha !== 0xff ||
                    textureProvider.hasAlpha(face.textureId)) ===
                modelGroup.alpha
        );

        if (faces.length === 0) {
            continue;
        }

        const modelIndexByteOffset = renderBuf.indexByteOffset();
        if (modelGroup.merge) {
            const offset: vec3 = [
                object.sceneX,
                object.sceneHeight,
                object.sceneY,
            ];
            addModel(renderBuf, model, faces, offset);

            const modelVertexCount =
                (renderBuf.indexByteOffset() - modelIndexByteOffset) / 4;

            let commands = renderBuf.drawCommandsInteract;
            if (modelGroup.alpha) {
                commands = renderBuf.drawCommandsInteractAlpha;
            } else if (modelGroup.lowDetail) {
                commands = renderBuf.drawCommandsInteractLowDetail;
            }

            commands.push({
                offset: modelIndexByteOffset,
                elements: modelVertexCount,
                datas: [
                    {
                        sceneX: 0,
                        sceneY: 0,
                        plane: modelGroup.plane,
                        contourGround: ContourGroundType.NONE,
                        priority: modelGroup.priority,
                        id: object.id,
                    },
                ],
            });
        } else {
            addModel(renderBuf, model, faces);
            break;
        }
    }

    const groupVertexCount =
        (renderBuf.indexByteOffset() - indexByteOffset) / 4;

    if (groupVertexCount > 0) {
        let datas: DrawData[];
        if (modelGroup.merge) {
            datas = [
                {
                    sceneX: 0,
                    sceneY: 0,
                    plane: modelGroup.plane,
                    contourGround: ContourGroundType.NONE,
                    priority: modelGroup.priority,
                    id: 0xffff,
                },
            ];
        } else {
            datas = modelGroup.objects;
        }

        let commands = renderBuf.drawCommands;
        if (modelGroup.alpha) {
            commands = renderBuf.drawCommandsAlpha;
        } else if (modelGroup.lowDetail) {
            commands = renderBuf.drawCommandsLowDetail;
        }

        commands.push({
            offset: indexByteOffset,
            elements: groupVertexCount,
            datas,
        });

        if (!modelGroup.merge) {
            let commandsInteract = renderBuf.drawCommandsInteract;
            if (modelGroup.alpha) {
                commandsInteract = renderBuf.drawCommandsInteractAlpha;
            } else if (modelGroup.lowDetail) {
                commandsInteract = renderBuf.drawCommandsInteractLowDetail;
            }

            commandsInteract.push({
                offset: indexByteOffset,
                elements: groupVertexCount,
                datas,
            });
        }
    }
}

export class ChunkDataLoader {
    cacheInfo: CacheInfo;

    regionLoader: RegionLoader;

    objectModelLoader: ObjectModelLoader;

    npcModelLoader: NpcModelLoader;

    textureProvider: TextureLoader;

    modelHashBuf: ModelHashBuffer;

    npcSpawns: NpcSpawn[];

    constructor(
        cacheInfo: CacheInfo,
        regionLoader: RegionLoader,
        objectModelLoader: ObjectModelLoader,
        npcModelLoader: NpcModelLoader,
        textureProvider: TextureLoader,
        npcList: NpcSpawn[]
    ) {
        this.cacheInfo = cacheInfo;
        this.regionLoader = regionLoader;
        this.objectModelLoader = objectModelLoader;
        this.npcModelLoader = npcModelLoader;
        this.textureProvider = textureProvider;
        this.npcSpawns = npcList;
        this.modelHashBuf = new ModelHashBuffer(5000);
    }

    load(
        regionX: number,
        regionY: number,
        minimizeDrawCalls: boolean,
        loadNpcs: boolean,
        maxPlane: number
    ): ChunkData | undefined {
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
        region.addTileModels(this.regionLoader, this.textureProvider);

        region.setTileMinPlanes();

        const renderBuf = new RenderBuffer(100000);

        const terrainVertexCount = addTerrain(renderBuf, region, maxPlane);

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
            // const occlusionMap = new OcclusionMap();

            const { objectModels, animatedObjects } = getSceneObjects(
                region,
                occlusionMap,
                maxPlane
            );

            const uniqueObjects = getUniqueObjects(
                this.modelHashBuf,
                objectModels
            );

            animatedObjectGroups = getAnimatedObjectGroups(
                this.regionLoader,
                this.objectModelLoader,
                this.textureProvider,
                renderBuf,
                animatedObjects
            );
            npcSpawnGroups = getNpcSpawnGroups(
                this.npcModelLoader,
                this.textureProvider,
                renderBuf,
                npcSpawns
            );

            const modelGroups = createModelGroups(
                this.textureProvider,
                uniqueObjects,
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
                addModelGroup(this.textureProvider, renderBuf, modelGroup);
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

        const animatedModels: AnimatedModelData[] = [];

        for (const group of animatedObjectGroups) {
            for (const data of group.objects) {
                const drawRangeIndex = drawCommands.length;
                drawCommands.push({
                    offset: 0,
                    elements: 0,
                    datas: [data],
                });

                const drawRangeAlphaIndex = drawCommandsAlpha.length;
                if (group.framesAlpha) {
                    drawCommandsAlpha.push({
                        offset: 0,
                        elements: 0,
                        datas: [data],
                    });
                }

                const drawRangeInteractIndex = drawCommandsInteract.length;
                drawCommandsInteract.push({
                    offset: 0,
                    elements: 0,
                    datas: [data],
                });

                const drawRangeInteractAlphaIndex =
                    drawCommandsInteractAlpha.length;
                if (group.framesAlpha) {
                    drawCommandsInteractAlpha.push({
                        offset: 0,
                        elements: 0,
                        datas: [data],
                    });
                }

                animatedModels.push({
                    drawRangeIndex,
                    drawRangeAlphaIndex,

                    drawRangeInteractIndex: drawRangeInteractIndex,
                    drawRangeInteractAlphaIndex: drawRangeInteractAlphaIndex,

                    animationId: group.animationId,
                    randomStart: data.animatedObject.randomStartFrame,
                    frames: group.frames,
                    framesAlpha: group.framesAlpha,
                });
            }
        }

        const npcs: NpcData[] = [];
        for (const group of npcSpawnGroups) {
            for (const spawn of group.npcSpawns) {
                const tileX = spawn.x % 64;
                const tileY = spawn.y % 64;
                const plane = spawn.p;
                npcs.push({
                    id: spawn.id,
                    tileX,
                    tileY,
                    plane,
                    idleAnim: group.idleAnim,
                    walkAnim: group.walkAnim,
                });
            }
        }

        // Normal (merged)
        const drawRanges: MultiDrawCommand[] = drawCommands.map((cmd) =>
            newMultiDrawCommand(cmd.offset, cmd.elements, cmd.datas.length)
        );
        const drawRangesLowDetail = drawRanges.slice(
            renderBuf.drawCommandsLowDetail.length
        );
        const drawRangesAlpha: MultiDrawCommand[] = drawCommandsAlpha.map(
            (cmd) =>
                newMultiDrawCommand(cmd.offset, cmd.elements, cmd.datas.length)
        );

        // Interact (non merged)
        const drawRangesInteract: MultiDrawCommand[] = drawCommandsInteract.map(
            (cmd) =>
                newMultiDrawCommand(cmd.offset, cmd.elements, cmd.datas.length)
        );
        const drawRangesInteractLowDetail = drawRangesInteract.slice(
            renderBuf.drawCommandsInteractLowDetail.length
        );
        const drawRangesInteractAlpha: MultiDrawCommand[] =
            drawCommandsInteractAlpha.map((cmd) =>
                newMultiDrawCommand(cmd.offset, cmd.elements, cmd.datas.length)
            );

        const drawRangesNpc: MultiDrawCommand[] = npcs.map((_npc) =>
            newMultiDrawCommand(0, 0, 1)
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

        return {
            regionX,
            regionY,

            vertices: renderBuf.vertexBuf.byteArray(),
            indices: new Int32Array(renderBuf.indices),

            modelTextureData,
            modelTextureDataAlpha,

            modelTextureDataInteract: modelTextureDataInteract,
            modelTextureDataInteractAlpha: modelTextureDataInteractAlpha,

            heightMapTextureData,

            drawRanges,
            drawRangesLowDetail,

            drawRangesInteract: drawRangesInteract,
            drawRangesInteractLowDetail: drawRangesInteractLowDetail,

            drawRangesAlpha,
            drawRangesInteractAlpha: drawRangesInteractAlpha,

            drawRangesNpc,

            animatedObjects: animatedModels,

            npcs,

            tileRenderFlags: region.tileRenderFlags,
            collisionFlags: region.collisionMaps.map((map) => map.flags),

            loadNpcs,
            maxPlane,
            cacheInfo: this.cacheInfo,
        };
    }
}

function createModelTextureData(drawCommands: DrawCommand[]): Uint16Array {
    const datas: DrawData[] = [];
    for (const cmd of drawCommands) {
        datas.push(...cmd.datas);
    }
    const dataCount = datas.length;

    const dataLength =
        Math.ceil((drawCommands.length * 4 + dataCount) / 16) * 16;
    const textureData = new Uint16Array(Math.max(dataLength, 16) * 4);
    let dataOffset = 0;
    drawCommands.forEach((cmd, index) => {
        textureData[index * 4] = drawCommands.length + dataOffset;

        dataOffset += cmd.datas.length;
    });

    datas.forEach((data, index) => {
        let offset = drawCommands.length * 4 + index * 4;

        const contourGround = data.contourGround;

        textureData[offset++] = data.sceneX;
        textureData[offset++] = data.sceneY;
        textureData[offset++] =
            data.plane | (contourGround << 4) | (data.priority << 8);
        textureData[offset++] = data.id;
    });

    return textureData;
}

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
