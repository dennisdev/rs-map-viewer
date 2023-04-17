import { ByteBuffer } from "../../util/ByteBuffer";
import { VarpManager } from "../../VarpManager";
import { NpcLoader } from "../loader/NpcLoader";
import { Definition, ParamsMap } from "./Definition";

export class NpcDefinition extends Definition {
    name: string;

    size: number;

    modelIds!: number[];

    chatheadModelIds!: number[];

    idleSequence: number;

    turnLeftSequence: number;

    turnRightSequence: number;

    walkSequence: number;

    walkBackSequence: number;

    walkLeftSequence: number;

    walkRightSequence: number;

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

    rotation: number;

    transforms!: number[];

    transformVarbit: number;

    transformVarp: number;

    isInteractable: boolean;

    isClickable: boolean;

    isFollower: boolean;

    runAnimation: number;

	runRotate180Animation: number;

	runRotateLeftAnimation: number;

	runRotateRightAnimation: number;

	crawlAnimation: number;

	crawlRotate180Animation: number;

	crawlRotateLeftAnimation: number;

	crawlRotateRightAnimation: number;

    params!: ParamsMap;

    constructor(id: number) {
        super(id);
        this.name = "null";
        this.size = 1;
        this.idleSequence = -1;
        this.turnLeftSequence = -1;
        this.turnRightSequence = -1;
        this.walkSequence = -1;
        this.walkBackSequence = -1;
        this.walkLeftSequence = -1;
        this.walkRightSequence = -1;
        this.actions = new Array<string>(5);
        this.drawMapDot = true;
        this.combatLevel = -1;
        this.widthScale = 128;
        this.heightScale = 128;
        this.isVisible = false;
        this.ambient = 0;
        this.contrast = 0;
        this.headIconPrayer = -1;
        this.rotation = 32;
        this.transformVarbit = -1;
        this.transformVarp = -1;
        this.isInteractable = true;
        this.isClickable = true;
        this.isFollower = false;
        this.runAnimation = -1;
        this.runRotate180Animation = -1;
        this.runRotateLeftAnimation = -1;
        this.runRotateRightAnimation = -1;
        this.crawlAnimation = -1;
        this.crawlRotate180Animation = -1;
        this.crawlRotateLeftAnimation = -1;
        this.crawlRotateRightAnimation = -1;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode == 1) {
            const count = buffer.readUnsignedByte();
            this.modelIds = new Array<number>(count);

            for (let i = 0; i < count; i++) {
                this.modelIds[i] = buffer.readUnsignedShort();
            }
        } else if (opcode == 2) {
            this.name = buffer.readString();
        } else if (opcode == 12) {
            this.size = buffer.readUnsignedByte();
        } else if (opcode == 13) {
            this.idleSequence = buffer.readUnsignedShort();
        } else if (opcode == 14) {
            this.walkSequence = buffer.readUnsignedShort();
        } else if (opcode == 15) {
            this.turnLeftSequence = buffer.readUnsignedShort();
        } else if (opcode == 16) {
            this.turnRightSequence = buffer.readUnsignedShort();
        } else if (opcode == 17) {
            this.walkSequence = buffer.readUnsignedShort();
            this.walkBackSequence = buffer.readUnsignedShort();
            this.walkLeftSequence = buffer.readUnsignedShort();
            this.walkRightSequence = buffer.readUnsignedShort();
        } else if (opcode == 18) {
            buffer.readUnsignedShort();
        } else if (opcode >= 30 && opcode < 35) {
            this.actions[opcode - 30] = buffer.readString();
            if (this.actions[opcode - 30].toLowerCase() === "hidden") {
                delete this.actions[opcode - 30];
            }
        } else if (opcode == 40) {
            const count = buffer.readUnsignedByte();
            this.recolorFrom = new Array<number>(count);
            this.recolorTo = new Array<number>(count);

            for (let i = 0; i < count; i++) {
                this.recolorFrom[i] = buffer.readUnsignedShort();
                this.recolorTo[i] = buffer.readUnsignedShort();
            }
        } else if (opcode == 41) {
            const count = buffer.readUnsignedByte();
            this.retextureFrom = new Array<number>(count);
            this.retextureTo = new Array<number>(count);

            for (let i = 0; i < count; i++) {
                this.retextureFrom[i] = buffer.readUnsignedShort();
                this.retextureTo[i] = buffer.readUnsignedShort();
            }
        } else if (opcode == 60) {
            const count = buffer.readUnsignedByte();
            this.chatheadModelIds = new Array<number>(count);

            for (let i = 0; i < count; i++) {
                this.chatheadModelIds[i] = buffer.readUnsignedShort();
            }
        } else if (opcode == 93) {
            this.drawMapDot = false;
        } else if (opcode == 95) {
            this.combatLevel = buffer.readUnsignedShort();
        } else if (opcode == 97) {
            this.widthScale = buffer.readUnsignedShort();
        } else if (opcode == 98) {
            this.heightScale = buffer.readUnsignedShort();
        } else if (opcode == 99) {
            this.isVisible = true;
        } else if (opcode == 100) {
            this.ambient = buffer.readByte();
        } else if (opcode == 101) {
            this.contrast = buffer.readByte() * 5;
        } else if (opcode == 102) {
            this.headIconPrayer = buffer.readUnsignedShort();
        } else if (opcode == 103) {
            this.rotation = buffer.readUnsignedShort();
        } else if (opcode == 106 || opcode == 118) {
            this.transformVarbit = buffer.readUnsignedShort();
            if (this.transformVarbit == 65535) {
                this.transformVarbit = -1;
            }

            this.transformVarp = buffer.readUnsignedShort();
            if (this.transformVarp == 65535) {
                this.transformVarp = -1;
            }

            let var3 = -1;
            if (opcode == 118) {
                var3 = buffer.readUnsignedShort();
                if (var3 == 65535) {
                    var3 = -1;
                }
            }

            const count = buffer.readUnsignedByte();
            this.transforms = new Array<number>(count + 2);

            for (let i = 0; i <= count; i++) {
                this.transforms[i] = buffer.readUnsignedShort();
                if (this.transforms[i] == 65535) {
                    this.transforms[i] = -1;
                }
            }

            this.transforms[count + 1] = var3;
        } else if (opcode == 107) {
            this.isInteractable = false;
        } else if (opcode == 109) {
            this.isClickable = false;
        } else if (opcode == 111) {
            this.isFollower = true;
        } else if (opcode == 114) {
            this.runAnimation = buffer.readUnsignedShort();
        } else if (opcode == 115) {
            this.runAnimation = buffer.readUnsignedShort();
			this.runRotate180Animation = buffer.readUnsignedShort();
			this.runRotateLeftAnimation = buffer.readUnsignedShort();
			this.runRotateRightAnimation = buffer.readUnsignedShort();
        } else if (opcode == 116) {
            this.crawlAnimation = buffer.readUnsignedShort();
        } else if (opcode == 117) {
			this.crawlAnimation = buffer.readUnsignedShort();
			this.crawlRotate180Animation = buffer.readUnsignedShort();
			this.crawlRotateLeftAnimation = buffer.readUnsignedShort();
			this.crawlRotateRightAnimation = buffer.readUnsignedShort();
        } else if (opcode == 249) {
            this.params = Definition.readParamsMap(buffer, this.params);
        } else {
            throw new Error('NpcDefinition: Opcode ' + opcode + ' not implemented.');
        }
    }

    transform(varpManager: VarpManager, npcLoader: NpcLoader): NpcDefinition | undefined {
        if (!this.transforms) {
            return undefined;
        }

        let transformIndex = -1;
        if (this.transformVarbit !== -1) {
            transformIndex = varpManager.getVarbit(this.transformVarbit);
        } else if (this.transformVarp !== -1) {
            transformIndex = varpManager.getVarp(this.transformVarp);
        }

        let transformId = this.transforms[this.transforms.length - 1];
        if (transformIndex >= 0 && transformIndex < this.transforms.length - 1) {
            transformId = this.transforms[transformIndex];
        }

        if (transformId === -1) {
            return undefined;
        }
        return npcLoader.getDefinition(transformId);
    }
}
