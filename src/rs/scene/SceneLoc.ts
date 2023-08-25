import { EntityTag } from "./entity/EntityTag";

export interface SceneLoc {
    tag: EntityTag;
    flags: number;
    x: number;
    y: number;
    height: number;
}
