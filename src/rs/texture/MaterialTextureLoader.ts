import { CacheIndex } from "../cache/CacheIndex";
import { ByteBuffer } from "../io/ByteBuffer";
import { TextureLoader } from "./TextureLoader";
import { ProceduralTexture } from "./procedural/ProceduralTexture";
import { TextureGenerator } from "./procedural/TextureGenerator";

export class MaterialTextureLoader implements TextureLoader {
    textureGenerator: TextureGenerator;

    textures: Map<number, ProceduralTextureDefinition> = new Map();

    transparentTextureMap: Map<number, boolean> = new Map();

    static load(
        hasAlphaMaterialField: boolean,
        hasAlphaOperation: boolean,
        materialsIndex: CacheIndex,
        textureIndex: CacheIndex,
        spriteIndex: CacheIndex,
    ): MaterialTextureLoader {
        const materialsFile = materialsIndex.getFile(0, 0);
        if (!materialsFile) {
            throw new Error("Materials file not found");
        }
        const buffer = materialsFile.getDataAsBuffer();
        const count = buffer.readUnsignedShort();
        const materials: (TextureMaterial | undefined)[] = new Array(count);
        for (let i = 0; i < count; i++) {
            // 1
            const exists = buffer.readUnsignedByte() === 1;
            if (exists) {
                materials[i] = new TextureMaterial();
            }
        }
        for (let i = 0; i < count; i++) {
            const material = materials[i];
            if (material) {
                material.valid = buffer.readUnsignedByte() === 1;
            }
        }
        if (hasAlphaMaterialField) {
            for (let i = 0; i < count; i++) {
                const material = materials[i];
                if (material) {
                    material.alpha = buffer.readUnsignedByte() === 1;
                }
            }
        }
        for (let i = 0; i < count; i++) {
            const material = materials[i];
            if (material) {
                material.small = buffer.readUnsignedByte() === 1;
            }
        }
        for (let i = 0; i < count; i++) {
            const material = materials[i];
            if (material) {
                material.hd = buffer.readUnsignedByte() === 1;
            }
        }
        for (let i = 0; i < count; i++) {
            const material = materials[i];
            if (material) {
                material.brightness = buffer.readByte();
            }
        }
        for (let i = 0; i < count; i++) {
            const material = materials[i];
            if (material) {
                material.blanch = buffer.readByte();
            }
        }
        for (let i = 0; i < count; i++) {
            const material = materials[i];
            if (material) {
                material.shaderId = buffer.readByte();
            }
        }
        for (let i = 0; i < count; i++) {
            const material = materials[i];
            if (material) {
                material.shaderParam = buffer.readByte();
            }
        }
        for (let i = 0; i < count; i++) {
            const material = materials[i];
            if (material) {
                material.averageHsl = buffer.readUnsignedShort();
            }
        }

        if (buffer.remaining > 0) {
            for (let i = 0; i < count; i++) {
                const material = materials[i];
                if (material) {
                    material.animU = buffer.readByte();
                }
            }
            for (let i = 0; i < count; i++) {
                const material = materials[i];
                if (material) {
                    material.animV = buffer.readByte();
                }
            }
        }

        const textureIds = Array.from(textureIndex.getArchiveIds());

        return new MaterialTextureLoader(
            hasAlphaOperation,
            textureIndex,
            spriteIndex,
            textureIds,
            materials,
        );
    }

    constructor(
        readonly hasAlphaOperation: boolean,
        readonly textureIndex: CacheIndex,
        readonly spriteIndex: CacheIndex,
        readonly textureIds: number[],
        readonly materials: (TextureMaterial | undefined)[],
    ) {
        this.textureGenerator = new TextureGenerator(spriteIndex, this);
    }

    getTexture(id: number): ProceduralTextureDefinition | undefined {
        const cached = this.textures.get(id);
        if (cached) {
            return cached;
        }

        const textureFile = this.textureIndex.getFileSmart(id);
        if (!textureFile) {
            return undefined;
        }
        const buffer = textureFile.getDataAsBuffer();
        const texture = new ProceduralTextureDefinition(id, buffer, this.hasAlphaOperation);
        this.textures.set(id, texture);
        return texture;
    }

    getTextureIds(): number[] {
        return this.textureIds;
    }

    getTextureIndex(id: number): number {
        return id;
    }

    isSd(id: number): boolean {
        return this.materials[id]?.valid ?? false;
    }

    isSmall(id: number): boolean {
        return this.materials[id]?.small ?? false;
    }

    isTransparent(id: number): boolean {
        if (!this.transparentTextureMap.has(id)) {
            try {
                if (!this.getTexture(id)) {
                    return false;
                }
                this.getPixelsRgb(id, 128, false, 1.0);
            } catch (e) {
                console.error("Error loading texture", e);
                this.transparentTextureMap.set(id, false);
            }
        }
        return this.transparentTextureMap.get(id) ?? false;
    }

    getAverageHsl(id: number): number {
        return this.materials[id]?.averageHsl ?? 0;
    }

    getAnimationUv(id: number): [number, number] {
        const texture = this.getTexture(id);
        if (!texture) {
            return [0, 0];
        }

        return [texture.animU, texture.animV];
    }

    getPixelsRgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array {
        const texture = this.getTexture(id);
        if (!texture) {
            throw new Error("Texture not found: " + id);
        }

        const pixels = texture.proceduralTexture.getPixelsRgb(
            this.textureGenerator,
            size,
            size,
            flipH,
            texture.flipV,
            brightness,
        );

        this.transparentTextureMap.set(id, this.textureGenerator.isTransparent);

        return pixels;
    }
}

class TextureMaterial {
    valid: boolean = false;
    alpha: boolean = false;
    small: boolean = false;
    hd: boolean = false;
    brightness: number = 0;
    blanch: number = 0;
    shaderId: number = 0;
    shaderParam: number = 0;
    averageHsl: number = 0;

    animU: number = 0;
    animV: number = 0;
}

class ProceduralTextureDefinition {
    id: number;
    proceduralTexture: ProceduralTexture;

    bool1: boolean = false;
    flipV: boolean = false;

    repeatS: boolean = false;
    repeatT: boolean = false;

    animU: number = 0;
    animV: number = 0;

    constructor(id: number, buffer: ByteBuffer, hasAlphaOperation: boolean) {
        this.id = id;
        this.proceduralTexture = new ProceduralTexture(buffer, hasAlphaOperation);
        this.bool1 = buffer.readUnsignedByte() === 1;
        this.flipV = buffer.readUnsignedByte() === 1;
        this.repeatS = buffer.readUnsignedByte() === 1;
        this.repeatT = buffer.readUnsignedByte() === 1;
        const something = buffer.readUnsignedByte() & 0x3;
        this.animU = buffer.readByte();
        this.animV = buffer.readByte();
    }
}
