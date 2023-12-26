import { ByteBuffer } from "../../../io/ByteBuffer";
import { ArithmeticOperation } from "./ArithmeticOperation";
import { BinaryOperation } from "./BinaryOperation";
import { BlurOperation } from "./BlurOperation";
import { BricksOperation } from "./BricksOperation";
import { BrightnessOperation } from "./BrightnessOperation";
import { ClampOperation } from "./ClampOperation";
import { ColorEdgeDetectorOperation } from "./ColorEdgeDetectorOperation";
import { ColourStripOperation } from "./ColourStripOperation";
import { ConstantColourOperation } from "./ConstantColourOperation";
import { ConstantMonochromeOperation } from "./ConstantMonochromeOperation";
import { CurveOperation } from "./CurveOperation";
import { DiagonalGradientOperation } from "./DiagonalGradientOperation";
import { EmbossOperation } from "./EmbossOperation";
import { GradientOperation } from "./GradientOperation";
import { GrayScaleOperation } from "./GrayScaleOperation";
import { HerringboneOperation } from "./HerringboneOperation";
import { HorizontalGradientOperation } from "./HorizontalGradientOperation";
import { HslOperation } from "./HslOperation";
import { InvertOperation } from "./InvertOperation";
import { IrregularBricksOperation } from "./IrregularBricksOperation";
import { KaleidoscopeOperation } from "./KaleidoscopeOperation";
import { LineNoiseOperation } from "./LineNoiseOperation";
import { MandelbrotOperation } from "./MandelbrotOperation";
import { MirrorOperation } from "./MirrorOperation";
import { MixerOperation } from "./MixerOperation";
import { MonochromeEdgeDetectorOperation } from "./MonochromeEdgeDetectorOperation";
import { Operation37 } from "./Operation37";
import { PerlinNoiseOperation } from "./PerlinNoiseOperation";
import { PseudoRandomNoiseOperation } from "./PseudoRandomNoiseOperation";
import { RangeOperation } from "./RangeOperation";
import { RasterizerOperation } from "./RasterizerOperation";
import { SpriteSourceOperation } from "./SpriteSourceOperation";
import { SquareWaveformOperation } from "./SquareWaveformOperation";
import { TextureOperation } from "./TextureOperation";
import { TextureSourceOperation } from "./TextureSourceOperation";
import { TilingOperation } from "./TilingOperation";
import { TilingSpriteOperation } from "./TilingSpriteOperation";
import { TrigWarpOperation } from "./TrigWarpOperation";
import { VerticalGradientOperation } from "./VerticalGradientOperation";
import { VoronoiNoiseOperation } from "./VoronoiNoiseOperation";
import { WeaveOperation } from "./WeaveOperation";

export class TextureOperationFactory {
    static instantiate(id: number): TextureOperation {
        switch (id) {
            case 0:
                return new ConstantMonochromeOperation();
            case 1:
                return new ConstantColourOperation();
            case 2:
                return new HorizontalGradientOperation();
            case 3:
                return new VerticalGradientOperation();
            case 4:
                return new BricksOperation();
            case 5:
                return new BlurOperation();
            case 6:
                return new ClampOperation();
            case 7:
                return new ArithmeticOperation();
            case 8:
                return new CurveOperation();
            case 9:
                return new MirrorOperation();
            case 10:
                return new GradientOperation();
            case 11:
                return new ColourStripOperation();
            case 12:
                return new DiagonalGradientOperation();
            case 13:
                return new PseudoRandomNoiseOperation();
            case 14:
                return new WeaveOperation();
            case 15:
                return new VoronoiNoiseOperation();
            case 16:
                return new HerringboneOperation();
            case 17:
                return new HslOperation();
            case 18:
                return new TilingSpriteOperation();
            case 19:
                return new TrigWarpOperation();
            case 20:
                return new TilingOperation();
            case 21:
                return new MixerOperation();
            case 22:
                return new InvertOperation();
            case 23:
                return new KaleidoscopeOperation();
            case 24:
                return new GrayScaleOperation();
            case 25:
                return new BrightnessOperation();
            case 26:
                return new BinaryOperation();
            case 27:
                return new SquareWaveformOperation();
            case 28:
                return new IrregularBricksOperation();
            case 29:
                return new RasterizerOperation();
            case 30:
                return new RangeOperation();
            case 31:
                return new MandelbrotOperation();
            case 32:
                return new EmbossOperation();
            case 33:
                return new ColorEdgeDetectorOperation();
            case 34:
                return new PerlinNoiseOperation();
            case 35:
                return new MonochromeEdgeDetectorOperation();
            case 36:
                return new TextureSourceOperation();
            case 37:
                return new Operation37();
            case 38:
                return new LineNoiseOperation();
            case 39:
                return new SpriteSourceOperation();
            default:
                throw new Error("Unknown texture operation: " + id);
        }
    }

    static create(buffer: ByteBuffer): TextureOperation {
        // some index
        const id = buffer.readUnsignedByte();
        const type = buffer.readUnsignedByte();
        // console.log("type", type, id);
        const operation = TextureOperationFactory.instantiate(type);
        operation.id = id;
        operation.cacheSize = buffer.readUnsignedByte();
        const fieldCount = buffer.readUnsignedByte();
        for (let i = 0; i < fieldCount; i++) {
            const field = buffer.readUnsignedByte();
            operation.decode(field, buffer);
        }
        operation.init();
        return operation;
    }
}
