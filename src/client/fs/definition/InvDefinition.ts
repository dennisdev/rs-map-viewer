import { ByteBuffer } from "../../util/ByteBuffer";
import { CacheInfo } from "../Types";
import { Definition } from "./Definition";

export class InvDefinition extends Definition {
    itemCount: number;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.itemCount = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 2) {
            this.itemCount = buffer.readUnsignedShort();
        }
    }
}
