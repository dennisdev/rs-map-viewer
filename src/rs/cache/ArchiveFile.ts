import { ByteBuffer } from "../io/ByteBuffer";

export class ArchiveFile {
    constructor(
        readonly id: number,
        readonly archiveId: number,
        readonly data: Int8Array,
    ) {}

    getDataAsBuffer(): ByteBuffer {
        return new ByteBuffer(this.data);
    }
}
