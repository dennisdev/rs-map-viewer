import { ByteBuffer } from "../util/ByteBuffer";

export class ArchiveFile {
    constructor(
        public readonly id: number,
        public readonly archiveId: number,
        public readonly data: Int8Array
    ) {}

    // get data(): Int8Array {
    //     return this._data;
    // }

    getDataAsBuffer(): ByteBuffer {
        return new ByteBuffer(this.data);
    }
}
