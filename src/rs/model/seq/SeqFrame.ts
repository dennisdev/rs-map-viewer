import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { DatSeqBase, SeqBase } from "./SeqBase";
import { SeqBaseLoader } from "./SeqBaseLoader";
import { SeqTransformType } from "./SeqTransformType";

export class SeqFrame {
    static transformGroupCache: Int32Array = new Int32Array(500);
    static transformXCache: Int32Array = new Int32Array(500);
    static transformYCache: Int32Array = new Int32Array(500);
    static transformZCache: Int32Array = new Int32Array(500);
    static resetOriginGroupsCache: Int32Array = new Int32Array(500);

    constructor(
        readonly frameLength: number,
        readonly base: SeqBase,
        readonly transformCount: number,
        readonly transformGroups: number[],
        readonly transformX: number[],
        readonly transformY: number[],
        readonly transformZ: number[],
        readonly resetOriginGroups: number[],
        readonly hasAlphaTransform: boolean,
        readonly hasColorTransform: boolean = false,
    ) {}
}

export class DatSeqFrame {
    static load(frames: Map<number, SeqFrame>, data: Int8Array): void {
        const footerBuffer = new ByteBuffer(data);

        footerBuffer.offset = data.length - 8;
        const frameMapOffset = footerBuffer.readUnsignedShort();
        const flagOffset = footerBuffer.readUnsignedShort();
        const transformOffset = footerBuffer.readUnsignedShort();
        const frameLengthOffset = footerBuffer.readUnsignedShort();
        let totalOffset = 0;

        const frameMapBuffer = new ByteBuffer(data);
        frameMapBuffer.offset = totalOffset;
        totalOffset += frameMapOffset + 2;

        const flagBuffer = new ByteBuffer(data);
        flagBuffer.offset = totalOffset;
        totalOffset += flagOffset;

        const transformBuffer = new ByteBuffer(data);
        transformBuffer.offset = totalOffset;
        totalOffset += transformOffset;

        const frameLengthBuffer = new ByteBuffer(data);
        frameLengthBuffer.offset = totalOffset;
        totalOffset += frameLengthOffset;

        const baseBuffer = new ByteBuffer(data);
        baseBuffer.offset = totalOffset;

        const base = DatSeqBase.load(baseBuffer);

        const frameCount = frameMapBuffer.readUnsignedShort();
        for (let f = 0; f < frameCount; f++) {
            const frameId = frameMapBuffer.readUnsignedShort();
            const frameLength = frameLengthBuffer.readUnsignedByte();
            const count = frameMapBuffer.readUnsignedByte();

            let transformCount = 0;
            let resetOriginGroup = -1;
            let lastResetOriginGroup = -1;

            let hasAlphaTransform = false;

            for (let i = 0; i < count; i++) {
                const type = base.types[i];

                if (type === SeqTransformType.ORIGIN) {
                    resetOriginGroup = i;
                }

                const flag = flagBuffer.readUnsignedByte();
                if (flag === 0) {
                    continue;
                }

                if (type === SeqTransformType.ORIGIN) {
                    lastResetOriginGroup = i;
                }

                SeqFrame.transformGroupCache[transformCount] = i;

                let defaultValue = 0;
                if (type === SeqTransformType.SCALE) {
                    defaultValue = 128;
                }

                if ((flag & 0x1) !== 0) {
                    SeqFrame.transformXCache[transformCount] = transformBuffer.readSmart2();
                } else {
                    SeqFrame.transformXCache[transformCount] = defaultValue;
                }

                if ((flag & 0x2) !== 0) {
                    SeqFrame.transformYCache[transformCount] = transformBuffer.readSmart2();
                } else {
                    SeqFrame.transformYCache[transformCount] = defaultValue;
                }

                if ((flag & 0x4) !== 0) {
                    SeqFrame.transformZCache[transformCount] = transformBuffer.readSmart2();
                } else {
                    SeqFrame.transformZCache[transformCount] = defaultValue;
                }

                SeqFrame.resetOriginGroupsCache[transformCount] = -1;
                if (
                    type === SeqTransformType.TRANSLATE ||
                    type === SeqTransformType.ROTATE ||
                    type === SeqTransformType.SCALE
                ) {
                    if (resetOriginGroup > lastResetOriginGroup) {
                        SeqFrame.resetOriginGroupsCache[transformCount] = resetOriginGroup;
                        lastResetOriginGroup = resetOriginGroup;
                    }
                } else if (type === SeqTransformType.ALPHA) {
                    hasAlphaTransform = true;
                }
                transformCount++;
            }

            const transformGroups: number[] = new Array(transformCount);
            const transformX: number[] = new Array(transformCount);
            const transformY: number[] = new Array(transformCount);
            const transformZ: number[] = new Array(transformCount);
            const resetOriginGroups: number[] = new Array(transformCount);
            for (let i = 0; i < transformCount; i++) {
                transformGroups[i] = SeqFrame.transformGroupCache[i];
                transformX[i] = SeqFrame.transformXCache[i];
                transformY[i] = SeqFrame.transformYCache[i];
                transformZ[i] = SeqFrame.transformZCache[i];
                resetOriginGroups[i] = SeqFrame.resetOriginGroupsCache[i];
            }

            frames.set(
                frameId,
                new SeqFrame(
                    frameLength,
                    base,
                    transformCount,
                    transformGroups,
                    transformX,
                    transformY,
                    transformZ,
                    resetOriginGroups,
                    hasAlphaTransform,
                ),
            );
        }
    }
}

