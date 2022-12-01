import { SkeletonLoader } from "../../fs/loader/SkeletonLoader";
import { ByteBuffer } from "../../util/ByteBuffer";
import { Skeleton } from "./Skeleton";
import { TransformType } from "./TransformType";

export class AnimationFrame {
    static transformGroupCache: Int32Array = new Int32Array(500);
    static transformXCache: Int32Array = new Int32Array(500);
    static transformYCache: Int32Array = new Int32Array(500);
    static transformZCache: Int32Array = new Int32Array(500);

    static load(data: Int8Array, skeletonLoader: SkeletonLoader): AnimationFrame {
        const buf = new ByteBuffer(data);
        const dataBuf = new ByteBuffer(data);

        const skeletonId = buf.readUnsignedShort();

        const skeleton = skeletonLoader.getSkeleton(skeletonId);
        if (!skeleton) {
            throw new Error('Invalid skeleton id: ' + skeletonId);
        }

        const length = buf.readUnsignedByte();

        dataBuf.offset = buf.offset + length;

        let lastTransformIndex = -1;
        let transformCount = 0;

        let hasAlphaTransform = false;

        for (let i = 0; i < length; i++) {
            const flag = buf.readUnsignedByte();
            if (flag === 0) {
                continue;
            }
            if (skeleton.types[i] !== 0) {
                for (let transformIndex = i - 1; transformIndex > lastTransformIndex; transformIndex--) {
                    if (skeleton.types[transformIndex] === TransformType.ORIGIN) {
                        AnimationFrame.transformGroupCache[transformCount] = transformIndex;
                        AnimationFrame.transformXCache[transformCount] = 0;
                        AnimationFrame.transformYCache[transformCount] = 0;
                        AnimationFrame.transformZCache[transformCount] = 0;
                        transformCount++;
                        break;
                    }
                }
            }

            AnimationFrame.transformGroupCache[transformCount] = i;

            let defaultValue = 0;
            if (skeleton.types[i] === TransformType.SCALE) {
                defaultValue = 128;
            }

            if ((flag & 0x1) != 0) {
                AnimationFrame.transformXCache[transformCount] = dataBuf.readSmart2();
            } else {
                AnimationFrame.transformXCache[transformCount] = defaultValue;
            }

            if ((flag & 0x2) != 0) {
                AnimationFrame.transformYCache[transformCount] = dataBuf.readSmart2();
            } else {
                AnimationFrame.transformYCache[transformCount] = defaultValue;
            }

            if ((flag & 0x4) != 0) {
                AnimationFrame.transformZCache[transformCount] = dataBuf.readSmart2();
            } else {
                AnimationFrame.transformZCache[transformCount] = defaultValue;
            }

            lastTransformIndex = i;
            transformCount++;
            if (skeleton.types[i] === TransformType.ALPHA) {
                hasAlphaTransform = true;
            }
        }

        if (length !== 0 && dataBuf.offset !== data.length) {
            throw new Error('AnimationFrame: Mismatched buffer offset: ' + data.length + ', ' + dataBuf.offset + ', ' + length + ', ' + skeletonId);
        }

        const transformGroups: number[] = new Array(transformCount);
        const transformX: number[] = new Array(transformCount);
        const transformY: number[] = new Array(transformCount);
        const transformZ: number[] = new Array(transformCount);
        for (let i = 0; i < transformCount; ++i) {
            transformGroups[i] = AnimationFrame.transformGroupCache[i];
            transformX[i] = AnimationFrame.transformXCache[i];
            transformY[i] = AnimationFrame.transformYCache[i];
            transformZ[i] = AnimationFrame.transformZCache[i];
        }

        return new AnimationFrame(skeleton, transformCount, transformGroups, transformX, transformY, transformZ, hasAlphaTransform);
    }

    constructor(
        public skeleton: Skeleton,
        public transformCount: number,
        public transformGroups: number[],
        public transformX: number[],
        public transformY: number[],
        public transformZ: number[],
        public hasAlphaTransform: boolean,
    ) {

    }
}
