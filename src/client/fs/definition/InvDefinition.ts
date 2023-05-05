import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition } from "./Definition";

export class InvDefinition extends Definition {
    itemCount: number;

    constructor(id: number, revision: number) {
        super(id, revision);
        this.itemCount = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 2) {
            this.itemCount = buffer.readUnsignedShort();
        }
    }
}
