import { ByteBuffer } from "../../io/ByteBuffer";
import { Type } from "../Type";

export class ParamType extends Type {
    private static SCRIPT_VAR_TYPES = [
        "€",
        "\u0000",
        "‚",
        "ƒ",
        "„",
        "…",
        "†",
        "‡",
        "ˆ",
        "‰",
        "Š",
        "‹",
        "Œ",
        "\u0000",
        "Ž",
        "\u0000",
        "\u0000",
        "‘",
        "’",
        "“",
        "”",
        "•",
        "–",
        "—",
        "˜",
        "™",
        "š",
        "›",
        "œ",
        "\u0000",
        "ž",
        "Ÿ",
    ];

    // ScriptVarType
    type!: string;

    defaultInt: number = 0;

    defaultString!: string;

    autoDisable: boolean = true;

    static getJagexChar(c: number): string {
        if (c === 0) {
            throw new Error("Invalid char: " + c);
        } else {
            if (c >= 128 && c < 160) {
                let s = ParamType.SCRIPT_VAR_TYPES[c - 128];
                if (s === "\u0000") {
                    s = "?";
                }

                return s;
            }

            return String.fromCharCode(c);
        }
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.type = ParamType.getJagexChar(buffer.readUnsignedByte());
        } else if (opcode === 2) {
            this.defaultInt = buffer.readInt();
        } else if (opcode === 4) {
            this.autoDisable = false;
        } else if (opcode === 5) {
            this.defaultString = buffer.readString();
        }
    }

    isString(): boolean {
        return this.type === "s";
    }
}
