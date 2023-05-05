import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition, ParamsMap } from "./Definition";

export class StructDefinition extends Definition {
    params!: ParamsMap;

    constructor(id: number, revision: number) {
        super(id, revision);
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 249) {
            this.params = Definition.readParamsMap(buffer, this.params);
        }
    }
}
