import { ByteBuffer } from "../../../io/ByteBuffer";
import { Type } from "../../Type";

export class VarClientIntType extends Type {
    persist: boolean = false;

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 2) {
            this.persist = true;
        }
    }
}
