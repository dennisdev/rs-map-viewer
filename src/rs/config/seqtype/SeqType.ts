import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { SeqFrameLoader } from "../../model/seq/SeqFrameLoader";
import { Type } from "../Type";

export class SeqType extends Type {
    frameIds!: number[];
    chatFrameIds?: number[];
    frameLengths!: number[];
    frameSounds?: number[];

    frameStep: number;

    interleaveLeave?: number[];

    stretches: boolean;

    forcedPriority: number;

    leftHandItem: number;
    rightHandItem: number;

    maxLoops: number;

    looping: boolean;

    precedenceAnimating: number;

    priority: number;

    replyMode: number;

    animMayaId: number;
    animMayaFrameSounds?: Map<number, number>;
    animMayaStart: number;
    animMayaEnd: number;
    animMayaMasks?: boolean[];

    op14: boolean;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.frameStep = -1;
        this.stretches = false;
        this.forcedPriority = 5;
        this.leftHandItem = -1;
        this.rightHandItem = -1;
        this.maxLoops = 99;
        this.looping = false;
        this.precedenceAnimating = -1;
        this.priority = -1;
        this.replyMode = 2;
        this.animMayaId = -1;
        this.animMayaStart = 0;
        this.animMayaEnd = 0;
        this.op14 = false;
    }

    getFrameLength(seqFrameLoader: SeqFrameLoader, frame: number): number {
        let frameLength = this.frameLengths[frame];

        if (this.cacheType === "dat") {
            if (frameLength === 0) {
                const animFrame = seqFrameLoader.load(this.frameIds[frame]);
                if (animFrame) {
                    frameLength = this.frameLengths[frame] = animFrame.frameLength;
                }
            }

            if (frameLength === 0) {
                frameLength = 1;
            }
        }

        return frameLength;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            let count = 0;
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision < 456) {
                count = buffer.readUnsignedByte();
            } else {
                count = buffer.readUnsignedShort();
            }
            this.frameIds = new Array(count);
            this.frameLengths = new Array(count);

            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision <= 377) {
                for (let i = 0; i < count; i++) {
                    this.frameIds[i] = buffer.readUnsignedShort();
                    // used by widgets
                    buffer.readUnsignedShort();
                    this.frameLengths[i] = buffer.readUnsignedShort();
                }
            } else {
                for (let i = 0; i < count; i++) {
                    this.frameLengths[i] = buffer.readUnsignedShort();
                }
                for (let i = 0; i < count; i++) {
                    this.frameIds[i] = buffer.readUnsignedShort();
                }
                for (let i = 0; i < count; i++) {
                    this.frameIds[i] += buffer.readUnsignedShort() << 16;
                }
            }
        } else if (opcode === 2) {
            this.frameStep = buffer.readUnsignedShort();
        } else if (opcode === 3) {
            const count = buffer.readUnsignedByte();
            this.interleaveLeave = new Array(count + 1);
            for (let i = 0; i < count; i++) {
                this.interleaveLeave[i] = buffer.readUnsignedByte();
            }
            this.interleaveLeave[count] = 9999999;
        } else if (opcode === 4) {
            this.stretches = true;
        } else if (opcode === 5) {
            this.forcedPriority = buffer.readUnsignedByte();
        } else if (opcode === 6) {
            this.leftHandItem = buffer.readUnsignedShort();
        } else if (opcode === 7) {
            this.rightHandItem = buffer.readUnsignedShort();
        } else if (opcode === 8) {
            this.maxLoops = buffer.readUnsignedByte();
            this.looping = true;
        } else if (opcode === 9) {
            this.precedenceAnimating = buffer.readUnsignedByte();
        } else if (opcode === 10) {
            this.priority = buffer.readUnsignedByte();
        } else if (opcode === 11) {
            this.replyMode = buffer.readUnsignedByte();
        } else if (opcode === 12) {
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision <= 377) {
                buffer.readInt();
            } else {
                const count = buffer.readUnsignedByte();
                this.chatFrameIds = new Array(count);

                for (let i = 0; i < count; i++) {
                    this.chatFrameIds[i] = buffer.readUnsignedShort();
                }
                for (let i = 0; i < count; i++) {
                    this.chatFrameIds[i] += buffer.readUnsignedShort() << 16;
                }
            }
        } else if (opcode === 13) {
            // might be wrong start revision
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 508) {
                const count = buffer.readUnsignedShort();
                for (let i = 0; i < count; i++) {
                    const effectCount = buffer.readUnsignedByte();
                    if (effectCount > 0) {
                        buffer.readMedium();
                        for (let e = 1; e < effectCount; e++) {
                            buffer.readUnsignedShort();
                        }
                    }
                }
            } else {
                const count = buffer.readUnsignedByte();
                this.frameSounds = new Array(count);

                for (let i = 0; i < count; i++) {
                    this.frameSounds[i] = buffer.readMedium();
                }
            }
        } else if (opcode === 14) {
            if (this.cacheInfo.game === "oldschool") {
                this.animMayaId = buffer.readInt();
            } else {
                this.op14 = true;
            }
        } else if (opcode === 15) {
            if (this.cacheInfo.game === "oldschool") {
                const count = buffer.readUnsignedShort();
                this.animMayaFrameSounds = new Map();

                for (let i = 0; i < count; i++) {
                    const frame = buffer.readUnsignedShort();
                    const sound = buffer.readMedium();
                    this.animMayaFrameSounds.set(frame, sound);
                }
            } else {
                // interpolate = true;
            }
        } else if (opcode === 16) {
            if (this.cacheInfo.game === "oldschool") {
                this.animMayaStart = buffer.readUnsignedShort();
                this.animMayaEnd = buffer.readUnsignedShort();
            } else {
                // bool = true;
            }
        } else if (opcode === 17) {
            if (this.cacheInfo.game === "oldschool") {
                const count = buffer.readUnsignedByte();

                this.animMayaMasks = new Array(256).fill(false);

                for (let i = 0; i < count; i++) {
                    this.animMayaMasks[buffer.readUnsignedByte()] = true;
                }
            } else {
                const v = buffer.readUnsignedByte();
            }
        } else if (opcode === 18) {
            const b = true;
        } else if (opcode === 19) {
            const index = buffer.readUnsignedByte();
            const value = buffer.readUnsignedByte();
        } else if (opcode === 20) {
            const index = buffer.readUnsignedByte();
            const max = buffer.readUnsignedShort();
            const min = buffer.readUnsignedShort();
        } else {
            throw new Error("SeqType: Opcode " + opcode + " not implemented.");
        }
    }

    isAnimMaya(): boolean {
        return this.animMayaId >= 0;
    }
}
