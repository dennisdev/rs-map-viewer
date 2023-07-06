import { ByteBuffer } from "../../util/ByteBuffer";
import { CacheInfo } from "../CacheInfo";
import { Definition } from "./Definition";

export class VarpDefinition extends Definition {
    type: number;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.type = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 5) {
            this.type = buffer.readUnsignedShort();
        }
    }
}
