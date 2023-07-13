import { ByteBuffer } from "../../util/ByteBuffer";
import { CacheInfo, CacheType, getCacheType } from "../Types";

export type ParamsMap = Map<number, number | string>;

export abstract class Definition {
    public readonly id: number;

    public readonly cacheInfo: CacheInfo;

    public static readParamsMap(
        buf: ByteBuffer,
        params?: ParamsMap
    ): ParamsMap {
        const count = buf.readUnsignedByte();
        if (!params) {
            params = new Map<number, number | string>();
        }

        for (let i = 0; i < count; i++) {
            const isStringValue = buf.readUnsignedByte() === 1;
            const key = buf.readMedium();
            if (isStringValue) {
                params.set(key, buf.readString());
            } else {
                params.set(key, buf.readInt());
            }
        }
        return params;
    }

    constructor(id: number, cacheInfo: CacheInfo) {
        this.id = id;
        this.cacheInfo = cacheInfo;
    }

    readString(buffer: ByteBuffer): string {
        const stopValue =
            getCacheType(this.cacheInfo) === CacheType.DAT ? 0xa : 0;
        return buffer.readString(stopValue);
    }

    decode(buffer: ByteBuffer): void {
        while (true) {
            if (buffer.offset > buffer.length - 1) {
                throw new Error("Buffer overflow");
            }
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
