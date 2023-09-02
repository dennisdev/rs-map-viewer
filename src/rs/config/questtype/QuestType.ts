import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { ParamsMap, Type } from "../Type";

export class QuestVar {
    constructor(
        readonly id: number,
        readonly inProgressValue: number,
        readonly completedValue: number,
    ) {}
}

export class QuestSkillReq {
    constructor(
        readonly id: number,
        readonly level: number,
    ) {}
}

export class QuestType extends Type {
    name?: string;
    sortName?: string;

    varps?: QuestVar[];
    varbits?: QuestVar[];

    type: number;
    difficulty: number;

    member: boolean;

    points: number;

    questRequirements?: number[];
    skillRequirements?: QuestSkillReq[];
    pointsRequirement: number;

    paramsMap?: ParamsMap;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.type = 0;
        this.difficulty = 0;
        this.member = false;
        this.points = 0;
        this.pointsRequirement = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.name = buffer.readVerString();
        } else if (opcode === 2) {
            this.sortName = buffer.readVerString();
        } else if (opcode === 3) {
            const count = buffer.readUnsignedByte();
            this.varps = new Array(count);
            for (let i = 0; i < count; i++) {
                const id = buffer.readUnsignedShort();
                const inProgressValue = buffer.readInt();
                const completedValue = buffer.readInt();
                this.varps[i] = new QuestVar(id, inProgressValue, completedValue);
            }
        } else if (opcode === 4) {
            const count = buffer.readUnsignedByte();
            this.varbits = new Array(count);
            for (let i = 0; i < count; i++) {
                const id = buffer.readUnsignedShort();
                const inProgressValue = buffer.readInt();
                const completedValue = buffer.readInt();
                this.varbits[i] = new QuestVar(id, inProgressValue, completedValue);
            }
        } else if (opcode === 5) {
            buffer.readUnsignedShort();
        } else if (opcode === 6) {
            this.type = buffer.readUnsignedByte();
        } else if (opcode === 7) {
            this.difficulty = buffer.readUnsignedByte();
        } else if (opcode === 8) {
            this.member = true;
        } else if (opcode === 9) {
            this.points = buffer.readUnsignedByte();
        } else if (opcode === 10) {
            const count = buffer.readUnsignedByte();
            for (let i = 0; i < count; i++) {
                buffer.readInt();
            }
        } else if (opcode === 12) {
            buffer.readInt();
        } else if (opcode === 13) {
            const count = buffer.readUnsignedByte();
            this.questRequirements = new Array(count);
            for (let i = 0; i < count; i++) {
                this.questRequirements[i] = buffer.readUnsignedShort();
            }
        } else if (opcode === 14) {
            const count = buffer.readUnsignedByte();
            this.skillRequirements = new Array(count);
            for (let i = 0; i < count; i++) {
                const id = buffer.readUnsignedByte();
                const level = buffer.readUnsignedByte();
                this.skillRequirements[i] = new QuestSkillReq(id, level);
            }
        } else if (opcode === 15) {
            this.pointsRequirement = buffer.readUnsignedShort();
        } else if (opcode === 17) {
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 670) {
                const iconId = buffer.readBigSmart();
            } else {
                const iconId = buffer.readUnsignedShort();
            }
        } else if (opcode === 18) {
            const count = buffer.readUnsignedByte();
            for (let i = 0; i < count; i++) {
                buffer.readInt();
                buffer.readInt();
                buffer.readInt();
                buffer.readString();
            }
        } else if (opcode === 19) {
            const count = buffer.readUnsignedByte();
            for (let i = 0; i < count; i++) {
                buffer.readInt();
                buffer.readInt();
                buffer.readInt();
                buffer.readString();
            }
        } else if (opcode === 249) {
            this.paramsMap = Type.readParamsMap(buffer);
        } else {
            throw new Error("QuestType: Opcode " + opcode + " not implemented. id: " + this.id);
        }
    }

    override post(): void {
        if (this.sortName === undefined) {
            this.sortName = this.name;
        }
    }
}
