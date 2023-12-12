import JavaRandom from "java-random";
import { ByteBuffer } from "../../../io/ByteBuffer";
import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";
import { nextIntJagex } from "../../../../util/MathUtil";
import { ArrayUtils } from "../../../util/ArrayUtils";

export class IrregularBricksOperation extends TextureOperation {
    seed = 0;
    field1 = 1024;
    field2 = 2048;
    field3 = 409;
    field4 = 819;
    field5 = 1024;
    field6 = 0;
    field7 = 1024;
    field8 = 1024;

    anInt79 = 0;

    constructor() {
        super(0, true);
    }

    override decode(field: number, buffer: ByteBuffer): void {
        if (field === 0) {
            this.seed = buffer.readUnsignedByte();
        } else if (field === 1) {
            this.field1 = buffer.readUnsignedShort();
        } else if (field === 2) {
            this.field2 = buffer.readUnsignedShort();
        } else if (field === 3) {
            this.field3 = buffer.readUnsignedShort();
        } else if (field === 4) {
            this.field4 = buffer.readUnsignedShort();
        } else if (field === 5) {
            this.field5 = buffer.readUnsignedShort();
        } else if (field === 6) {
            this.field6 = buffer.readUnsignedByte();
        } else if (field === 7) {
            this.field7 = buffer.readUnsignedShort();
        } else if (field === 8) {
            this.field8 = buffer.readUnsignedShort();
        }
    }

