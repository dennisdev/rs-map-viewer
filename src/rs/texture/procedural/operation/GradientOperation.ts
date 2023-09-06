import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class GradientOperation extends TextureOperation {
    preset: number = 0;

    gradient?: Int32Array[];

    table: Int32Array = new Int32Array(257);

    constructor() {
        super(1, false);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            const preset = buffer.readUnsignedByte();
            if (preset === 0) {
                const count = buffer.readUnsignedByte();
                this.gradient = new Array(count);
                for (let i = 0; i < count; i++) {
                    this.gradient[i] = new Int32Array(4);
                    this.gradient[i][0] = buffer.readUnsignedShort();
                    this.gradient[i][1] = buffer.readUnsignedByte() << 4;
                    this.gradient[i][2] = buffer.readUnsignedByte() << 4;
                    this.gradient[i][3] = buffer.readUnsignedByte() << 4;
                }
            } else {
                this.setGradientPreset(preset);
            }
        }
    }

    override init() {
        if (!this.gradient) {
            this.setGradientPreset(1);
        }
        this.fillTable();
    }

    override getColourOutput(textureGenerator: TextureGenerator, line: number): Int32Array[] {
        if (!this.colourImageCache) {
            throw new Error("Colour image cache is not initialized");
        }
        const output = this.colourImageCache.get(line);
        if (this.colourImageCache.dirty) {
            const input = this.getMonochromeInput(textureGenerator, 0, line);
            const outputR = output[0];
            const outputG = output[1];
            const outputB = output[2];
            for (let pixel = 0; pixel < textureGenerator.width; pixel++) {
                let value = input[pixel] >> 4;
                if (value < 0) {
                    value = 0;
                }
                if (value > 256) {
                    value = 256;
                }
                value = this.table[value];
                outputR[pixel] = (value & 0xff0000) >> 12;
                outputG[pixel] = (value & 0xff00) >> 4;
                outputB[pixel] = (value & 0xff) << 4;
            }
        }
        return output;
    }

    fillTable(): void {
        if (!this.gradient) {
            return;
        }

        const gradientCount = this.gradient.length;
        if (gradientCount <= 0) {
            return;
        }
        for (let i = 0; i < this.table.length; i++) {
            let gIdx = 0;
            const inT16 = i << 4;
            for (const grad of this.gradient) {
                if (grad[0] > inT16) {
                    break;
                }
                gIdx++;
            }
            let r: number;
            let g: number;
            let b: number;
            if (gIdx < gradientCount) {
                const gradN = this.gradient[gIdx];
                if (gIdx > 0) {
                    const gradP = this.gradient[gIdx - 1];
                    const nMod = (((inT16 - gradP[0]) << 12) / (gradN[0] - gradP[0])) | 0;
                    const pMod = 4096 - nMod;
                    r = (gradP[1] * pMod + gradN[1] * nMod) >> 12;
                    g = (gradP[2] * pMod + gradN[2] * nMod) >> 12;
                    b = (gradN[3] * nMod + gradP[3] * pMod) >> 12;
                } else {
                    r = gradN[1];
                    g = gradN[2];
                    b = gradN[3];
                }
            } else {
                const grad = this.gradient[gradientCount - 1];
                r = grad[1];
                g = grad[2];
                b = grad[3];
            }
            r >>= 4;
            g >>= 4;
            b >>= 4;
            if (r < 0) {
                r = 0;
            } else if (r > 255) {
                r = 255;
            }
            if (g < 0) {
                g = 0;
            } else if (g > 255) {
                g = 255;
            }
            if (b < 0) {
                b = 0;
            } else if (b > 255) {
                b = 255;
            }
            this.table[i] = (r << 16) | (g << 8) | b;
        }
    }

    setGradientPreset(preset: number) {
        this.preset = preset;
        switch (preset) {
            case 1:
                this.gradient = new Array(2);
                for (let i = 0; i < this.gradient.length; i++) {
                    this.gradient[i] = new Int32Array(4);
                }
                this.gradient[0][0] = 0;
                this.gradient[0][1] = 0;
                this.gradient[0][2] = 0;
                this.gradient[0][3] = 0;

                this.gradient[1][0] = 4096;
                this.gradient[1][1] = 4096;
                this.gradient[1][2] = 4096;
                this.gradient[1][3] = 4096;
                break;
            case 2:
                this.gradient = new Array(8);
                for (let i = 0; i < this.gradient.length; i++) {
                    this.gradient[i] = new Int32Array(4);
                }
                this.gradient[0][0] = 0;
                this.gradient[0][1] = 2650;
                this.gradient[0][2] = 2602;
                this.gradient[0][3] = 2361;

                this.gradient[1][0] = 2867;
                this.gradient[1][1] = 2313;
                this.gradient[1][2] = 1799;
                this.gradient[1][3] = 1558;

                this.gradient[2][0] = 3072;
                this.gradient[2][1] = 2618;
                this.gradient[2][2] = 1734;
                this.gradient[2][3] = 1413;

                this.gradient[3][0] = 3276;
                this.gradient[3][1] = 2296;
                this.gradient[3][2] = 1220;
                this.gradient[3][3] = 947;

                this.gradient[4][0] = 3481;
                this.gradient[4][1] = 2072;
                this.gradient[4][2] = 963;
                this.gradient[4][3] = 722;

                this.gradient[5][0] = 3686;
                this.gradient[5][1] = 2730;
                this.gradient[5][2] = 2152;
                this.gradient[5][3] = 1766;

                this.gradient[6][0] = 3891;
                this.gradient[6][1] = 2232;
                this.gradient[6][2] = 1060;
                this.gradient[6][3] = 915;

                this.gradient[7][0] = 4096;
                this.gradient[7][1] = 1686;
                this.gradient[7][2] = 1413;
                this.gradient[7][3] = 1140;
                break;
            case 3:
                this.gradient = new Array(7);
                for (let i = 0; i < this.gradient.length; i++) {
                    this.gradient[i] = new Int32Array(4);
                }

                this.gradient[0][1] = 0;
                this.gradient[0][2] = 0;
                this.gradient[0][0] = 0;
                this.gradient[0][3] = 4096;

                this.gradient[1][1] = 0;
                this.gradient[1][0] = 663;
                this.gradient[1][3] = 4096;
                this.gradient[1][2] = 4096;

                this.gradient[2][2] = 4096;
                this.gradient[2][1] = 0;
                this.gradient[2][0] = 1363;
                this.gradient[2][3] = 0;

                this.gradient[3][3] = 0;
                this.gradient[3][2] = 4096;
                this.gradient[3][1] = 4096;
                this.gradient[3][0] = 2048;

                this.gradient[4][3] = 0;
                this.gradient[4][0] = 2727;
                this.gradient[4][2] = 0;
                this.gradient[4][1] = 4096;

                this.gradient[5][1] = 4096;
                this.gradient[5][0] = 3411;
                this.gradient[5][2] = 0;
                this.gradient[5][3] = 4096;

                this.gradient[6][3] = 4096;
                this.gradient[6][2] = 0;
                this.gradient[6][1] = 0;
                this.gradient[6][0] = 4096;
                break;

            case 4:
                this.gradient = new Array(6);
                for (let i = 0; i < this.gradient.length; i++) {
                    this.gradient[i] = new Int32Array(4);
                }
                this.gradient[0][3] = 0;
                this.gradient[0][1] = 0;
                this.gradient[0][0] = 0;
                this.gradient[0][2] = 0;

                this.gradient[1][0] = 1843;
                this.gradient[1][3] = 1493;
                this.gradient[1][2] = 0;
                this.gradient[1][1] = 0;

                this.gradient[2][3] = 2939;
                this.gradient[2][0] = 2457;
                this.gradient[2][1] = 0;
                this.gradient[2][2] = 0;

                this.gradient[3][3] = 3565;
                this.gradient[3][0] = 2781;
                this.gradient[3][1] = 0;
                this.gradient[3][2] = 1124;

                this.gradient[4][3] = 4031;
                this.gradient[4][1] = 546;
                this.gradient[4][0] = 3481;
                this.gradient[4][2] = 3084;

                this.gradient[5][0] = 4096;
                this.gradient[5][2] = 4096;
                this.gradient[5][1] = 4096;
                this.gradient[5][3] = 4096;
                break;
            case 5:
                this.gradient = new Array(16);
                for (let i = 0; i < this.gradient.length; i++) {
                    this.gradient[i] = new Int32Array(4);
                }
                this.gradient[0][2] = 192;
                this.gradient[0][0] = 0;
                this.gradient[0][1] = 80;
                this.gradient[0][3] = 321;

                this.gradient[1][1] = 321;
                this.gradient[1][0] = 155;
                this.gradient[1][3] = 562;
                this.gradient[1][2] = 449;

                this.gradient[2][1] = 578;
                this.gradient[2][0] = 389;
                this.gradient[2][3] = 803;
                this.gradient[2][2] = 690;

                this.gradient[3][2] = 995;
                this.gradient[3][0] = 671;
                this.gradient[3][3] = 1140;
                this.gradient[3][1] = 947;

                this.gradient[4][2] = 1397;
                this.gradient[4][1] = 1285;
                this.gradient[4][0] = 897;
                this.gradient[4][3] = 1509;

                this.gradient[5][2] = 1429;
                this.gradient[5][0] = 1175;
                this.gradient[5][3] = 1413;
                this.gradient[5][1] = 1525;

                this.gradient[6][3] = 1333;
                this.gradient[6][0] = 1368;
                this.gradient[6][1] = 1734;
                this.gradient[6][2] = 1461;

                this.gradient[7][0] = 1507;
                this.gradient[7][1] = 1413;
                this.gradient[7][3] = 1702;
                this.gradient[7][2] = 1525;

                this.gradient[8][1] = 1108;
                this.gradient[8][2] = 1590;
                this.gradient[8][3] = 2056;
                this.gradient[8][0] = 1736;

                this.gradient[9][1] = 1766;
                this.gradient[9][0] = 2088;
                this.gradient[9][3] = 2666;
                this.gradient[9][2] = 2056;

                this.gradient[10][2] = 2586;
                this.gradient[10][0] = 2355;
                this.gradient[10][1] = 2409;
                this.gradient[10][3] = 3276;

                this.gradient[11][1] = 3116;
                this.gradient[11][3] = 3228;
                this.gradient[11][2] = 3148;
                this.gradient[11][0] = 2691;

                this.gradient[12][2] = 3710;
                this.gradient[12][1] = 3806;
                this.gradient[12][3] = 3196;
                this.gradient[12][0] = 3031;

                this.gradient[13][1] = 3437;
                this.gradient[13][2] = 3421;
                this.gradient[13][3] = 3019;
                this.gradient[13][0] = 3522;

                this.gradient[14][1] = 3116;
                this.gradient[14][0] = 3727;
                this.gradient[14][2] = 3148;
                this.gradient[14][3] = 3228;

                this.gradient[15][1] = 2377;
                this.gradient[15][2] = 2505;
                this.gradient[15][3] = 2746;
                this.gradient[15][0] = 4096;
                break;

            case 6:
                this.gradient = new Array(4);
                for (let i = 0; i < this.gradient.length; i++) {
                    this.gradient[i] = new Int32Array(4);
                }
                this.gradient[0][3] = 0;
                this.gradient[0][2] = 4096;
                this.gradient[0][0] = 2048;
                this.gradient[0][1] = 0;

                this.gradient[1][2] = 4096;
                this.gradient[1][1] = 4096;
                this.gradient[1][3] = 0;
                this.gradient[1][0] = 2867;

                this.gradient[2][1] = 4096;
                this.gradient[2][2] = 4096;
                this.gradient[2][3] = 0;
                this.gradient[2][0] = 3276;

                this.gradient[3][2] = 0;
                this.gradient[3][0] = 4096;
                this.gradient[3][3] = 0;
                this.gradient[3][1] = 4096;
                break;
            default:
                throw new Error(`Invalid gradient preset: ${preset}`);
        }
    }
}
