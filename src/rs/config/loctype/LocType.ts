import { toSigned16bit } from "../../../util/MathUtil";
import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { ParamsMap, Type } from "../Type";
import { VarManager } from "../vartype/VarManager";
import { LocModelType } from "./LocModelType";
import { LocTypeLoader } from "./LocTypeLoader";

export class LocType extends Type {
    static readonly DEFAULT_DECOR_DISPLACEMENT: number = 16;

    lowDetail: boolean;

    models!: number[][];
    types?: LocModelType[];

    name: string;
    desc?: string;

    recolorFrom!: number[];
    recolorTo!: number[];

    retextureFrom!: number[];
    retextureTo!: number[];

    sizeX: number;
    sizeY: number;

    clipType: number;

    blocksProjectile: boolean;

    isInteractive: number;

    contouredGround: number;

    contourGroundType: number;
    contourGroundParam: number;

    mergeNormals: boolean;

    modelClipped: boolean;

    seqId: number;

    decorDisplacement: number;

    ambient: number;
    contrast: number;

    actions: string[];

    mapFunctionId: number;
    mapSceneId: number;
    flipMapSceneSprite: boolean;

    isRotated: boolean;

    clipped: boolean;

    modelSizeX: number;
    modelSizeHeight: number;
    modelSizeY: number;

    offsetX: number;
    offsetHeight: number;
    offsetY: number;

    obstructsGround: boolean;

    isHollow: boolean;

    supportItems: number;

    transforms?: number[];
    transformVarbit: number;
    transformVarp: number;

    ambientSoundId: number;

    int4: number;
    int5: number;
    int6: number;

    soundEffectIds!: number[];

    seqRandomStart: boolean;

    randomSeqIds?: number[];
    randomSeqDelays?: number[];

    params!: ParamsMap;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.lowDetail = false;
        this.name = "null";
        this.sizeX = 1;
        this.sizeY = 1;
        this.clipType = 2;
        this.blocksProjectile = true;
        this.isInteractive = -1;
        this.contouredGround = -1;
        this.mergeNormals = false;
        this.modelClipped = false;
        this.seqId = -1;
        this.decorDisplacement = LocType.DEFAULT_DECOR_DISPLACEMENT;
        this.ambient = 0;
        this.contrast = 0;
        this.actions = new Array(5);
        this.mapFunctionId = -1;
        this.mapSceneId = -1;
        this.flipMapSceneSprite = false;
        this.isRotated = false;
        this.clipped = true;
        this.modelSizeX = 128;
        this.modelSizeHeight = 128;
        this.modelSizeY = 128;
        this.offsetX = 0;
        this.offsetHeight = 0;
        this.offsetY = 0;
        this.obstructsGround = false;
        this.isHollow = false;
        this.supportItems = -1;
        this.transformVarbit = -1;
        this.transformVarp = -1;
        this.ambientSoundId = -1;
        this.int4 = 0;
        this.int5 = 0;
        this.int6 = 0;
        this.seqRandomStart = true;

