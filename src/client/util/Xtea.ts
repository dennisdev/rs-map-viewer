import { ByteBuffer } from "./ByteBuffer";

export class Xtea {
    public static readonly GOLDEN_RATIO = 0x9E3779B9;

    public static readonly ROUNDS = 32;

    public static readonly INITIAL_SUM = Math.imul(this.GOLDEN_RATIO, this.ROUNDS);

    public static decrypt(buf: ByteBuffer, start: number, end: number, key: number[]): void {
        if (key.length !== 4) {
            throw new Error('Xtea: key is not 128 bits');
        }

        const n = Math.floor((end - start) / 8);
        for (let i = 0; i < n; i++) {
            const offset = start + i * 8;
            // console.log('offset', offset);
            let sum = Xtea.INITIAL_SUM;
            let v0 = buf.getInt(offset);
            let v1 = buf.getInt(offset + 4);
            for (let j = 0; j < Xtea.ROUNDS; j++) {
                v1 -= (((v0 << 4) ^ (v0 >>> 5)) + v0) ^ (sum + key[(sum >>> 11) & 3]);
                sum -= Xtea.GOLDEN_RATIO;
                v0 -= (((v1 << 4) ^ (v1 >>> 5)) + v1) ^ (sum + key[sum & 3]);
            }
            buf.setInt(offset, v0);
            buf.setInt(offset + 4, v1);
        }
    }
}
