import { DataBuffer } from "./DataBuffer";

type AnimInfo = {
    // 8 bits unsigned
    frameCount: number,
    // 8 bits unsigned
    frameStep: number,
    // 1 bit
    repeat: boolean,
    // 16 bits unsigned
    totalLength: number,
    // 16 bits unsigned
    frameLengthOffset: number
}

export class AnimInfoBuffer extends DataBuffer {
    public static readonly STRIDE: number = 8;

    frameLengths: number[];

    constructor(count: number) {
        super(AnimInfoBuffer.STRIDE, count);
        this.frameLengths = [];
    }

    addAnim(frameStep: number, frameLengths: number[]): number {
        const animTotalLength = frameLengths.reduce((a, b) => a + b, 0);

        const animInfo: AnimInfo = {
            frameCount: frameLengths.length,
            frameStep: frameStep,
            repeat: frameStep > 0,
            totalLength: animTotalLength,
            frameLengthOffset: this.frameLengths.length
        };

        this.frameLengths.push(...frameLengths);

        return this.addAnimInfo(animInfo);
    }

    addAnimInfo(info: AnimInfo): number {
        this.ensureSize(1);

        const byteOffset = this.byteOffset();

        const frameStep = info.repeat ? info.frameStep : info.frameCount;

        this.view.setUint8(byteOffset, info.frameCount);
        this.view.setUint8(byteOffset + 1, frameStep);
        this.view.setUint8(byteOffset + 2, info.repeat ? 1 : 0);

        this.view.setUint16(byteOffset + 4, info.totalLength, true);
        this.view.setUint16(byteOffset + 6, info.frameLengthOffset, true);

        return this.offset++;
    }
}
