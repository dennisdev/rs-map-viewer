import { ByteBuffer } from "../../io/ByteBuffer";
import { ParamsMap, Type } from "../Type";

export class MapElementType extends Type {
    spriteId: number = -1;
    hoverSpriteId: number = -1;

    name?: string;

    textColor: number = 0;
    hoverTextColor: number = 0;

    textSize: number = 0;

    worldMapVisible: boolean = true;
    minimapVisible: boolean = false;

    randomizePosition: boolean = true;

    ops: (string | undefined)[] = new Array(5);

    params?: ParamsMap;

    decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.spriteId = buffer.readBigSmart();
        } else if (opcode === 2) {
            this.hoverSpriteId = buffer.readBigSmart();
        } else if (opcode === 3) {
            this.name = buffer.readString();
        } else if (opcode === 4) {
            this.textColor = buffer.readMedium();
        } else if (opcode === 5) {
            this.hoverTextColor = buffer.readMedium();
        } else if (opcode === 6) {
            this.textSize = buffer.readUnsignedByte();
        } else if (opcode === 7) {
            const flags = buffer.readUnsignedByte();
            if ((flags & 0x1) === 0) {
                this.worldMapVisible = false;
            }
            if ((flags & 0x2) === 2) {
                this.minimapVisible = true;
            }
        } else if (opcode === 8) {
            this.randomizePosition = buffer.readUnsignedByte() === 1;
        } else if (opcode === 9) {
            let primaryVisibleVarbit = buffer.readUnsignedShort();
            if (primaryVisibleVarbit == 65535) {
                primaryVisibleVarbit = -1;
            }
            let primaryVisibleVarp = buffer.readUnsignedShort();
            if (primaryVisibleVarp == 65535) {
                primaryVisibleVarp = -1;
            }
            const primaryMinValue = buffer.readInt();
            const primaryMaxValue = buffer.readInt();
        } else if (opcode >= 10 && opcode <= 14) {
            this.ops[opcode - 10] = buffer.readString();
        } else if (opcode === 15) {
            if (
                this.cacheInfo.game === "oldschool" ||
                (this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 629)
            ) {
                const count = buffer.readUnsignedByte();
                for (let i = 0; i < count * 2; i++) {
                    buffer.readShort();
                }

                buffer.readInt();

                const count2 = buffer.readUnsignedByte();
                for (let i = 0; i < count2; i++) {
                    buffer.readInt();
                }

                for (let i = 0; i < count; i++) {
                    buffer.readByte();
                }
            } else {
                const count = buffer.readUnsignedByte();
                for (let i = 0; i < count * 2; i++) {
                    buffer.readShort();
                }

                buffer.readInt();
                buffer.readInt();
            }
        } else if (opcode === 16) {
            const bool = false;
        } else if (opcode === 17) {
            const opBase = buffer.readString();
        } else if (opcode === 18) {
            buffer.readBigSmart();
        } else if (opcode === 19) {
            const group = buffer.readUnsignedShort();
        } else if (opcode === 20) {
            let secondaryVisibleVarbit = buffer.readUnsignedShort();
            if (secondaryVisibleVarbit == 65535) {
                secondaryVisibleVarbit = -1;
            }
            let secondaryVisibleVarp = buffer.readUnsignedShort();
            if (secondaryVisibleVarp == 65535) {
                secondaryVisibleVarp = -1;
            }
            const secondaryMinValue = buffer.readInt();
            const secondaryMaxValue = buffer.readInt();
        } else if (opcode === 21) {
            buffer.readInt();
        } else if (opcode === 22) {
            buffer.readInt();
        } else if (opcode === 23) {
            buffer.readUnsignedByte();
            buffer.readUnsignedByte();
            buffer.readUnsignedByte();
        } else if (opcode === 24) {
            buffer.readShort();
            buffer.readShort();
        } else if (opcode === 25) {
            buffer.readBigSmart();
        } else if (opcode === 28) {
            buffer.readUnsignedByte();
        } else if (opcode === 29) {
            const hAlign = buffer.readUnsignedByte();
        } else if (opcode === 30) {
            const vAlign = buffer.readUnsignedByte();
        } else if (opcode === 249) {
            const params = Type.readParamsMap(buffer);
        } else {
            throw new Error("MapElementType: Unrecognized opcode: " + opcode);
        }
    }
}
