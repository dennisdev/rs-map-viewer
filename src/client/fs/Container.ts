import { ByteBuffer } from "../util/ByteBuffer";
import { Compression, CompressionType } from "../util/Compression";
import { Xtea } from "../util/Xtea";

export class Container {
    public static decode(buffer: ByteBuffer, key?: number[]): Container {
        if (buffer.remaining === 0) {
            throw new Error("Empty container");
        }
        const compression: CompressionType = buffer.readUnsignedByte();
        const size = buffer.readInt();
        if (
            key &&
            key.length === 4 &&
            (key[0] !== 0 || key[1] !== 0 || key[2] !== 0 || key[3] !== 0)
        ) {
            Xtea.decrypt(buffer, buffer.offset, buffer.offset + 4 + size, key);
        }
        switch (compression) {
            case CompressionType.None:
                return new Container(compression, buffer.readBytes(size));
            case CompressionType.Bzip2:
            case CompressionType.Gzip:
                const actualSize = buffer.readInt() & 0xffffffff;

                const data = buffer.readUnsignedBytes(size);

                let decompressed: Int8Array;

                if (compression === CompressionType.Bzip2) {
                    decompressed = Compression.decompressBzip2(
                        data,
                        actualSize
                    );
                } else {
                    decompressed = Compression.decompressGzip(data);
                }

                if (decompressed.length !== actualSize) {
                    throw new Error("Container: Size mismatch");
                }
                return new Container(compression, decompressed);
            default:
                throw new Error(
                    "Container: Unsupported compression: " + compression
                );
        }
    }

    constructor(
        public readonly compression: CompressionType,
        public readonly data: Int8Array
    ) {}
}
