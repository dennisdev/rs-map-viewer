import { clamp } from "../../../util/MathUtil";
import { BIT_MASKS } from "../../MathConstants";
import { QuestTypeLoader } from "../questtype/QuestTypeLoader";
import { VarBitTypeLoader } from "./bit/VarBitTypeLoader";

export class VarManager {
    varbitLoader: VarBitTypeLoader;

    values: Int32Array;

    constructor(varbitLoader: VarBitTypeLoader) {
        this.varbitLoader = varbitLoader;
        this.values = new Int32Array(8000);
    }

    clear(): void {
        this.values.fill(0);
    }

    set(values: Int32Array): void {
        this.values.set(values);
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
        return this.values[id];
    }

    setVarp(id: number, value: number): boolean {
        if (this.getVarp(id) === value || id >= this.values.length) {
            return false;
        }
        this.values[id] = value;
        return true;
    }

    getVarbit(id: number): number {
        const { baseVar, startBit, endBit } = this.varbitLoader.load(id);
        const mask = BIT_MASKS[endBit - startBit];
        const value = (this.values[baseVar] >> startBit) & mask;
        return value;
    }

    setVarbit(id: number, value: number): boolean {
        const { baseVar, startBit, endBit } = this.varbitLoader.load(id);
        if (baseVar >= this.values.length) {
            return false;
        }
        let mask = BIT_MASKS[endBit - startBit];
        if (value < 0 || value > mask) {
            value = 0;
        }
        if (this.getVarbit(id) === value) {
            return false;
        }
        mask <<= startBit;
        this.values[baseVar] = ((value << startBit) & mask) | (this.values[baseVar] & ~mask);
        return true;
    }
}
