import { TextureGenerator } from "../TextureGenerator";
import { TextureOperation } from "./TextureOperation";

export class HorizontalGradientOperation extends TextureOperation {
    constructor() {
        super(0, true);
    }

    override getMonochromeOutput(textureGenerator: TextureGenerator, line: number): Int32Array {
        return textureGenerator.horizontalGradient;
    }
}
