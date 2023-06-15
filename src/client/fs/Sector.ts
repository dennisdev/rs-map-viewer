import { ByteBuffer } from "../util/ByteBuffer";

export class Sector {
    public static readonly HEADER_SIZE = 8;

    public static readonly DATA_SIZE = 512;

    public static readonly EXTENDED_HEADER_SIZE = 10;

    public static readonly EXTENDED_DATA_SIZE = 510;

    public static readonly SIZE = Sector.HEADER_SIZE + Sector.DATA_SIZE;

    public indexId!: number;
    public archiveId!: number;
    public chunk!: number;
    public nextSector!: number;
    public data!: Int8Array;

    public static decodeNew(buffer: ByteBuffer): Sector {
        return Sector.decode(new Sector(), buffer);
    }

    public static decodeExtendedNew(buffer: ByteBuffer): Sector {
        return Sector.decodeExtended(new Sector(), buffer);
    }

    public static decode(
        sector: Sector,
        buffer: ByteBuffer,
        dataSize = Sector.DATA_SIZE
    ): Sector {
        sector.archiveId = buffer.readUnsignedShort();
        sector.chunk = buffer.readUnsignedShort();
        sector.nextSector = buffer.readMedium();
        sector.indexId = buffer.readUnsignedByte();
        sector.data = buffer.readBytes(dataSize);
        return sector;
    }

    public static decodeExtended(
        sector: Sector,
        buffer: ByteBuffer,
        dataSize = Sector.EXTENDED_DATA_SIZE
    ): Sector {
        sector.archiveId = buffer.readInt();
        sector.chunk = buffer.readUnsignedShort();
        sector.nextSector = buffer.readMedium();
        sector.indexId = buffer.readUnsignedByte();
        sector.data = buffer.readBytes(dataSize);
        return sector;
    }

    constructor() {}
}
