import { ByteBuffer } from "../util/ByteBuffer";
import { Compression, CompressionType } from "../util/Compression";
import { Xtea } from "../util/Xtea";

export class Container {
    public static decode(buffer: ByteBuffer, key: number[] = []): Container {
        if (buffer.remaining === 0) {
            throw new Error("Empty container");
        }
        const compression: CompressionType = buffer.readUnsignedByte();
        const size = buffer.readInt();
        if (key.length) {
            Xtea.decrypt(buffer, buffer.offset, buffer.offset + 4 + size, key);
        }
        switch (compression) {
            case CompressionType.None:
                return new Container(compression, buffer.readBytes(size));
            case CompressionType.Bzip2:
            case CompressionType.Gzip:
                const actualSize = buffer.readInt() & 0xffffffff;

                let data = buffer.readUnsignedBytes(size);

                let decompressed;

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
        private readonly _data: Int8Array
    ) {}

    get data(): Int8Array {
        return this._data;
    }
}
