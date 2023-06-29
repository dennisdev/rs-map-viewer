import { vec3 } from "gl-matrix";
import { TextureLoader } from "../../client/fs/loader/TextureLoader";
import {
    ContourGroundType,
    DrawData,
    RenderBuffer,
    getModelFaces,
    isAlphaModelFace,
} from "../buffer/RenderBuffer";
import { SceneModel } from "./SceneModel";
import { InteractType } from "./InteractType";

export type ModelGroup = {
    merge: boolean;
    lowDetail: boolean;
    alpha: boolean;
    plane: number;
    priority: number;
    models: SceneModel[];
};

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

export function createModelGroups(
    textureLoader: TextureLoader,
    groupedModels: SceneModel[][],
    minimizeDrawCalls: boolean
): ModelGroup[] {
    const groups: ModelGroup[] = [];

    const mergeGroups: Map<number, ModelGroup> = new Map();

    for (const sceneModels of groupedModels) {
        const model = sceneModels[0].model;

        const alpha = model.hasAlpha(textureLoader);

        const totalFaceCount = model.faceCount * sceneModels.length;

        let merge =
            sceneModels.length === 1 ||
            totalFaceCount < 100 ||
            minimizeDrawCalls;

        // merge = false;
        // merge = true;

        if (merge) {
            for (const sceneModel of sceneModels) {
                const lowDetail = !alpha && sceneModel.lowDetail;

                const groupId = getModelGroupId(
                    lowDetail,
                    alpha,
                    sceneModel.plane,
                    sceneModel.priority
                );

                const group = mergeGroups.get(groupId);
                if (group === undefined) {
                    mergeGroups.set(groupId, {
                        merge,
                        lowDetail,
                        alpha,
                        plane: sceneModel.plane,
                        priority: sceneModel.priority,
                        models: [sceneModel],
                    });
                } else {
                    group.models.push(sceneModel);
                }
            }
        } else {
            // alpha models can't be low detail
            if (alpha) {
                // alpha group with alpha faces only
                groups.push({
                    merge,
                    lowDetail: false,
                    alpha: true,
                    plane: 0,
                    priority: 1,
                    models: sceneModels,
                });
                // opaque group without alpha faces
                groups.push({
                    merge,
                    lowDetail: false,
                    alpha: false,
                    plane: 0,
                    priority: 1,
                    models: sceneModels,
                });
            } else {
                // group of normal models
                groups.push({
                    merge,
                    lowDetail: false,
                    alpha,
                    plane: 0,
                    priority: 1,
                    models: sceneModels.filter((obj) => !obj.lowDetail),
                });
                // group of low detail models
                groups.push({
                    merge,
                    lowDetail: true,
                    alpha,
                    plane: 0,
                    priority: 1,
                    models: sceneModels.filter((obj) => obj.lowDetail),
                });
            }
        }
    }

    groups.push(...mergeGroups.values());

    // add opaque faces of alpha merge groups
    for (const group of mergeGroups.values()) {
        if (group.alpha) {
            groups.push({
                merge: true,
                lowDetail: false,
                alpha: false,
                plane: group.plane,
                priority: group.priority,
                models: group.models,
            });
        }
    }

    return groups;
}

export function addModelGroup(
    textureProvider: TextureLoader,
    renderBuf: RenderBuffer,
    modelGroup: ModelGroup
) {
    const indexByteOffset = renderBuf.indexByteOffset();

    for (const sceneModel of modelGroup.models) {
        const model = sceneModel.model;

        let faces = getModelFaces(textureProvider, model);

        faces = faces.filter(
            (face) =>
                isAlphaModelFace(textureProvider, face) === modelGroup.alpha
        );

        if (faces.length === 0) {
            continue;
        }

        const modelIndexByteOffset = renderBuf.indexByteOffset();
        if (modelGroup.merge) {
            const offset: vec3 = [
                sceneModel.sceneX,
                sceneModel.sceneHeight,
                sceneModel.sceneY,
            ];
            if (sceneModel.heightOffset !== 0) {
                offset[1] = -sceneModel.heightOffset;
            }
            renderBuf.addModel(model, faces, offset);

            const modelVertexCount =
                (renderBuf.indexByteOffset() - modelIndexByteOffset) / 4;

            let commands = renderBuf.drawCommandsInteract;
            if (modelGroup.alpha) {
                commands = renderBuf.drawCommandsInteractAlpha;
            } else if (modelGroup.lowDetail) {
                commands = renderBuf.drawCommandsInteractLowDetail;
            }

            // Add interact draw commands so we can tell what was clicked
            commands.push({
                offset: modelIndexByteOffset,
                elements: modelVertexCount,
                datas: [
                    {
                        sceneX: 0,
                        sceneY: 0,
                        heightOffset: 0,
                        plane: modelGroup.plane,
                        contourGround: ContourGroundType.NONE,
                        priority: modelGroup.priority,
                        interactType: sceneModel.interactType,
                        interactId: sceneModel.interactId,
                    },
                ],
            });
        } else {
            renderBuf.addModel(model, faces);
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
                    heightOffset: 0,
                    plane: modelGroup.plane,
                    contourGround: ContourGroundType.NONE,
                    priority: modelGroup.priority,
                    interactType: InteractType.NONE,
                    interactId: 0xffff,
                },
            ];
        } else {
            datas = modelGroup.models;
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
