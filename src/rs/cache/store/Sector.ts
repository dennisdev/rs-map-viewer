import { ByteBuffer } from "../../io/ByteBuffer";

export class Sector {
    static readonly HEADER_SIZE = 8;

    static readonly DATA_SIZE = 512;

    static readonly EXTENDED_HEADER_SIZE = 10;

    static readonly EXTENDED_DATA_SIZE = 510;

    static readonly SIZE = Sector.HEADER_SIZE + Sector.DATA_SIZE;

    indexId!: number;
    archiveId!: number;
    chunk!: number;
    nextSector!: number;
    data!: Int8Array;

    static decodeNew(buffer: ByteBuffer): Sector {
        return Sector.decode(new Sector(), buffer);
    }

    static decodeExtendedNew(buffer: ByteBuffer): Sector {
        return Sector.decodeExtended(new Sector(), buffer);
    }

    static decode(sector: Sector, buffer: ByteBuffer, dataSize = Sector.DATA_SIZE): Sector {
        sector.archiveId = buffer.readUnsignedShort();
        sector.chunk = buffer.readUnsignedShort();
        sector.nextSector = buffer.readMedium();
        sector.indexId = buffer.readUnsignedByte();
        sector.data = buffer.readBytes(dataSize);
        return sector;
    }

    static decodeExtended(
        sector: Sector,
        buffer: ByteBuffer,
        dataSize = Sector.EXTENDED_DATA_SIZE,
    ): Sector {
        sector.archiveId = buffer.readInt();
        sector.chunk = buffer.readUnsignedShort();
        sector.nextSector = buffer.readMedium();
        sector.indexId = buffer.readUnsignedByte();
        sector.data = buffer.readBytes(dataSize);
        return sector;
    }
}
