import { CacheInfo } from "../cache/CacheInfo";
import { CacheType, detectCacheType } from "../cache/CacheType";
import { ByteBuffer } from "../io/ByteBuffer";

export type ParamsMap = Map<number, number | string>;

export abstract class Type {
    readonly id: number;

    readonly cacheInfo: CacheInfo;

    readonly cacheType: CacheType;

    static readParamsMap(buf: ByteBuffer, params?: ParamsMap): ParamsMap {
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
        this.cacheType = detectCacheType(cacheInfo);
    }

    readString(buffer: ByteBuffer): string {
        const stopValue = this.cacheType !== "dat2" ? 0xa : 0;
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