        this.contourGroundType = 0;
        this.contourGroundParam = -1;
    }

    skipNewModels(buffer: ByteBuffer): void {
        const count = buffer.readUnsignedByte();
        for (let i = 0; i < count; i++) {
            buffer.readByte();
            const modelCount = buffer.readUnsignedByte();
            if (this.isLargeModelId()) {
                for (let j = 0; j < modelCount; j++) {
                    buffer.readBigSmart();
                }
            } else {
                for (let j = 0; j < modelCount; j++) {
                    buffer.readUnsignedShort();
                }
            }
        }
    }

    isNewModelsFormat(): boolean {
        return this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 582;
    }

    isLargeModelId(): boolean {
        return this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 670;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (this.isNewModelsFormat() && (opcode === 1 || opcode === 5)) {
            // something in preferences, true breaks some roofs?
            const someBool = false;
            if (opcode === 5 && someBool) {
                this.skipNewModels(buffer);
            }

            const count = buffer.readUnsignedByte();
            this.types = new Array(count);
            this.models = new Array(count);
            for (let i = 0; i < count; i++) {
                this.types[i] = buffer.readByte();
                const modelCount = buffer.readUnsignedByte();
                this.models[i] = new Array(modelCount);
                if (this.isLargeModelId()) {
                    for (let j = 0; j < modelCount; j++) {
                        this.models[i][j] = buffer.readBigSmart();
                    }
                } else {
                    for (let j = 0; j < modelCount; j++) {
                        this.models[i][j] = buffer.readUnsignedShort();
                    }
                }
            }

            if (opcode === 5 && !someBool) {
                this.skipNewModels(buffer);
            }
        } else if (opcode === 1) {
            const count = buffer.readUnsignedByte();
            if (count > 0) {
                if (this.models && !this.lowDetail) {
                    buffer.offset += count * 3;
                } else {
                    this.models = new Array(count);
                    this.types = new Array(count);
                    for (let i = 0; i < count; i++) {
                        this.models[i] = new Array(1);
                        this.models[i][0] = buffer.readUnsignedShort();
                        this.types[i] = buffer.readUnsignedByte();
                    }
                }
            }
        } else if (opcode === 2) {
            this.name = this.readString(buffer);
        } else if (opcode === 3) {
            this.desc = this.readString(buffer);
        } else if (opcode === 5) {
            const count = buffer.readUnsignedByte();
            if (count > 0) {
                if (this.models && !this.lowDetail) {
                    buffer.offset += count * 2;
                } else {
                    this.types = undefined;
                    this.models = new Array(1);
                    this.models[0] = new Array(count);
                    for (let i = 0; i < count; i++) {
                        this.models[0][i] = buffer.readUnsignedShort();
                    }
                }
            }
        } else if (opcode === 14) {
            this.sizeX = buffer.readUnsignedByte();
        } else if (opcode === 15) {
            this.sizeY = buffer.readUnsignedByte();
        } else if (opcode === 17) {
            this.clipType = 0;
            this.blocksProjectile = false;
        } else if (opcode === 18) {
            this.blocksProjectile = false;
        } else if (opcode === 19) {
            this.isInteractive = buffer.readUnsignedByte();
        } else if (opcode === 21) {
            this.contouredGround = 0;
            this.contourGroundType = 1;
        } else if (opcode === 22) {
            this.mergeNormals = true;
        } else if (opcode === 23) {
            this.modelClipped = true;
        } else if (opcode === 24) {
            this.seqId = this.isLargeModelId() ? buffer.readBigSmart() : buffer.readUnsignedShort();
            if (this.seqId === 65535) {
                this.seqId = -1;
            }
        } else if (opcode === 25) {
            // disposeAlpha?
        } else if (opcode === 27) {
            this.clipType = 1;
        } else if (opcode === 28) {
            this.decorDisplacement = buffer.readUnsignedByte();
        } else if (opcode === 29) {
            this.ambient = buffer.readByte();
        } else if (opcode === 39) {
            this.contrast = buffer.readByte() * 25;
        } else if (opcode >= 30 && opcode < 39) {
            this.actions[opcode - 30] = this.readString(buffer);
            if (this.actions[opcode - 30].toLowerCase() === "hidden") {
                delete this.actions[opcode - 30];
            }
        } else if (opcode === 40) {
            const count = buffer.readUnsignedByte();
            this.recolorFrom = new Array(count);
            this.recolorTo = new Array(count);

            for (let i = 0; i < count; i++) {
                this.recolorFrom[i] = buffer.readUnsignedShort();
                this.recolorTo[i] = buffer.readUnsignedShort();
            }
        } else if (opcode === 41) {
            const count = buffer.readUnsignedByte();
            this.retextureFrom = new Array(count);
            this.retextureTo = new Array(count);

            for (let i = 0; i < count; i++) {
                this.retextureFrom[i] = buffer.readUnsignedShort();
                this.retextureTo[i] = buffer.readUnsignedShort();
            }
        } else if (opcode === 44 || opcode === 45) {
            buffer.readUnsignedShort();
        } else if (opcode === 60) {
            this.mapFunctionId = buffer.readUnsignedShort();
        } else if (opcode === 61) {
            buffer.readUnsignedShort();
        } else if (opcode === 62) {
            this.isRotated = true;
        } else if (opcode === 64) {
            this.clipped = false;
        } else if (opcode === 65) {
            this.modelSizeX = buffer.readUnsignedShort();
        } else if (opcode === 66) {
            this.modelSizeHeight = buffer.readUnsignedShort();
        } else if (opcode === 67) {
            this.modelSizeY = buffer.readUnsignedShort();
        } else if (opcode === 68) {
            this.mapSceneId = buffer.readUnsignedShort();
        } else if (opcode === 69) {
            buffer.readUnsignedByte();
        } else if (opcode === 70) {
            this.offsetX = buffer.readShort();
        } else if (opcode === 71) {
            this.offsetHeight = buffer.readShort();
        } else if (opcode === 72) {
            this.offsetY = buffer.readShort();
        } else if (opcode === 73) {
            this.obstructsGround = true;
        } else if (opcode === 74) {
            this.isHollow = true;
        } else if (opcode === 75) {
            this.supportItems = buffer.readUnsignedByte();
        } else if (opcode === 77 || opcode === 92) {
            this.transformVarbit = buffer.readUnsignedShort();
            if (this.transformVarbit === 65535) {
                this.transformVarbit = -1;
            }

            this.transformVarp = buffer.readUnsignedShort();
            if (this.transformVarp === 65535) {
                this.transformVarp = -1;
            }

            let var3 = -1;
            if (opcode === 92) {
                var3 = this.isLargeModelId() ? buffer.readBigSmart() : buffer.readUnsignedShort();
                if (var3 === 65535) {
                    var3 = -1;
                }
            }

            const count = buffer.readUnsignedByte();
            this.transforms = new Array(count + 2);

            for (let i = 0; i <= count; i++) {
                this.transforms[i] = this.isLargeModelId()
                    ? buffer.readBigSmart()
                    : buffer.readUnsignedShort();
                if (this.transforms[i] === 65535) {
                    this.transforms[i] = -1;
                }
            }

            this.transforms[count + 1] = var3;
        } else if (opcode === 78) {
            this.ambientSoundId = buffer.readUnsignedShort();
            this.int4 = buffer.readUnsignedByte();
        } else if (opcode === 79) {
            this.int5 = buffer.readUnsignedShort();
            this.int6 = buffer.readUnsignedShort();
            this.int4 = buffer.readUnsignedByte();
            const count = buffer.readUnsignedByte();
            this.soundEffectIds = new Array(count);

            for (let i = 0; i < count; i++) {
                this.soundEffectIds[i] = buffer.readUnsignedShort();
            }
        } else if (opcode === 81) {
            this.contouredGround = buffer.readUnsignedByte() * 256;

            this.contourGroundType = 2;
            this.contourGroundParam = toSigned16bit(this.contouredGround);
        } else if (opcode === 82) {
            if (this.cacheInfo.game === "oldschool") {
                this.mapFunctionId = buffer.readUnsignedShort();
            } else {
                // hd only = true?
            }
        } else if (opcode === 88) {
            const bool = true;
        } else if (opcode === 89) {
            this.seqRandomStart = false;
        } else if (opcode === 90) {
            const bool = true;
        } else if (opcode === 91) {
            const members = true;
        } else if (opcode === 93) {
            this.contourGroundType = 3;
            this.contourGroundParam = buffer.readShort();
        } else if (opcode === 94) {
            this.contourGroundType = 4;
        } else if (opcode === 95) {
            this.contourGroundType = 5;
            // Added somewhere between 582 and 614, not sure
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 614) {
                this.contourGroundParam = buffer.readUnsignedShort();
            }
        } else if (opcode === 96) {
            const aBoolean1878 = true;
        } else if (opcode === 97) {
            const adjustMapSceneRotation = true;
        } else if (opcode === 98) {
            const hasAnimation = true;
        } else if (opcode === 99) {
            const cursor1op = buffer.readUnsignedByte();
            const cursor1 = buffer.readUnsignedShort();
        } else if (opcode === 100) {
            const cursor2op = buffer.readUnsignedByte();
            const cursor2 = buffer.readUnsignedShort();
        } else if (opcode === 101) {
            const mapSceneRotationOff = buffer.readUnsignedByte();
        } else if (opcode === 102) {
            this.mapSceneId = buffer.readUnsignedShort();
        } else if (opcode === 103) {
            const occludeType = 0;
        } else if (opcode === 104) {
            const ambientSoundVolume = buffer.readUnsignedByte();
        } else if (opcode === 105) {
            const flipMapSceneSprite = true;
        } else if (opcode === 106) {
            let totalDelay = 0;
            const count = buffer.readUnsignedByte();
            this.randomSeqIds = new Array(count);
            this.randomSeqDelays = new Array(count);
            for (let i = 0; i < count; i++) {
                this.randomSeqIds[i] = this.isLargeModelId()
                    ? buffer.readBigSmart()
                    : buffer.readUnsignedShort();
                const delay = buffer.readUnsignedByte();
                this.randomSeqDelays[i] = delay;
                totalDelay += delay;
            }
        } else if (opcode === 107) {
            this.mapFunctionId = buffer.readUnsignedShort();
        } else if (opcode >= 150 && opcode < 155) {
            this.actions[opcode - 150] = this.readString(buffer);
            if (this.actions[opcode - 150].toLowerCase() === "hidden") {
                delete this.actions[opcode - 150];
            }
        } else if (opcode === 160) {
            const count = buffer.readUnsignedByte();
            const campaigns: number[] = new Array(count);
            for (let i = 0; i < count; i++) {
                campaigns[i] = buffer.readUnsignedShort();
            }
        } else if (opcode === 163) {
            const aByte2193 = buffer.readByte();
            const aByte2130 = buffer.readByte();
            const aByte2148 = buffer.readByte();
            const aByte2140 = buffer.readByte();
        } else if (opcode === 167) {
            const v = buffer.readUnsignedShort();
        } else if (opcode === 168) {
            const b = true;
        } else if (opcode === 169) {
            const b = true;
        } else if (opcode === 170) {
            const v = buffer.readUnsignedSmart();
        } else if (opcode === 171) {
            const v = buffer.readUnsignedSmart();
        } else if (opcode === 173) {
            const v0 = buffer.readUnsignedShort();
            const v1 = buffer.readUnsignedShort();
        } else if (opcode === 177) {
            const b = true;
        } else if (opcode === 178) {
            const v = buffer.readUnsignedByte();
        } else if (opcode === 189) {
            const bloom = true;
        } else if (opcode === 190) {
            // unknown starts 731
        } else if (opcode === 191) {
            // unknown starts 731
        } else if (opcode === 249) {
            this.params = Type.readParamsMap(buffer, this.params);
        } else {
            throw new Error("LocType: Opcode " + opcode + " not implemented. id: " + this.id);
        }
    }

    override post(): void {
        if (this.isInteractive === -1) {
            this.isInteractive = 0;
            if (this.models && (!this.types || this.types[0] === 10)) {
                this.isInteractive = 1;
            }

            for (let i = 0; i < 5; i++) {
                if (this.actions[i]) {
                    this.isInteractive = 1;
                }
            }
        }

        if (this.supportItems === -1) {
            this.supportItems = this.clipType !== 0 ? 1 : 0;
        }

        // TODO: Breaks bank booth collision?
        // if (this.isHollow) {
        //     this.clipType = 0;
        //     this.blocksProjectile = false;
        // }
    }

    transform(varManager: VarManager, loader: LocTypeLoader): LocType | undefined {
        if (!this.transforms) {
            return undefined;
        }

        let transformIndex = -1;
        if (this.transformVarbit !== -1) {
            transformIndex = varManager.getVarbit(this.transformVarbit);
        } else if (this.transformVarp !== -1) {
            transformIndex = varManager.getVarp(this.transformVarp);
        }

        let transformId = this.transforms[this.transforms.length - 1];
        if (transformIndex >= 0 && transformIndex < this.transforms.length - 1) {
            transformId = this.transforms[transformIndex];
        }

        if (transformId === -1) {
            return undefined;
        }
        const transformed = loader.load(transformId);
        return transformed;
    }
}
