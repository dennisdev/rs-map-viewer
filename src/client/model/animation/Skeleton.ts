import { ByteBuffer } from "../../util/ByteBuffer";
import { TransformType } from "./TransformType";

export class Skeleton {
    id: number;

    count: number;

    types: TransformType[];

    labels: number[][];

    static loadDat(id: number, buf: ByteBuffer): Skeleton {
        const count = buf.readUnsignedByte();
        const types: TransformType[] = new Array(count);
        const labels: number[][] = new Array(count);

        for (let i = 0; i < count; i++) {
            types[i] = buf.readUnsignedByte();
        }

        for (let i = 0; i < count; i++) {
            const subCount = buf.readUnsignedByte();
            labels[i] = new Array(subCount);
            for (let l = 0; l < subCount; l++) {
                labels[i][l] = buf.readUnsignedByte();
            }
        }

        return new Skeleton(id, count, types, labels);
    }

    static loadDat2(id: number, data: Int8Array): Skeleton {
        const buf = new ByteBuffer(data);
        const count = buf.readUnsignedByte();
        const types: TransformType[] = new Array(count);
        const labels: number[][] = new Array(count);

        for (let i = 0; i < count; i++) {
            types[i] = buf.readUnsignedByte();
        }

        for (let i = 0; i < count; i++) {
            labels[i] = new Array(buf.readUnsignedByte());
        }

        for (let i = 0; i < count; i++) {
            for (let l = 0; l < labels[i].length; l++) {
                labels[i][l] = buf.readUnsignedByte();
            }
        }

        if (buf.remaining > 0) {
            // new animation system
            // console.log('skeleton: ', id, 'has new anim')
        }
        return new Skeleton(id, count, types, labels);
    }

    constructor(
        id: number,
        count: number,
        types: TransformType[],
        labels: number[][]
    ) {
        this.id = id;
        this.count = count;
        this.types = types;
        this.labels = labels;
    }
}
