import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class CurveOperation extends TextureOperation {
    interpMode: number = 0;

    markers!: number[][];

    startMarker!: number[];
    endMarker!: number[];

    table: Int16Array = new Int16Array(257);

    constructor() {
        super(1, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.interpMode = buffer.readUnsignedByte();
            const markerCount = buffer.readUnsignedByte();
            this.markers = new Array(markerCount);
            for (let i = 0; i < markerCount; i++) {
                const marker = (this.markers[i] = new Array(2));
                marker[0] = buffer.readUnsignedShort();
                marker[1] = buffer.readUnsignedShort();
            }
        }
    }

    calcExtremes(): void {
        const start0 = this.markers[0];
        const start1 = this.markers[1];
        const end0 = this.markers[this.markers.length - 2];
        const end1 = this.markers[this.markers.length - 1];
        this.startMarker = [start0[0] + start0[0] - start1[0], start0[1] - start1[1] + start0[1]];
        this.endMarker = [end0[0] - end1[0] + end0[0], end0[1] - end1[1] + end0[1]];
    }

    getMarker(index: number): number[] {
        if (index < 0) {
            return this.startMarker;
        }
        if (index >= this.markers.length) {
            return this.endMarker;
        }
        return this.markers[index];
    }

    override init() {
        if (!this.markers) {
            this.markers = [
                [0, 0],
                [4096, 4096],
            ];
        }
        if (this.markers.length < 2) {
            throw new Error("Curve operation requires at least two markers");
        }
        if (this.interpMode === 2) {
            this.calcExtremes();
        }
        this.fillTable();
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache not initialized");
        }

        const output = this.monochromeImageCache.get(line);
        if (this.monochromeImageCache.dirty) {
            const input = this.getMonochromeInput(textureGenerator, 0, line);
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                let value = (input[pixel] / 16) | 0;
                if (value < 0) {
                    value = 0;
                }
                if (value > 256) {
                    value = 256;
                }
                output[pixel] = this.table[value];
            }
        }

        return output;
    }

    fillTable(): void {
        switch (this.interpMode) {
            case 2:
                for (let index = 0; index < 257; index++) {
                    const indexTimes16 = index * 16;
                    let markIndex: number;
                    for (markIndex = 1; markIndex < this.markers.length - 1; markIndex++) {
                        if (this.markers[markIndex][0] > indexTimes16) {
                            break;
                        }
                    }
                    const markP = this.markers[markIndex - 1];
                    const markN = this.markers[markIndex];
                    const i_17_ = this.getMarker(markIndex - 2)[1];
                    const i_18_ = markP[1];
                    const i_19_ = markN[1];
                    const i_20_ = this.getMarker(markIndex + 1)[1];
                    const interpIn =
                        (((indexTimes16 - markP[0]) * 4096) / (markN[0] - markP[0])) | 0;
                    const xSq = ((interpIn * interpIn) / 4096) | 0;
                    const i_23_ = i_18_ - i_17_ + (i_20_ - i_19_);
                    const i_24_ = i_17_ - i_18_ - i_23_;
                    const i_25_ = i_19_ - i_17_;
                    const i_26_ = i_18_;
                    const i_27_ = (xSq * ((interpIn * i_23_) >> 12)) >> 12;
                    const i_28_ = ((xSq * i_24_) / 4096) | 0;
                    const i_29_ = ((interpIn * i_25_) / 4096) | 0;
                    let out = i_29_ + i_27_ + i_28_ + i_26_;
                    if (out <= -32768) {
                        out = -32767;
                    }
                    if (out >= 32768) {
                        out = 32767;
                    }
                    this.table[index] = out;
                }
                break;
            case 1: // COSINE INTERPOLATION
                for (let index = 0; index < 257; index++) {
                    const indexTimes16 = index * 16;
                    let markIndex: number;
                    for (markIndex = 1; markIndex < this.markers.length - 1; markIndex++) {
                        if (this.markers[markIndex][0] > indexTimes16) {
                            break;
                        }
                    }
                    const markP = this.markers[markIndex - 1];
                    const markN = this.markers[markIndex];
                    const interpIn =
                        (((indexTimes16 - markP[0]) * 4096) / (markN[0] - markP[0])) | 0;
                    const nMul =
                        ((4096 - TextureGenerator.COSINE[((interpIn & 8187) / 32) | 0]) / 2) | 0;
                    const pMul = 4096 - nMul;
                    let out = ((pMul * markP[1] + markN[1] * nMul) / 4096) | 0;
                    if (out <= -32768) {
                        out = -32767;
                    }
                    if (out >= 32768) {
                        out = 32767;
                    }
                    this.table[index] = out;
                }
                break;
            case 0: // LINEAR INTERPOLATION
                for (let index = 0; index < 257; index++) {
                    const indexTimes16 = index * 16;
                    let markIndex: number;
                    for (markIndex = 1; markIndex < this.markers.length - 1; markIndex++) {
                        if (this.markers[markIndex][0] > indexTimes16) {
                            break;
                        }
                    }
                    const markP = this.markers[markIndex - 1];
                    const markN = this.markers[markIndex];
                    const nMul = (((indexTimes16 - markP[0]) * 4096) / (markN[0] - markP[0])) | 0;
                    const pMul = 4096 - nMul;
                    let out = ((pMul * markP[1] + markN[1] * nMul) / 4096) | 0;
                    if (out <= -32768) {
                        out = -32767;
                    }
                    if (out >= 32768) {
                        out = 32767;
                    }
                    this.table[index] = out;
                }
                break;
        }
    }
}
