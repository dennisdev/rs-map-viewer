import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { ParamsMap, Type } from "../Type";
import { BasTypeLoader } from "../bastype/BasTypeLoader";
import { VarManager } from "../vartype/VarManager";
import { NpcTypeLoader } from "./NpcTypeLoader";

export class NpcType extends Type {
    name: string;

    size: number;

    modelIds!: number[];
    chatheadModelIds!: number[];
    idleSeqId: number;
    turnLeftSeqId: number;
    turnRightSeqId: number;

    walkSeqId: number;
    walkBackSeqId: number;
    walkLeftSeqId: number;
    walkRightSeqId: number;

    recolorFrom!: number[];
    recolorTo!: number[];

    retextureFrom!: number[];
    retextureTo!: number[];

    actions: string[];

    drawMapDot: boolean;

    combatLevel: number;

    widthScale: number;
    heightScale: number;

    isVisible: boolean;

    ambient: number;
    contrast: number;

    headIconPrayer: number;
    headIconSpriteIds?: number[];
    headIconSpriteIndices?: number[];

    rotationSpeed: number;

    transforms!: number[];
    transformVarbit: number;
    transformVarp: number;

    isInteractable: boolean;
    isClickable: boolean;
    isFollower: boolean;

    runSeqId: number;
    runBackSeqId: number;
    runLeftSeqId: number;
    runRightSeqId: number;

    crawlSeqId: number;
    crawlBackSeqId: number;
    crawlLeftSeqId: number;
    crawlRightSeqId: number;

    category: number;

    loginScreenProps: number;
    spawnDirection: number;

    basTypeId: number;

