import { ByteBuffer } from "../../util/ByteBuffer";

export class TextureDefinition {
    public static decode(buffer: ByteBuffer, id: number): TextureDefinition {
        const averageHsl = buffer.readUnsignedShort();
        const unknown = buffer.readUnsignedByte() === 1;
        const spriteCount = buffer.readUnsignedByte();
        if (spriteCount < 1 || spriteCount > 4) {
            throw new Error("Invalid sprite count for texture: " + spriteCount);
        }

        const spriteIds = new Array<number>(spriteCount);
        for (let i = 0; i < spriteCount; i++) {
            spriteIds[i] = buffer.readUnsignedShort();
        }

        let spriteTypes: number[] | undefined;
        if (spriteCount > 1) {
            spriteTypes = new Array(spriteCount - 1);
            for (let i = 0; i < spriteCount - 1; i++) {
                spriteTypes[i] = buffer.readUnsignedByte();
            }
        }
        let unused: number[] | undefined;
        if (spriteCount > 1) {
            unused = new Array(spriteCount - 1);
            for (let i = 0; i < spriteCount - 1; i++) {
                unused[i] = buffer.readUnsignedByte();
            }
        }

        const transforms = new Array<number>(spriteCount);
        for (let i = 0; i < spriteCount; i++) {
            transforms[i] = buffer.readInt();
        }

        const animationDirection = buffer.readUnsignedByte();
        const animationSpeed = buffer.readUnsignedByte();

        return new TextureDefinition(
            id,
            averageHsl,
            unknown,
            spriteCount,
            spriteIds,
            transforms,
            animationDirection,
            animationSpeed,
            spriteTypes,
            unused
        );
    }

    constructor(
        public id: number,
        public averageHsl: number,
        public unknown: boolean,
        public spriteCount: number,
        public spriteIds: number[],
        public transforms: number[],
        public animationDirection: number,
        public animationSpeed: number,
        public spriteTypes?: number[],
        public unused?: number[]
    ) {}

    /*
        not sure what this is used for

         if ((transform & -0x1000000) == 0x3000000) {
            // red, 0, blue
            int r_b = transform & 0xFF00FF;
            // green
            int green = transform >> 8 & 0xFF;

            for (int i = 0; i < palette.length; ++i) {
               int color = palette[i];
               int rg = color >> 8;
               int gb = color & 0xFFFF;
               if (rg == gb) {
                  // blue here
                  int blue = color & 0xFF;
                  palette[i] = r_b * blue >> 8 & 0xFF00FF | green * blue & 0xFF00;
               }
            }
         }

    */
}
