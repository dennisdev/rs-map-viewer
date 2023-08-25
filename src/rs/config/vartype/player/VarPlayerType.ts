import { CacheInfo } from "../../../cache/CacheInfo";
import { ByteBuffer } from "../../../io/ByteBuffer";
import { Type } from "../../Type";

export class VarPlayerType extends Type {
    type: number;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.type = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 5) {
            this.type = buffer.readUnsignedShort();
        }
    }
}
