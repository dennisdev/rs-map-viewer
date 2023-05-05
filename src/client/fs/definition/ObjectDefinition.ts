import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition, ParamsMap } from "./Definition";

export class ObjectDefinition extends Definition {
    public static readonly DEFAULT_DECOR_DISPLACEMENT: number = 16;

    lowDetail: boolean;

    objectModels!: number[];

    objectTypes?: number[];

    name: string;

    recolorFrom!: number[];

    recolorTo!: number[];

    retextureFrom!: number[];

    retextureTo!: number[];

    sizeX: number;

    sizeY: number;

    clipType: number;

    blocksProjectile: boolean;

    int1: number;

    contouredGround: number;

    mergeNormals: boolean;

    modelClipped: boolean;

    animationId: number;

    decorDisplacement: number;

    ambient: number;

    contrast: number;

    actions: string[];

    mapIconId: number;

    mapSceneId: number;

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

    randomAnimStartFrame: boolean;

    params!: ParamsMap;

    constructor(id: number, revision: number) {
        super(id, revision);
        this.lowDetail = false;
        this.name = "null";
        this.sizeX = 1;
        this.sizeY = 1;
        this.clipType = 2;
        this.blocksProjectile = true;
        this.int1 = -1;
        this.contouredGround = -1;
        this.mergeNormals = false;
        this.modelClipped = false;
        this.animationId = -1;
        this.decorDisplacement = ObjectDefinition.DEFAULT_DECOR_DISPLACEMENT;
        this.ambient = 0;
        this.contrast = 0;
        this.actions = new Array(5);
        this.mapIconId = -1;
        this.mapSceneId = -1;
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
        this.randomAnimStartFrame = true;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            const count = buffer.readUnsignedByte();
            if (count > 0) {
                if (this.objectModels && !this.lowDetail) {
                    buffer.offset += 3 * count;
                } else {
                    this.objectTypes = new Array(count);
                    this.objectModels = new Array(count);

                    for (let i = 0; i < count; i++) {
                        this.objectModels[i] = buffer.readUnsignedShort();
                        this.objectTypes[i] = buffer.readUnsignedByte();
                    }
                }
            }
        } else if (opcode === 2) {
            this.name = buffer.readString();
        } else if (opcode === 5) {
            const count = buffer.readUnsignedByte();
            if (count > 0) {
                if (this.objectModels && !this.lowDetail) {
                    buffer.offset += count * 2;
                } else {
                    this.objectTypes = undefined;
                    this.objectModels = new Array(count);

                    for (let i = 0; i < count; i++) {
                        this.objectModels[i] = buffer.readUnsignedShort();
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
            this.int1 = buffer.readUnsignedByte();
        } else if (opcode === 21) {
            this.contouredGround = 0;
        } else if (opcode === 22) {
            this.mergeNormals = true;
        } else if (opcode === 23) {
            this.modelClipped = true;
        } else if (opcode === 24) {
            this.animationId = buffer.readUnsignedShort();
            if (this.animationId === 65535) {
                this.animationId = -1;
            }
        } else if (opcode === 27) {
            this.clipType = 1;
        } else if (opcode === 28) {
            this.decorDisplacement = buffer.readUnsignedByte();
        } else if (opcode === 29) {
            this.ambient = buffer.readByte();
        } else if (opcode === 39) {
            this.contrast = buffer.readByte() * 25;
        } else if (opcode >= 30 && opcode < 35) {
            this.actions[opcode - 30] = buffer.readString();
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
        } else if (opcode === 60) {
            // old
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
                var3 = buffer.readUnsignedShort();
                if (var3 === 65535) {
                    var3 = -1;
                }
            }

            const count = buffer.readUnsignedByte();
            this.transforms = new Array(count + 2);

            for (let i = 0; i <= count; i++) {
                this.transforms[i] = buffer.readUnsignedShort();
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
        } else if (opcode === 82) {
            this.mapIconId = buffer.readUnsignedShort();
        } else if (opcode === 89) {
            this.randomAnimStartFrame = false;
        } else if (opcode === 249) {
            this.params = Definition.readParamsMap(buffer, this.params);
        } else {
            throw new Error(
                "ObjectDefinition: Opcode " + opcode + " not implemented."
            );
        }
    }

    override post(): void {
        if (this.int1 === -1) {
            this.int1 = 0;
            if (
                this.objectModels &&
                (!this.objectTypes || this.objectTypes[0] === 10)
            ) {
                this.int1 = 1;
            }

            for (let i = 0; i < 5; i++) {
                if (this.actions[i]) {
                    this.int1 = 1;
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
}
