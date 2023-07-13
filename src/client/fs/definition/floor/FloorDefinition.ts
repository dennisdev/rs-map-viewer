import { Definition } from "../Definition";

export interface FloorDefinition extends Definition {
    hue: number;
    saturation: number;
    lightness: number;

    isOverlay: boolean;

    getHueBlend(): number;

    getHueMultiplier(): number;
}
