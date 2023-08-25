import { ByteBuffer } from "../../io/ByteBuffer";
import { Type } from "../Type";

export class MapSceneType extends Type {
    spriteId: number = -1;
    colorRgb: number = 0;
    enlarge: boolean = false;

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.spriteId = buffer.readUnsignedShort();
        } else if (opcode === 2) {
            this.colorRgb = buffer.readMedium();
        } else if (opcode === 3) {
            this.enlarge = true;
        } else if (opcode === 4) {
            this.spriteId = -1;
        }
    }
}
