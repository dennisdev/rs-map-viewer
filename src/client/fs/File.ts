import { ByteBuffer } from "../util/ByteBuffer";

export class File {
    constructor(
        public readonly id: number,
        public readonly archiveId: number,
        private readonly _data: Int8Array
    ) {
    }

    get data(): Int8Array {
        return this._data;
    }

    getDataAsBuffer(): ByteBuffer {
        return new ByteBuffer(this._data);
    }
}
