import { ByteBuffer } from "../../../io/ByteBuffer";
import { Type } from "../../Type";

export class VarBitType extends Type {
    baseVar!: number;

    startBit!: number;
    endBit!: number;

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.baseVar = buffer.readUnsignedShort();
            this.startBit = buffer.readUnsignedByte();
            this.endBit = buffer.readUnsignedByte();
        } else {
            throw new Error("VarBitType: Opcode " + opcode + " not implemented. id: " + this.id);
        }
    }
}
