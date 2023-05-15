import { DynamicObject } from "../../client/scene/DynamicObject";
import { SceneObject } from "../../client/scene/SceneObject";
import { DrawData } from "../buffer/RenderBuffer";

export type AnimatedSceneObject = {
    animatedObject: DynamicObject;
    sceneObject: SceneObject;
} & DrawData;
