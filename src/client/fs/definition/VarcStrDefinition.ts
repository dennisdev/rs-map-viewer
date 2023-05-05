import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition } from "./Definition";

export class VarcStrDefinition extends Definition {
    persist: boolean;

    constructor(id: number, revision: number) {
        super(id, revision);
        this.persist = false;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 2) {
            this.persist = true;
        }
    }
}
