import { clamp } from "../../../util/MathUtil";
import { BIT_MASKS } from "../../MathConstants";
import { QuestTypeLoader } from "../questtype/QuestTypeLoader";
import { VarBitTypeLoader } from "./bit/VarBitTypeLoader";

export class VarManager {
    varbitLoader: VarBitTypeLoader;

    varps: Int32Array;

    constructor(varbitLoader: VarBitTypeLoader) {
        this.varbitLoader = varbitLoader;
        this.varps = new Int32Array(8000);
    }

    setQuestsCompleted(questTypeLoader: QuestTypeLoader): void {
        for (let i = 0; i < questTypeLoader.getCount(); i++) {
            const quest = questTypeLoader.load(i);
            if (!quest) {
                continue;
            }
            if (quest.varps) {
                for (const varp of quest.varps) {
                    this.setVarp(varp.id, varp.completedValue);
                }
            }
            if (quest.varbits) {
                for (const varbit of quest.varbits) {
                    this.setVarbit(varbit.id, varbit.completedValue);
                }
            }
        }
    }

    getVarp(id: number): number {
        return this.varps[id];
    }

    setVarp(id: number, value: number): void {
        this.varps[id] = value;
    }

    getVarbit(id: number): number {
        const { baseVar, startBit, endBit } = this.varbitLoader.load(id);
        const mask = BIT_MASKS[endBit - startBit];
        const value = (this.varps[baseVar] >> startBit) & mask;
        return value;
    }

    setVarbit(id: number, value: number): void {
        const { baseVar, startBit, endBit } = this.varbitLoader.load(id);
        const mask = BIT_MASKS[endBit - startBit];
        value = clamp(value, 0, mask);
        this.varps[baseVar] =
            (this.varps[baseVar] & ~(mask << startBit)) | ((value & mask) << startBit);
    }
}
