import { ByteBuffer } from "../../io/ByteBuffer";
import { ParamsMap, Type } from "../Type";

export class StructType extends Type {
    params!: ParamsMap;

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 249) {
            this.params = Type.readParamsMap(buffer, this.params);
        }
    }
}