    params!: ParamsMap;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.name = "null";
        this.size = 1;
        this.idleSeqId = -1;
        this.turnLeftSeqId = -1;
        this.turnRightSeqId = -1;
        this.walkSeqId = -1;
        this.walkBackSeqId = -1;
        this.walkLeftSeqId = -1;
        this.walkRightSeqId = -1;
        this.actions = new Array<string>(5);
        this.drawMapDot = true;
        this.combatLevel = -1;
        this.widthScale = 128;
        this.heightScale = 128;
        this.isVisible = false;
        this.ambient = 0;
        this.contrast = 0;
        this.headIconPrayer = -1;
        this.rotationSpeed = 32;
        this.transformVarbit = -1;
        this.transformVarp = -1;
        this.isInteractable = true;
        this.isClickable = true;
        this.isFollower = false;
        this.runSeqId = -1;
        this.runBackSeqId = -1;
        this.runLeftSeqId = -1;
        this.runRightSeqId = -1;
        this.crawlSeqId = -1;
        this.crawlBackSeqId = -1;
        this.crawlLeftSeqId = -1;
        this.crawlRightSeqId = -1;
        this.category = -1;
        this.loginScreenProps = 0;
        // this.spawnDirection = 7;
        this.spawnDirection = 6;
        this.basTypeId = -1;
    }

    isLargeModelId(): boolean {
        return this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 670;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            const count = buffer.readUnsignedByte();
            this.modelIds = new Array<number>(count);

            if (this.isLargeModelId()) {
                for (let i = 0; i < count; i++) {
                    this.modelIds[i] = buffer.readBigSmart();
                }
            } else {
                for (let i = 0; i < count; i++) {
                    this.modelIds[i] = buffer.readUnsignedShort();
                }
            }
        } else if (opcode === 2) {
            this.name = this.readString(buffer);
        } else if (opcode === 3) {
            // desc
            this.readString(buffer);
        } else if (opcode === 12) {
            this.size = buffer.readUnsignedByte();
        } else if (opcode === 13) {
            this.idleSeqId = buffer.readUnsignedShort();
        } else if (opcode === 14) {
            this.walkSeqId = buffer.readUnsignedShort();
        } else if (opcode === 15) {
            this.turnLeftSeqId = buffer.readUnsignedShort();
        } else if (opcode === 16) {
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision < 254) {
                // disposeAlpha?
            } else {
                this.turnRightSeqId = buffer.readUnsignedShort();
            }
        } else if (opcode === 17) {
            this.walkSeqId = buffer.readUnsignedShort();
            this.walkBackSeqId = buffer.readUnsignedShort();
            this.walkLeftSeqId = buffer.readUnsignedShort();
            this.walkRightSeqId = buffer.readUnsignedShort();
        } else if (opcode === 18) {
            this.category = buffer.readUnsignedShort();
        } else if (opcode >= 30 && opcode < 35) {
            this.actions[opcode - 30] = this.readString(buffer);
            if (this.actions[opcode - 30].toLowerCase() === "hidden") {
                delete this.actions[opcode - 30];
            }
        } else if (opcode === 40) {
            const count = buffer.readUnsignedByte();
            this.recolorFrom = new Array<number>(count);
            this.recolorTo = new Array<number>(count);

            for (let i = 0; i < count; i++) {
                this.recolorFrom[i] = buffer.readUnsignedShort();
                this.recolorTo[i] = buffer.readUnsignedShort();
            }
        } else if (opcode === 41) {
            const count = buffer.readUnsignedByte();
            this.retextureFrom = new Array<number>(count);
            this.retextureTo = new Array<number>(count);

            for (let i = 0; i < count; i++) {
                this.retextureFrom[i] = buffer.readUnsignedShort();
                this.retextureTo[i] = buffer.readUnsignedShort();
            }
        } else if (opcode === 44 || opcode === 45) {
            buffer.readUnsignedShort();
        } else if (opcode === 60) {
            const count = buffer.readUnsignedByte();
            this.chatheadModelIds = new Array<number>(count);

            if (this.isLargeModelId()) {
                for (let i = 0; i < count; i++) {
                    this.chatheadModelIds[i] = buffer.readBigSmart();
                }
            } else {
                for (let i = 0; i < count; i++) {
                    this.chatheadModelIds[i] = buffer.readUnsignedShort();
                }
            }
        } else if (opcode >= 74 && opcode <= 79) {
            // stats
            buffer.readUnsignedShort();
        } else if (opcode === 93) {
            this.drawMapDot = false;
        } else if (opcode === 95) {
            this.combatLevel = buffer.readUnsignedShort();
        } else if (opcode === 97) {
            this.widthScale = buffer.readUnsignedShort();
        } else if (opcode === 98) {
            this.heightScale = buffer.readUnsignedShort();
        } else if (opcode === 99) {
            this.isVisible = true;
        } else if (opcode === 100) {
            this.ambient = buffer.readByte();
        } else if (opcode === 101) {
            this.contrast = buffer.readByte() * 5;
        } else if (opcode === 102) {
            if (
                (this.cacheInfo.game === "oldschool" && this.cacheInfo.revision < 210) ||
                this.cacheInfo.game === "runescape"
            ) {
                this.headIconPrayer = buffer.readUnsignedShort();
            } else {
                const flag = buffer.readUnsignedByte();
                let count = 0;
                for (let n = flag; n !== 0; n >>= 1) {
                    count++;
                }

                this.headIconSpriteIds = new Array(count);
                this.headIconSpriteIndices = new Array(count);

                for (let i = 0; i < count; i++) {
                    if ((flag & 1) << i === 0) {
                        this.headIconSpriteIds[i] = -1;
                        this.headIconSpriteIndices[i] = -1;
                    } else {
                        this.headIconSpriteIds[i] = buffer.readBigSmart();
                        this.headIconSpriteIndices[i] = buffer.readUnsignedSmartMin1();
                    }
                }
            }
        } else if (opcode === 103) {
            this.rotationSpeed = buffer.readUnsignedShort();
        } else if (opcode === 106 || opcode === 118) {
            this.transformVarbit = buffer.readUnsignedShort();
            if (this.transformVarbit === 65535) {
                this.transformVarbit = -1;
            }

            this.transformVarp = buffer.readUnsignedShort();
            if (this.transformVarp === 65535) {
                this.transformVarp = -1;
            }

            let var3 = -1;
            if (opcode === 118) {
                var3 = buffer.readUnsignedShort();
                if (var3 === 65535) {
                    var3 = -1;
                }
            }

            const count = buffer.readUnsignedByte();
            this.transforms = new Array<number>(count + 2);

            for (let i = 0; i <= count; i++) {
                this.transforms[i] = buffer.readUnsignedShort();
                if (this.transforms[i] === 65535) {
                    this.transforms[i] = -1;
                }
            }

            this.transforms[count + 1] = var3;
        } else if (opcode === 107) {
            this.isInteractable = false;
        } else if (opcode === 109) {
            this.isClickable = false;
        } else if (opcode === 111) {
            if (this.cacheInfo.game === "oldschool") {
                this.isFollower = true;
            } else {
                // hasShadow = false
            }
        } else if (opcode === 112) {
            // old
        } else if (opcode === 113) {
            const shadowColor1 = buffer.readUnsignedShort();
            const shadowColor2 = buffer.readUnsignedShort();
        } else if (opcode === 114) {
            if (this.cacheInfo.game === "oldschool") {
                this.runSeqId = buffer.readUnsignedShort();
            } else {
                const shadowColorMod1 = buffer.readByte();
                const shadowColorMod2 = buffer.readByte();
            }
        } else if (opcode === 115) {
            if (this.cacheInfo.game === "oldschool") {
                this.runSeqId = buffer.readUnsignedShort();
                this.runBackSeqId = buffer.readUnsignedShort();
                this.runLeftSeqId = buffer.readUnsignedShort();
                this.runRightSeqId = buffer.readUnsignedShort();
            } else {
                buffer.readUnsignedByte();
                buffer.readUnsignedByte();
            }
        } else if (opcode === 116) {
            this.crawlSeqId = buffer.readUnsignedShort();
        } else if (opcode === 117) {
            this.crawlSeqId = buffer.readUnsignedShort();
            this.crawlBackSeqId = buffer.readUnsignedShort();
            this.crawlLeftSeqId = buffer.readUnsignedShort();
            this.crawlRightSeqId = buffer.readUnsignedShort();
        } else if (opcode === 119) {
            this.loginScreenProps = buffer.readByte();
        } else if (opcode === 121) {
            const modelOffsets = new Array<number[]>(this.modelIds.length);
            const count = buffer.readUnsignedByte();
            for (let i = 0; i < count; i++) {
                const index = buffer.readUnsignedByte();
                const offsets = (modelOffsets[index] = new Array(3));
                offsets[0] = buffer.readByte();
                offsets[1] = buffer.readByte();
                offsets[2] = buffer.readByte();
            }
        } else if (opcode === 122) {
            if (this.cacheInfo.game === "oldschool") {
                this.isFollower = true;
            } else {
                if (this.isLargeModelId()) {
                    const hitBarSpriteId = buffer.readBigSmart();
                } else {
                    const hitBarSpriteId = buffer.readUnsignedShort();
                }
            }
        } else if (opcode === 123) {
            if (this.cacheInfo.game === "oldschool") {
                // lowPriorityFollowerOps = true;
            } else {
                const iconHeight = buffer.readUnsignedShort();
            }
        } else if (opcode === 125) {
            this.spawnDirection = buffer.readByte();
        } else if (opcode === 127) {
            this.basTypeId = buffer.readUnsignedShort();
        } else if (opcode === 128) {
            buffer.readUnsignedByte();
        } else if (opcode === 134) {
            const idleSound = buffer.readUnsignedShort();
            const crawlSound = buffer.readUnsignedShort();
            const walkSound = buffer.readUnsignedShort();
            const runSound = buffer.readUnsignedShort();
            const soundRadius = buffer.readUnsignedByte();
        } else if (opcode === 135) {
            const cursor1op = buffer.readUnsignedByte();
            const cursor1 = buffer.readUnsignedShort();
        } else if (opcode === 136) {
            const cursor2op = buffer.readUnsignedByte();
            const cursor2 = buffer.readUnsignedShort();
        } else if (opcode === 137) {
            const attackCursor = buffer.readUnsignedShort();
        } else if (opcode === 138) {
            if (this.isLargeModelId()) {
                const icon = buffer.readBigSmart();
            } else {
                const icon = buffer.readUnsignedShort();
            }
        } else if (opcode === 139) {
            if (this.isLargeModelId()) {
                const icon = buffer.readBigSmart();
            } else {
                const icon = buffer.readUnsignedShort();
            }
        } else if (opcode === 140) {
            const ambientSoundVolume = buffer.readUnsignedByte();
        } else if (opcode === 141) {
            const bool = true;
        } else if (opcode === 142) {
            const mapFunctionId = buffer.readUnsignedShort();
        } else if (opcode === 143) {
            const bool = true;
        } else if (opcode === 144) {
            buffer.readUnsignedShort();
        } else if (opcode >= 150 && opcode < 155) {
            // member only options
            this.actions[opcode - 150] = this.readString(buffer);
            const isMember = true;
            if (!isMember || this.actions[opcode - 150].toLowerCase() === "hidden") {
                delete this.actions[opcode - 150];
            }
        } else if (opcode === 155) {
            const b0 = buffer.readByte();
            const b1 = buffer.readByte();
            const b2 = buffer.readByte();
            const b3 = buffer.readByte();
        } else if (opcode === 158) {
            const b = 1;
        } else if (opcode === 159) {
            const b = 0;
        } else if (opcode === 160) {
            const count = buffer.readUnsignedByte();
            for (let i = 0; i < count; i++) {
                const v = buffer.readUnsignedShort();
            }
        } else if (opcode === 161) {
            const bool = true;
        } else if (opcode === 162) {
            const bool = true;
        } else if (opcode === 163) {
            const v = buffer.readUnsignedByte();
        } else if (opcode === 164) {
            const v0 = buffer.readUnsignedShort();
            const v1 = buffer.readUnsignedShort();
        } else if (opcode === 165) {
            const v = buffer.readUnsignedByte();
        } else if (opcode === 168) {
            const v = buffer.readUnsignedByte();
        } else if (opcode >= 170 && opcode < 176) {
            buffer.readUnsignedShort();
        } else if (opcode === 249) {
            this.params = Type.readParamsMap(buffer, this.params);
        } else {
            throw new Error(
                "NpcType: Opcode " +
                    opcode +
                    " not implemented. ID: " +
                    this.id +
                    ". cache: " +
                    this.cacheInfo,
            );
        }
    }

    getIdleSeqId(basTypeLoader: BasTypeLoader): number {
        if (this.basTypeId !== -1) {
            return basTypeLoader.load(this.basTypeId).idleSeqId;
        }
        return this.idleSeqId;
    }

    getWalkSeqId(basTypeLoader: BasTypeLoader): number {
        if (this.basTypeId !== -1) {
            return basTypeLoader.load(this.basTypeId).walkSeqId;
        }
        return this.walkSeqId;
    }

    transform(varManager: VarManager, loader: NpcTypeLoader): NpcType | undefined {
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
        return loader.load(transformId);
    }
}
