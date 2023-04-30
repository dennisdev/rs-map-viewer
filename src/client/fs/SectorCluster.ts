import { ByteBuffer } from "../util/ByteBuffer";

export class SectorCluster {
    public static readonly SIZE = 6;

    public static decode(buffer: ByteBuffer): SectorCluster {
        const size = buffer.readMedium();
        const sector = buffer.readMedium();
        return new SectorCluster(size, sector);
    }

    constructor(public readonly size: number, public readonly sector: number) {}
}
