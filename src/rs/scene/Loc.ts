import { SceneLoc } from "./SceneLoc";
import { Entity } from "./entity/Entity";
import { EntityTag } from "./entity/EntityTag";

export class Loc implements SceneLoc {
    constructor(
        readonly tag: EntityTag,
        readonly flags: number,
        public level: number,
        readonly x: number,
        readonly y: number,
        readonly height: number,
        public entity: Entity,
        readonly rotation: number,
        readonly startX: number,
        readonly startY: number,
        readonly endX: number,
        readonly endY: number,
    ) {}
}
