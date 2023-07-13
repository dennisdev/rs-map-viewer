import { ByteBuffer } from "../../util/ByteBuffer";
import { CacheInfo } from "../Types";
import { Definition } from "./Definition";

export class ParamDefinition extends Definition {
    private static JAGEX_CHARS = [
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

    type!: string;

    defaultInt!: number;

    defaultString!: string;

    // isMembers?
    autoDisable: boolean;

    public static getJagexChar(c: number): string {
        if (c === 0) {
            throw new Error("Invalid char: " + c);
        } else {
            if (c >= 128 && c < 160) {
                let s = ParamDefinition.JAGEX_CHARS[c - 128];
                if (s === "\u0000") {
                    s = "?";
                }

                return s;
            }

            return String.fromCharCode(c);
        }
    }

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.autoDisable = true;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 1) {
            this.type = ParamDefinition.getJagexChar(buffer.readUnsignedByte());
        } else if (opcode == 2) {
            this.defaultInt = buffer.readInt();
        } else if (opcode == 4) {
            this.autoDisable = false;
        } else if (opcode == 5) {
            this.defaultString = buffer.readString();
        }
    }

    isString(): boolean {
        return this.type === "s";
    }
}
