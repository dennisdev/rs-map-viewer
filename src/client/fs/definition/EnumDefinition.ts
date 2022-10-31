import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition } from "./Definition";

export class EnumDefinition extends Definition {
    inputType!: string;

    outputType!: string;

    defaultString: string;

    defaultInt!: number;

    outputCount: number;

    keys!: number[];

    intValues!: number[];

    stringValues!: string[];

    constructor(id: number) {
        super(id);
        this.defaultString = "null";
        this.outputCount = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 1) {
            this.inputType = String.fromCharCode(buffer.readUnsignedByte());
        } else if (opcode == 2) {
            this.outputType = String.fromCharCode(buffer.readUnsignedByte());
        } else if (opcode == 3) {
            this.defaultString = buffer.readString();
        } else if (opcode == 4) {
            this.defaultInt = buffer.readInt();
        } else if (opcode == 5) {
            this.outputCount = buffer.readUnsignedShort();
            this.keys = new Array(this.outputCount);
            this.stringValues = new Array(this.outputCount);

            for (let i = 0; i < this.outputCount; i++) {
                this.keys[i] = buffer.readInt();
                this.stringValues[i] = buffer.readString();
            }
        } else if (opcode == 6) {
            this.outputCount = buffer.readUnsignedShort();
            this.keys = new Array(this.outputCount);
            this.intValues = new Array(this.outputCount);

            for (let i = 0; i < this.outputCount; i++) {
                this.keys[i] = buffer.readInt();
                this.intValues[i] = buffer.readInt();
            }
        }

    }
}
