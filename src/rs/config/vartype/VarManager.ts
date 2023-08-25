import { BIT_MASKS } from "../../MathConstants";
import { VarBitTypeLoader } from "./bit/VarBitTypeLoader";

export class VarManager {
    varbitLoader: VarBitTypeLoader;

    varps: Int32Array;

    constructor(varbitLoader: VarBitTypeLoader) {
        this.varbitLoader = varbitLoader;
        this.varps = new Int32Array(4000);
    }

    getVarp(id: number): number {
        return this.varps[id];
    }

    getVarbit(id: number): number {
        const { baseVar, startBit, endBit } = this.varbitLoader.load(id);
        const mask = BIT_MASKS[endBit - startBit];
        return (this.varps[baseVar] >> startBit) & mask;
    }
}
