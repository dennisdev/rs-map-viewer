import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition } from "./Definition";

export class VarcIntDefinition extends Definition {
    persist: boolean;

    constructor(id: number) {
        super(id);
        this.persist = false;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 2) {
            this.persist = true;
        }
    }
}
