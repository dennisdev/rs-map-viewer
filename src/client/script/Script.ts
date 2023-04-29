import { ByteBuffer } from "../util/ByteBuffer";

export class Script {
    id: number;

    name?: string;

    opcodes!: Uint16Array;

    intOperands!: Int32Array;

    stringOperands!: string[];

    intLocalCount!: number;

    stringLocalCount!: number;

    intArgumentCount!: number;

    stringArgumentCount!: number;

    jumpTables!: Map<number, number>[];

    constructor(id: number) {
        this.id = id;
    }

    decode(buf: ByteBuffer): void {
        buf.offset = buf.length - 2;
        const n = buf.readUnsignedShort();
        const headerOffset = buf.length - 2 - n - 12;
        buf.offset = headerOffset;
        const opcodeCount = buf.readInt();
        this.intLocalCount = buf.readUnsignedShort();
        this.stringLocalCount = buf.readUnsignedShort();
        this.intArgumentCount = buf.readUnsignedShort();
        this.stringArgumentCount = buf.readUnsignedShort();

        const jumpTableCount = buf.readUnsignedByte();
        if (jumpTableCount > 0) {
            this.jumpTables = [];

            for (let i = 0; i < jumpTableCount; i++) {
                let jumpCount = buf.readUnsignedShort();
                const table = (this.jumpTables[i] = new Map<number, number>());

                while (jumpCount-- > 0) {
                    const from = buf.readInt();
                    const to = buf.readInt();
                    table.set(from, to);
                }
            }
        }

        buf.offset = 0;

        this.name = buf.readNullString();

        this.opcodes = new Uint16Array(opcodeCount);
        this.intOperands = new Int32Array(opcodeCount);
        this.stringOperands = new Array(opcodeCount);

        for (let i = 0; buf.offset < headerOffset; i++) {
            const opcode = (this.opcodes[i] = buf.readUnsignedShort());
            if (opcode == 3) {
                this.stringOperands[i] = buf.readString();
            } else if (
                opcode < 100 &&
                opcode != 21 &&
                opcode != 38 &&
                opcode != 39
            ) {
                this.intOperands[i] = buf.readInt();
            } else {
                this.intOperands[i] = buf.readUnsignedByte();
            }
        }
    }
}
