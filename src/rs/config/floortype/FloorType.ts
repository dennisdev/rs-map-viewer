import { Type } from "../Type";

export interface FloorType extends Type {
    getRgb(): number;

    hue: number;
    saturation: number;
    lightness: number;

    isOverlay: boolean;

    getHueBlend(): number;

    getHueMultiplier(): number;
}
