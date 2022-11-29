import { ByteBuffer } from "../util/ByteBuffer";

export class Skeleton {
    id: number;

    count: number;

    types: number[];

    labels: number[][];

    constructor(id: number, data: Int8Array) {
        this.id = id;
        const buf = new ByteBuffer(data);
        this.count = buf.readUnsignedByte();
        this.types = new Array(this.count);
        this.labels = new Array(this.count);

        for (let i = 0; i < this.count; i++) {
            this.types[i] = buf.readUnsignedByte();
        }

        for (let i = 0; i < this.count; i++) {
            this.labels[i] = new Array(buf.readUnsignedByte());
        }

        for (let i = 0; i < this.count; i++) {
            for (let l = 0; l < this.labels[i].length; l++) {
                this.labels[i][l] = buf.readUnsignedByte();
            }
        }

        if (buf.remaining > 0) {
            // new animation system
            // console.log('skeleton: ', id, 'has new anim')
        }
    }
}