export class Dat2SeqFrame {
    static load(cacheInfo: CacheInfo, baseLoader: SeqBaseLoader, data: Int8Array): SeqFrame {
        const buf = new ByteBuffer(data);
        const dataBuf = new ByteBuffer(data);

        if (cacheInfo.game === "runescape" && cacheInfo.revision >= 610) {
            buf.readUnsignedByte();
        }

        const baseId = buf.readUnsignedShort();

        const base = baseLoader.load(baseId);
        if (!base) {
            throw new Error("Invalid frame base id: " + baseId);
        }

        const count = buf.readUnsignedByte();

        dataBuf.offset = buf.offset + count;

        let transformCount = 0;
        let resetOriginGroup = -1;
        let lastResetOriginGroup = -1;

        let hasAlphaTransform = false;
        let hasColorTransform = false;

        for (let i = 0; i < count; i++) {
            const type = base.types[i];

            if (type === SeqTransformType.ORIGIN) {
                resetOriginGroup = i;
            }

            const flag = buf.readUnsignedByte();
            if (flag === 0) {
                continue;
            }

            if (type === SeqTransformType.ORIGIN) {
                lastResetOriginGroup = i;
            }

            SeqFrame.transformGroupCache[transformCount] = i;

            let defaultValue = 0;
            if (type === SeqTransformType.SCALE || type === SeqTransformType.TYPE_10) {
                defaultValue = 128;
            }

            if ((flag & 0x1) !== 0) {
                SeqFrame.transformXCache[transformCount] = dataBuf.readSmart2();
            } else {
                SeqFrame.transformXCache[transformCount] = defaultValue;
            }

            if ((flag & 0x2) !== 0) {
                SeqFrame.transformYCache[transformCount] = dataBuf.readSmart2();
            } else {
                SeqFrame.transformYCache[transformCount] = defaultValue;
            }

            if ((flag & 0x4) !== 0) {
                SeqFrame.transformZCache[transformCount] = dataBuf.readSmart2();
            } else {
                SeqFrame.transformZCache[transformCount] = defaultValue;
            }

            if (cacheInfo.game === "runescape" && cacheInfo.revision >= 610) {
                if (type === SeqTransformType.ORIGIN || type === SeqTransformType.TRANSLATE) {
                    SeqFrame.transformXCache[transformCount] >>= 2;
                    SeqFrame.transformYCache[transformCount] >>= 2;
                    SeqFrame.transformZCache[transformCount] >>= 2;
                } else if (type === SeqTransformType.ROTATE) {
                    SeqFrame.transformXCache[transformCount] >>= 4;
                    SeqFrame.transformYCache[transformCount] >>= 4;
                    SeqFrame.transformZCache[transformCount] >>= 4;
                } else if (type === SeqTransformType.SCALE) {
                    // SeqFrame.transformXCache[transformCount] >>= 1;
                    // SeqFrame.transformYCache[transformCount] >>= 1;
                    // SeqFrame.transformZCache[transformCount] >>= 1;
                }
            }

            SeqFrame.resetOriginGroupsCache[transformCount] = -1;
            if (
                type === SeqTransformType.TRANSLATE ||
                type === SeqTransformType.ROTATE ||
                type === SeqTransformType.SCALE
            ) {
                if (resetOriginGroup > lastResetOriginGroup) {
                    SeqFrame.resetOriginGroupsCache[transformCount] = resetOriginGroup;
                    lastResetOriginGroup = resetOriginGroup;
                }
            } else if (type === SeqTransformType.ALPHA) {
                hasAlphaTransform = true;
            } else if (type === SeqTransformType.LIGHT) {
                hasColorTransform = true;
            }
            transformCount++;
        }

        if (count !== 0 && dataBuf.offset !== data.length) {
            throw new Error(
                "SeqFrame: Mismatched buffer offset: " +
                    data.length +
                    ", " +
                    dataBuf.offset +
                    ", " +
                    count +
                    ", " +
                    baseId,
            );
        }

        const transformGroups: number[] = new Array(transformCount);
        const transformX: number[] = new Array(transformCount);
        const transformY: number[] = new Array(transformCount);
        const transformZ: number[] = new Array(transformCount);
        const resetOriginGroups: number[] = new Array(transformCount);
        for (let i = 0; i < transformCount; i++) {
            transformGroups[i] = SeqFrame.transformGroupCache[i];
            transformX[i] = SeqFrame.transformXCache[i];
            transformY[i] = SeqFrame.transformYCache[i];
            transformZ[i] = SeqFrame.transformZCache[i];
            resetOriginGroups[i] = SeqFrame.resetOriginGroupsCache[i];
        }

        return new SeqFrame(
            0,
            base,
            transformCount,
            transformGroups,
            transformX,
            transformY,
            transformZ,
            resetOriginGroups,
            hasAlphaTransform,
            hasColorTransform,
        );
    }
}
