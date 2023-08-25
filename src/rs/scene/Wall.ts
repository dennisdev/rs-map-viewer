import { SceneLoc } from "./SceneLoc";
import { Entity } from "./entity/Entity";
import { EntityTag } from "./entity/EntityTag";

export class Wall implements SceneLoc {
    constructor(
        readonly tag: EntityTag,
        readonly flags: number,
        readonly x: number,
        readonly y: number,
        readonly height: number,
        public entity0: Entity | undefined,
        public entity1: Entity | undefined,
    ) {}
}
