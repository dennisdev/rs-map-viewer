import { SceneLoc } from "./SceneLoc";
import { Entity } from "./entity/Entity";
import { EntityTag } from "./entity/EntityTag";

export class FloorDecoration implements SceneLoc {
    constructor(
        public entity: Entity,
        readonly x: number,
        readonly y: number,
        readonly height: number,
        readonly tag: EntityTag,
        readonly flags: number,
    ) {}
}
