import { ByteBuffer } from "../util/ByteBuffer";

export class Sector {
    public static readonly HEADER_SIZE = 8;

    public static readonly DATA_SIZE = 512;

    public static readonly EXTENDED_HEADER_SIZE = 10;

    public static readonly EXTENDED_DATA_SIZE = 510;

    public static readonly SIZE = Sector.HEADER_SIZE + Sector.DATA_SIZE;

    public static decode(buffer: ByteBuffer): Sector {
        const archiveId = buffer.readUnsignedShort();
        const chunk = buffer.readUnsignedShort();
        const nextSector = buffer.readMedium();
        const indexId = buffer.readUnsignedByte();
        const data = buffer.readBytes(Sector.DATA_SIZE);
        return new Sector(indexId, archiveId, chunk, nextSector, data);
    }

    public static decodeExtended(buffer: ByteBuffer): Sector {
        const archiveId = buffer.readInt();
        const chunk = buffer.readUnsignedShort();
        const nextSector = buffer.readMedium();
        const indexId = buffer.readUnsignedByte();
        const data = buffer.readBytes(Sector.EXTENDED_DATA_SIZE);
        return new Sector(indexId, archiveId, chunk, nextSector, data);
    }

    constructor(
        public readonly indexId: number,
        public readonly archiveId: number,
        public readonly chunk: number,
        public readonly nextSector: number,
        private readonly _data: Int8Array
    ) {
    }

    get data(): Int8Array {
        return this._data;
    }
}