    method69(
        textureGenerator: TextureGenerator,
        arg0: number,
        arg1: number,
        arg2: number,
        arg3: number,
        random: JavaRandom,
        pixels: Int32Array[],
    ) {
        const local20 = this.field8 > 0 ? 4096 - nextIntJagex(random, this.field8) : 4096;
        const local28 = (this.anInt79 * this.field7) >> 12;
        const local44 = this.anInt79 - (local28 > 0 ? nextIntJagex(random, local28) : 0);
        if (textureGenerator.width <= arg2) {
            arg2 -= textureGenerator.width;
        }
        if (local44 > 0) {
            if (arg0 <= 0 || arg1 <= 0) {
                return;
            }

            const local67 = (arg1 / 2) | 0;
            const local71 = (arg0 / 2) | 0;
            const local82 = local67 >= local44 ? local44 : local67;
            const local93 = local44 > local71 ? local71 : local44;
            const local97 = arg2 + local82;
            const local104 = arg1 - local82 * 2;

            for (let local106 = 0; local106 < arg0; local106++) {
                const local116 = pixels[local106 + arg3];
                if (local93 <= local106) {
                    const local260 = arg0 - local106 - 1;
                    if (local93 <= local260) {
                        for (let local403 = 0; local403 < local82; local403++) {
                            local116[textureGenerator.widthMask & (arg2 + local403)] = local116[
                                textureGenerator.widthMask & (arg1 + arg2 - local403 - 1)
                            ] = ((local20 * local403) / local82) | 0;
                        }
                        if (local97 + local104 <= textureGenerator.width) {
                            ArrayUtils.fill(local116, local97, local104, local20);
                        } else {
                            const local461 = textureGenerator.width - local97;
                            ArrayUtils.fill(local116, local97, local461, local20);
                            ArrayUtils.fill(local116, 0, local104 - local461, local20);
                        }
                    } else {
                        const local274 = ((local260 * local20) / local93) | 0;
                        if (this.field6 === 0) {
                            for (let local327 = 0; local327 < local82; local327++) {
                                const local336 = ((local327 * local20) / local82) | 0;
                                local116[textureGenerator.widthMask & (arg2 + local327)] = local116[
                                    (arg1 + arg2 - local327 - 1) & textureGenerator.widthMask
                                ] = (local274 * local336) >> 12;
                            }
                        } else {
                            for (let local280 = 0; local280 < local82; local280++) {
                                const local289 = ((local20 * local280) / local82) | 0;
                                local116[textureGenerator.widthMask & (local280 + arg2)] = local116[
                                    textureGenerator.widthMask & (arg2 + arg1 - local280 - 1)
                                ] = local274 > local289 ? local289 : local274;
                            }
                        }
                        if (textureGenerator.width < local104 + local97) {
                            const local379 = textureGenerator.width - local97;
                            ArrayUtils.fill(local116, local97, local379, local274);
                            ArrayUtils.fill(local116, 0, local104 - local379, local274);
                        } else {
                            ArrayUtils.fill(local116, local97, local104, local274);
                        }
                    }
                } else {
                    const local130 = ((local106 * local20) / local93) | 0;
                    if (this.field6 === 0) {
                        for (let local184 = 0; local184 < local82; local184++) {
                            const local193 = ((local20 * local184) / local82) | 0;
                            local116[textureGenerator.widthMask & (local184 + arg2)] = local116[
                                (arg2 + arg1 - local184 - 1) & textureGenerator.widthMask
                            ] = (local193 * local130) >> 12;
                        }
                    } else {
                        for (let local138 = 0; local138 < local82; local138++) {
                            const local151 = ((local20 * local138) / local82) | 0;
                            local116[(local138 + arg2) & textureGenerator.widthMask] = local116[
                                (arg1 + arg2 - local138 - 1) & textureGenerator.widthMask
                            ] = local130 <= local151 ? local130 : local151;
                        }
                    }

                    if (local97 + local104 > textureGenerator.width) {
                        const local231 = textureGenerator.width - local97;
                        ArrayUtils.fill(local116, local97, local231, local130);
                        ArrayUtils.fill(local116, 0, local104 - local231, local130);
                    } else {
                        ArrayUtils.fill(local116, local97, local104, local130);
                    }
                }
            }
        } else if (textureGenerator.width >= arg1 + arg2) {
            for (let i = 0; i < arg0; i++) {
                ArrayUtils.fill(pixels[i + arg3], arg2, arg1, local20);
            }
        } else {
            const local507 = textureGenerator.width - arg2;
            for (let i = 0; i < arg0; i++) {
                const local518 = pixels[i + arg3];
                ArrayUtils.fill(local518, arg2, local507, local20);
                ArrayUtils.fill(local518, 0, arg1 - local507, local20);
            }
        }
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        if (!this.monochromeImageCache) {
            throw new Error("Monochrome image cache is not initialized");
        }
        const output = this.monochromeImageCache.get(line);
        if (!this.monochromeImageCache.dirty) {
            return output;
        }

        let local23 = 0;
        const pixels = this.monochromeImageCache.getAll();
        let local30 = 0;
        let local32 = 0;
        let local34 = 0;
        let local36 = 0;
        let local38 = true;
        let local40 = 0;
        let local42 = true;
        const local49 = (this.field1 * textureGenerator.width) >> 12;
        let local51 = 0;
        const local58 = (this.field3 * textureGenerator.height) >> 12;
        const local65 = (textureGenerator.width * this.field2) >> 12;
        const local72 = (this.field4 * textureGenerator.height) >> 12;
        if (local72 <= 1) {
            return pixels[line];
        }

        this.anInt79 = ((textureGenerator.width / 8) * this.field5) >> 12;
        const local99 = (textureGenerator.width / local49 + 1) | 0;
        const random = new JavaRandom(this.seed);

        let local110 = new Array<Int32Array>(local99);
        let local114 = new Array<Int32Array>(local99);
        for (let i = 0; i < local99; i++) {
            local110[i] = new Int32Array(3);
            local114[i] = new Int32Array(3);
        }

        while (true) {
            while (true) {
                let local125 = local49 + nextIntJagex(random, local65 - local49);
                let local135 = nextIntJagex(random, local72 - local58) + local58;
                let local139 = local32 + local125;
                if (local139 > textureGenerator.width) {
                    local125 = textureGenerator.width - local32;
                    local139 = textureGenerator.width;
                }
                let local153: number;
                if (local38) {
                    local153 = 0;
                } else {
                    let local157 = local36;
                    const local161 = local114[local36];
                    local153 = local161[2];
                    let local167 = 0;
                    let local171 = local23 + local139;
                    if (local171 < 0) {
                        local171 += textureGenerator.width;
                    }
                    if (textureGenerator.width < local171) {
                        local171 -= textureGenerator.width;
                    }
                    while (true) {
                        const local196 = local114[local157];

                        if (local196[0] <= local171 && local171 <= local196[1]) {
                            if (local157 !== local36) {
                                let local238 = local32 + local23;
                                if (local238 < 0) {
                                    local238 += textureGenerator.width;
                                }
                                if (local238 > textureGenerator.width) {
                                    local238 -= textureGenerator.width;
                                }
                                for (let local258 = 1; local258 <= local167; local258++) {
                                    const local269 = local114[(local258 + local36) % local40];
                                    local153 = Math.max(local153, local269[2]);
                                }
                                for (let local280 = 0; local280 <= local167; local280++) {
                                    const local295 = local114[(local280 + local36) % local40];
                                    const local299 = local295[2];
                                    if (local299 !== local153) {
                                        const local306 = local295[1];
                                        const local310 = local295[0];
                                        let local320: number;
                                        let local322: number;
                                        if (local238 < local171) {
                                            local320 = Math.max(local238, local310);
                                            local322 = Math.min(local171, local306);
                                        } else if (local310 == 0) {
                                            local322 = Math.min(local171, local306);
                                            local320 = 0;
                                        } else {
                                            local320 = Math.max(local238, local310);
                                            local322 = textureGenerator.width;
                                        }
                                        this.method69(
                                            textureGenerator,
                                            local153 - local299,
                                            local322 - local320,
                                            local34 + local320,
                                            local299,
                                            random,
                                            pixels,
                                        );
                                    }
                                }
                            }
                            local36 = local157;
                            break;
                        }
                        local157++;
                        if (local157 >= local40) {
                            local157 = 0;
                        }
                        local167++;
                    }
                }

                if (textureGenerator.height < local135 + local153) {
                    local135 = textureGenerator.height - local153;
                } else {
                    local42 = false;
                }

                if (local139 === textureGenerator.width) {
                    this.method69(
                        textureGenerator,
                        local135,
                        local125,
                        local32 + local30,
                        local153,
                        random,
                        pixels,
                    );
                    if (local42) {
                        return output;
                    }
                    local38 = false;
                    const local440 = local51 + 1;
                    const local442 = local110[local51];
                    local42 = true;
                    local442[1] = local139;
                    local34 = local30;
                    local40 = local440;
                    local442[0] = local32;
                    local442[2] = local135 + local153;
                    local30 = nextIntJagex(random, textureGenerator.width);
                    const local469 = local114;
                    local36 = 0;
                    local23 = local30 - local34;
                    local114 = local110;
                    let local480 = local23;
                    local110 = local469;
                    if (local23 < 0) {
                        local480 = local23 + textureGenerator.width;
                    }
                    local51 = 0;
                    if (textureGenerator.width < local480) {
                        local480 -= textureGenerator.width;
                    }
                    while (true) {
                        const local506 = local114[local36];
                        if (local480 >= local506[0] && local506[1] >= local480) {
                            local32 = 0;
                            break;
                        }
                        local36++;
                        if (local40 <= local36) {
                            local36 = 0;
                        }
                    }
                } else {
                    const local388 = local110[local51++];
                    local388[1] = local139;
                    local388[2] = local135 + local153;
                    local388[0] = local32;
                    this.method69(
                        textureGenerator,
                        local135,
                        local125,
                        local30 + local32,
                        local153,
                        random,
                        pixels,
                    );
                    local32 = local139;
                }
            }
        }
    }
}
