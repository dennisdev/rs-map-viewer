import { ByteBuffer } from "../../util/ByteBuffer";

export type ParamsMap = Map<number, number | string>;

export abstract class Definition {
    public readonly id: number;

    public static readParamsMap(
        buf: ByteBuffer,
        params?: ParamsMap
    ): ParamsMap {
        const count = buf.readUnsignedByte();
        if (!params) {
            params = new Map<number, number | string>();
        }

        for (let i = 0; i < count; i++) {
            const isStringValue = buf.readUnsignedByte() == 1;
            const key = buf.readMedium();
            if (isStringValue) {
                params.set(key, buf.readString());
            } else {
                params.set(key, buf.readInt());
            }
        }
        return params;
    }

    constructor(id: number) {
        this.id = id;
    }

    decode(buffer: ByteBuffer): void {
        while (true) {
            const opcode = buffer.readUnsignedByte();
            if (opcode === 0) {
                break;
            }
            this.decodeOpcode(opcode, buffer);
        }
    }

    abstract decodeOpcode(opcode: number, buffer: ByteBuffer): void;

    post(): void {}
}
