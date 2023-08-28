import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { SeqTransformType } from "./SeqTransformType";
import { SkeletalBase } from "../skeletal/SkeletalBase";

export class SeqBase {
    constructor(
        readonly id: number,
        readonly count: number,
        readonly types: SeqTransformType[],
        readonly transformActor: boolean[],
        readonly masks: Uint16Array,
        readonly labels: number[][],
        readonly skeletalBase?: SkeletalBase,
    ) {}
}

export class DatSeqBase {
    static load(buf: ByteBuffer): SeqBase {
        const count = buf.readUnsignedByte();
        const types: SeqTransformType[] = new Array(count);
        const transformActor: boolean[] = new Array(count).fill(true);
        const masks = new Uint16Array(count).fill(-1);
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

        return new SeqBase(-1, count, types, transformActor, masks, labels);
    }
}

export class Dat2SeqBase {
    static load(cacheInfo: CacheInfo, id: number, data: Int8Array): SeqBase {
        const buf = new ByteBuffer(data);
        const count = buf.readUnsignedByte();
        const types: SeqTransformType[] = new Array(count);
        const transformActor: boolean[] = new Array(count).fill(false);
        const masks = new Uint16Array(count);
        const labels: number[][] = new Array(count);

        for (let i = 0; i < count; i++) {
            types[i] = buf.readUnsignedByte();
            if (types[i] === SeqTransformType.TYPE_6) {
                types[i] = SeqTransformType.ROTATE;
            }
        }

        if (cacheInfo.game === "runescape" && cacheInfo.revision >= 481) {
            for (let i = 0; i < count; i++) {
                transformActor[i] = buf.readUnsignedByte() === 1;
            }
        } else {
            transformActor.fill(true);
        }

        if (cacheInfo.game === "runescape" && cacheInfo.revision >= 530) {
            for (let i = 0; i < count; i++) {
                masks[i] = buf.readUnsignedShort();
            }
        } else {
            masks.fill(-1);
        }

        for (let i = 0; i < count; i++) {
            labels[i] = new Array(buf.readUnsignedByte());
        }

        for (let i = 0; i < count; i++) {
            for (let l = 0; l < labels[i].length; l++) {
                labels[i][l] = buf.readUnsignedByte();
            }
        }

        let skeletalBase: SkeletalBase | undefined;
        if (buf.remaining > 0) {
            const boneCount = buf.readUnsignedShort();
            if (boneCount > 0) {
                skeletalBase = new SkeletalBase(buf, boneCount);
            }
        }
        return new SeqBase(id, count, types, transformActor, masks, labels, skeletalBase);
    }
}
