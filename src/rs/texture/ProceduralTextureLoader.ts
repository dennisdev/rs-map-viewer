import { CacheIndex } from "../cache/CacheIndex";
import { ByteBuffer } from "../io/ByteBuffer";
import { TextureLoader } from "./TextureLoader";
import { ProceduralTexture } from "./procedural/ProceduralTexture";
import { TextureGenerator } from "./procedural/TextureGenerator";

export class ProceduralTextureLoader implements TextureLoader {
    textureGenerator: TextureGenerator;

    idIndexMap: Map<number, number> = new Map();

    transparentTextureMap: Map<number, boolean> = new Map();

    static load(textureIndex: CacheIndex, spriteIndex: CacheIndex): ProceduralTextureLoader {
        const definitions = new Map<number, ProceduralTextureDefinition>();
        const texturesArchive = textureIndex.getArchive(0);

        const textureIds = Array.from(texturesArchive.fileIds);
        for (let i = 0; i < textureIds.length; i++) {
            const id = textureIds[i];
            const file = texturesArchive.getFile(id);
            if (file) {
                const buffer = file.getDataAsBuffer();
                const def = new ProceduralTextureDefinition(id, buffer);
                definitions.set(id, def);
            }
        }

        return new ProceduralTextureLoader(spriteIndex, textureIds, definitions);
    }

    constructor(
        readonly spriteIndex: CacheIndex,
        readonly textureIds: number[],
        readonly definitions: Map<number, ProceduralTextureDefinition>,
    ) {
        this.textureGenerator = new TextureGenerator(spriteIndex, this);
        for (let i = 0; i < textureIds.length; i++) {
            this.idIndexMap.set(textureIds[i], i);
        }
    }

    getTextureIds(): number[] {
        return this.textureIds;
    }

    getTextureIndex(id: number): number {
        return this.idIndexMap.get(id) ?? -1;
    }

    isSmall(id: number): boolean {
        return this.definitions.get(id)?.size === 64;
    }

    isSd(id: number): boolean {
        return this.definitions.get(id)?.valid ?? false;
    }

    isTransparent(id: number): boolean {
        if (!this.transparentTextureMap.has(id)) {
            if (!this.definitions.has(id)) {
                return false;
            }
            this.getPixelsRgb(id, 128, false, 1.0);
        }
        return this.transparentTextureMap.get(id) ?? false;
    }

    getAverageHsl(id: number): number {
        return this.definitions.get(id)?.averageHsl ?? 0;
    }

    getAnimationUv(id: number): [number, number] {
        const def = this.definitions.get(id);
        if (!def) {
            return [0, 0];
        }

        let u = 0;
        let v = 0;
        if (def.animDirU !== 0) {
            u = def.animDirU === 1 ? 1 : -1;
        }
        if (def.animDirV !== 0) {
            v = def.animDirV === 1 ? 1 : -1;
        }

        const speed = def.animSpeed;

        return [u * speed, v * speed];
    }

    getPixelsRgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array {
        const def = this.definitions.get(id);
        if (!def) {
            throw new Error("Texture definition not found: " + id);
        }

        // this.textureGenerator.debug = id === 69;
        const pixels = def.proceduralTexture.getPixelsRgb(
            this.textureGenerator,
            size,
            size,
            flipH,
            false,
            brightness,
        );

        this.transparentTextureMap.set(id, this.textureGenerator.isTransparent);

        return pixels;
    }

    getPixelsArgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array {
        const def = this.definitions.get(id);
        if (!def) {
            throw new Error("Texture definition not found: " + id);
        }

        // this.textureGenerator.debug = id === 69;
        const pixels = def.proceduralTexture.getPixelsArgb(
            this.textureGenerator,
            size,
            size,
            flipH,
            false,
            brightness,
        );

        this.transparentTextureMap.set(id, this.textureGenerator.isTransparent);

        return pixels;
    }
}

class ProceduralTextureDefinition {
    id: number;

    proceduralTexture: ProceduralTexture;

    flag1: boolean;
    valid: boolean;

    size: number;
    averageHsl: number;
    unused: number;
    animDirU: number;
    animDirV: number;
    animSpeed: number;

    constructor(id: number, buffer: ByteBuffer) {
        this.id = id;
        // console.log("id", id);
        this.proceduralTexture = new ProceduralTexture(buffer, false);
        const flag = buffer.readUnsignedByte();
        this.flag1 = (flag & 0x1) !== 0;
        this.valid = (flag & 0x2) !== 0;
        this.size = buffer.readUnsignedByte();
        this.averageHsl = buffer.readUnsignedShort();
        this.unused = buffer.readUnsignedByte();
        if (this.unused === 0xff) {
            this.unused = 256;
        }
        const i_23_ = buffer.readUnsignedByte();
        const i_24_ = buffer.readUnsignedByte();
        this.animDirU = (i_23_ >> 6) & 0x3;
        this.animDirV = (i_24_ >> 6) & 0x3;
        this.animSpeed = (i_24_ & 0x3f) - 6;
        buffer.readUnsignedByte();
        buffer.readUnsignedByte();
    }
}
