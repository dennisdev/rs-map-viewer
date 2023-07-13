import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition } from "./Definition";

export class VarbitDefinition extends Definition {
    baseVar!: number;

    startBit!: number;

    endBit!: number;

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.baseVar = buffer.readUnsignedShort();
            this.startBit = buffer.readUnsignedByte();
            this.endBit = buffer.readUnsignedByte();
        } else {
            throw new Error(
                "VarbitDefinition: Opcode " +
                    opcode +
                    " not implemented. id: " +
                    this.id
            );
        }
    }
}
