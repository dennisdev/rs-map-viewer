import { ByteBuffer } from "../../util/ByteBuffer";
import { Definition } from "./Definition";

export class AnimationDefinition extends Definition {
    frameIds?: number[];

    chatFrameIds?: number[];

    frameLengths?: number[];

    frameSounds?: number[];

    frameStep: number;

    interleaveLeave?: number[];

    stretches: boolean;

    forcedPriority: number;

    leftHandItem: number;

    rightHandItem: number;

    maxLoops: number;

    precedenceAnimating: number;

    priority: number;

    replyMode: number;

    animMayaId: number;

    animMayaFrameSounds?: Map<number, number>;

    animMayaStart: number;

    animMayaEnd: number;

    animMayaMasks?: boolean[];

    constructor(id: number) {
        super(id);
        this.frameStep = -1;
        this.stretches = false;
        this.forcedPriority = 5;
        this.leftHandItem = -1;
        this.rightHandItem = -1;
        this.maxLoops = 99;
        this.precedenceAnimating = -1;
        this.priority = -1;
        this.replyMode = 2;
        this.animMayaId = -1;
        this.animMayaStart = 0;
        this.animMayaEnd = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            const count = buffer.readUnsignedShort();
            this.frameLengths = new Array(count);

            for (let i = 0; i < count; i++) {
                this.frameLengths[i] = buffer.readUnsignedShort();
            }

            this.frameIds = new Array(count);

            for (let i = 0; i < count; i++) {
                this.frameIds[i] = buffer.readUnsignedShort();
            }
            for (let i = 0; i < count; i++) {
                this.frameIds[i] += buffer.readUnsignedShort() << 16;
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
        } else if (opcode === 9) {
            this.precedenceAnimating = buffer.readUnsignedByte();
        } else if (opcode === 10) {
            this.priority = buffer.readUnsignedByte();
        } else if (opcode === 11) {
            this.replyMode = buffer.readUnsignedByte();
        } else if (opcode === 12) {
            const count = buffer.readUnsignedByte();
            this.chatFrameIds = new Array(count);

            for (let i = 0; i < count; i++) {
                this.chatFrameIds[i] = buffer.readUnsignedShort();
            }
            for (let i = 0; i < count; i++) {
                this.chatFrameIds[i] += buffer.readUnsignedShort() << 16;
            }
        } else if (opcode === 13) {
            const count = buffer.readUnsignedByte();
            this.frameSounds = new Array(count);

            for (let i = 0; i < count; i++) {
                this.frameSounds[i] = buffer.readMedium();
            }
        } else if (opcode === 14) {
            this.animMayaId = buffer.readInt();
        } else if (opcode === 15) {
            const count = buffer.readUnsignedShort();
            this.animMayaFrameSounds = new Map();

            for (let i = 0; i < count; i++) {
                const frame = buffer.readUnsignedShort();
                const sound = buffer.readMedium();
                this.animMayaFrameSounds.set(frame, sound);
            }
        } else if (opcode === 16) {
            this.animMayaStart = buffer.readUnsignedShort();
            this.animMayaEnd = buffer.readUnsignedShort();
        } else if (opcode === 17) {
            const count = buffer.readUnsignedByte();

            this.animMayaMasks = new Array(256).fill(false);

            for (let i = 0; i < count; i++) {
                this.animMayaMasks[buffer.readUnsignedByte()] = true;
            }
        } else {
            throw new Error('AnimationDefinition: Opcode ' + opcode + ' not implemented.');
        }
    }

    isAnimMaya(): boolean {
        return this.animMayaId >= 0;
    }
}
