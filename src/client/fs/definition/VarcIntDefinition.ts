import { ByteBuffer } from "../../util/ByteBuffer";
import { CacheInfo } from "../CacheInfo";
import { Definition } from "./Definition";

export class VarcIntDefinition extends Definition {
    persist: boolean;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.persist = false;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 2) {
            this.persist = true;
        }
    }
}
