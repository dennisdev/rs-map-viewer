import { CacheIndex } from "../cache/CacheIndex";
import { ByteBuffer } from "../io/ByteBuffer";
import { TextureCombineMode } from "./TextureCombineMode";
import { TextureLoader } from "./TextureLoader";
import { TextureMaterial } from "./TextureMaterial";
import { ProceduralTexture } from "./procedural/ProceduralTexture";
import { TextureGenerator } from "./procedural/TextureGenerator";

export class ProceduralTextureLoader implements TextureLoader {
    textureGenerator: TextureGenerator;

    textures: Map<number, ProceduralTextureDefinition> = new Map();

    transparentTextureMap: Map<number, boolean> = new Map();

    static load(
        revision: number,
        materialsIndex: CacheIndex,
        textureIndex: CacheIndex,
        spriteIndex: CacheIndex,
    ): ProceduralTextureLoader {
        const hasModOperation = revision >= 537;
        const hasCombineModeAndShaderParam2 = revision >= 582;
        const hasAlphaBlending = revision >= 629;

        const materialsFile = materialsIndex.getFile(0, 0);
        if (!materialsFile) {
            throw new Error("Materials file not found");
        }
        const buffer = materialsFile.getDataAsBuffer();
        const count = buffer.readUnsignedShort();
        const materials: (ProcTextureMaterial | undefined)[] = new Array(count);
        for (let i = 0; i < count; i++) {
            // 1
            const exists = buffer.readUnsignedByte() === 1;
            if (exists) {
                materials[i] = new ProcTextureMaterial(i);
            }
        }
        for (let i = 0; i < count; i++) {
            const material = materials[i];
            if (material) {
                material.valid = buffer.readUnsignedByte() === 1;
            }
        }
        if (!hasAlphaBlending) {
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
                material.disabled = buffer.readUnsignedByte() === 1;
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
            for (let i = 0; i < count; i++) {
                const material = materials[i];
                if (material) {
                    buffer.readByte();
                }
            }
            for (let i = 0; i < count; i++) {
                const material = materials[i];
                if (material) {
                    material.flipV = buffer.readUnsignedByte() === 1;
                }
            }
            for (let i = 0; i < count; i++) {
                const material = materials[i];
                if (material) {
                    material.mipmap = buffer.readByte();
                }
            }
            for (let i = 0; i < count; i++) {
                const material = materials[i];
                if (material) {
                    material.repeatS = buffer.readUnsignedByte() === 1;
                }
            }
            for (let i = 0; i < count; i++) {
                const material = materials[i];
                if (material) {
                    material.repeatT = buffer.readUnsignedByte() === 1;
                }
            }
            for (let i = 0; i < count; i++) {
                const material = materials[i];
                if (material) {
                    material.floatTexture = buffer.readUnsignedByte() === 1;
                }
            }
            if (hasCombineModeAndShaderParam2) {
                for (let i = 0; i < count; i++) {
                    const material = materials[i];
                    if (material) {
                        material.combineMode = buffer.readUnsignedByte();
                    }
                }
                for (let i = 0; i < count; i++) {
                    const material = materials[i];
                    if (material) {
                        material.shaderParam2 = buffer.readInt();
                    }
                }
            }
            if (hasAlphaBlending) {
                for (let i = 0; i < count; i++) {
                    const material = materials[i];
                    if (material) {
                        material.alphaMode = buffer.readUnsignedByte();
                    }
                }
            }
        }

        const textureIds = Array.from(textureIndex.getArchiveIds());

        return new ProceduralTextureLoader(
            revision >= 555,
            hasModOperation,
            textureIndex,
            spriteIndex,
            textureIds,
            materials,
        );
    }

    constructor(
        readonly isRunetek5: boolean,
        readonly hasModOperation: boolean,
        readonly textureIndex: CacheIndex,
        readonly spriteIndex: CacheIndex,
        readonly textureIds: number[],
        readonly materials: (ProcTextureMaterial | undefined)[],
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
        const texture = new ProceduralTextureDefinition(id, buffer, this.hasModOperation);
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
                this.getPixelsArgb(id, 128, false, 1.0);
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

    getMaterial(id: number): TextureMaterial {
        const texture = this.getTexture(id);
        const material = this.materials[id];
        if (!material) {
            return {
                animU: 0,
                animV: 0,
                alphaCutOff: 0.1,
            };
        }

        let animU = material.animU;
        let animV = material.animV;

        if (!this.isRunetek5) {
            const textureDef = this.getTexture(id);
            if (textureDef) {
                animU = textureDef.animU;
                animV = textureDef.animV;
            }
        }

        let alphaCutOff = 0.9;
        if (animU !== 0 || animV !== 0 || material.alphaMode === 2) {
            alphaCutOff = 0.01;
        }

        return {
            animU,
            animV,
            alphaCutOff,
        };
    }

    getPixelsRgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array {
        const texture = this.getTexture(id);
        if (!texture) {
            throw new Error("Texture not found: " + id);
        }
        // this.textureGenerator.debug = id === 922 || id === 925 || id === 10;

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

    getPixelsArgb(id: number, size: number, flipH: boolean, brightness: number): Int32Array {
        const texture = this.getTexture(id);
        if (!texture) {
            throw new Error("Texture not found: " + id);
        }

        // this.textureGenerator.debug = id === 922 || id === 925 || id === 110;

        const pixels = texture.proceduralTexture.getPixelsArgb(
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

class ProcTextureMaterial {
    valid: boolean = false;
    alpha: boolean = false;
    small: boolean = false;
    disabled: boolean = false;
    brightness: number = 0;
    blanch: number = 0;
    shaderId: number = 0;
    shaderParam: number = 0;
    averageHsl: number = 0;

    animU: number = 0;
    animV: number = 0;

    flipV: boolean = false;
    mipmap: number = 0;
    repeatS: boolean = false;
    repeatT: boolean = false;
    floatTexture: boolean = false;
    combineMode: number = 0;

    shaderParam2: number = 0;

    alphaMode: number = 0;

    constructor(readonly id: number) {}
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

    combineMode: TextureCombineMode;

    constructor(id: number, buffer: ByteBuffer, hasModOperation: boolean) {
        this.id = id;
        this.proceduralTexture = new ProceduralTexture(buffer, hasModOperation);
        this.bool1 = buffer.readUnsignedByte() === 1;
        this.flipV = buffer.readUnsignedByte() === 1;
        this.repeatS = buffer.readUnsignedByte() === 1;
        this.repeatT = buffer.readUnsignedByte() === 1;
        const combineMode = buffer.readUnsignedByte() & 0x3;
        this.animU = buffer.readByte();
        this.animV = buffer.readByte();
        if (combineMode === 1) {
            this.combineMode = TextureCombineMode.ADD;
        } else if (combineMode === 2) {
            this.combineMode = TextureCombineMode.SUBTRACT;
        } else if (combineMode === 3) {
            this.combineMode = TextureCombineMode.ADD_SIGNED;
        } else {
            this.combineMode = TextureCombineMode.MODULATE;
        }
    }
}
