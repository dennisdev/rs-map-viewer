import { LocModelType } from "../../config/loctype/LocModelType";
import { Entity } from "./Entity";

export class LocEntity extends Entity {
    constructor(
        readonly id: number,
        readonly type: LocModelType,
        readonly rotation: number,
        readonly level: number,
        readonly tileX: number,
        readonly tileY: number,
        readonly seqId: number,
        readonly seqRandomStart: boolean,
    ) {
        super();
    }
}
