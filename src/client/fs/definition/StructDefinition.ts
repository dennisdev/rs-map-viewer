import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition, ParamsMap } from "./Definition";

export class StructDefinition extends Definition {
    params!: ParamsMap;

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 249) {
            this.params = Definition.readParamsMap(buffer, this.params);
        }
    }
}
