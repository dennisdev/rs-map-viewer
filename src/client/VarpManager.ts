import { VarbitLoader } from "./fs/loader/VarbitLoader";

function createMasks(): Int32Array {
    const masks = new Int32Array(32);

    let n = 2;
    for (let i = 0; i < 32; i++) {
        masks[i] = n - 1;
        n += n;
    }

    return masks;
}

const MASKS = createMasks();

export class VarpManager {
    varbitLoader: VarbitLoader;

    varps: Int32Array;

    constructor(varbitLoader: VarbitLoader) {
        this.varbitLoader = varbitLoader;
        this.varps = new Int32Array(4000);
    }

    getVarp(id: number): number {
        return this.varps[id];
    }

    getVarbit(id: number): number {
        const {
            baseVar,
            startBit,
            endBit
        } = this.varbitLoader.getDefinition(id);
        const mask = MASKS[endBit - startBit];
        return this.varps[baseVar] >> startBit & mask;
    }
}
