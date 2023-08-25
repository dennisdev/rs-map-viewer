import { ByteBuffer } from "../../io/ByteBuffer";
import { Type } from "../Type";

export class BasType extends Type {
    idleSeqId = -1;
    walkSeqId = -1;

    modelRotateTranslate?: number[][];

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.idleSeqId = buffer.readUnsignedShort();
            this.walkSeqId = buffer.readUnsignedShort();
            if (this.idleSeqId === 0xffff) {
                this.idleSeqId = -1;
            }
            if (this.walkSeqId === 0xffff) {
                this.walkSeqId = -1;
            }
        } else if (opcode === 2) {
            const crawlSeqId = buffer.readUnsignedShort();
        } else if (opcode === 3) {
            const crawlBackSeqId = buffer.readUnsignedShort();
        } else if (opcode === 4) {
            const crawlLeftSeqId = buffer.readUnsignedShort();
        } else if (opcode === 5) {
            const crawlRightSeqId = buffer.readUnsignedShort();
        } else if (opcode === 6) {
            const runSeqId = buffer.readUnsignedShort();
        } else if (opcode === 7) {
            const runBackSeqId = buffer.readUnsignedShort();
        } else if (opcode === 8) {
            const runLeftSeqId = buffer.readUnsignedShort();
        } else if (opcode === 9) {
            const runRightSeqId = buffer.readUnsignedShort();
        } else if (opcode === 26) {
            const anInt1059 = buffer.readUnsignedByte() * 4;
            const anInt1050 = buffer.readUnsignedByte() * 4;
        } else if (opcode === 27) {
            if (!this.modelRotateTranslate) {
                this.modelRotateTranslate = new Array(12);
            }
            const bodyPartId = buffer.readUnsignedByte();
            this.modelRotateTranslate[bodyPartId] = new Array(6);
            for (let type = 0; type < 6; type++) {
                /*
                 * 0 -Rotate X
                 * 1 - Rotate Y
                 * 2 - Rotate Z
                 * 3 - Translate X
                 * 4 - Translate Y
                 * 5 - Translate Z
                 */
                this.modelRotateTranslate[bodyPartId][type] = buffer.readShort();
            }
        } else if (opcode === 29) {
            const yawAcceleration = buffer.readUnsignedByte();
        } else if (opcode === 30) {
            const yawMaxSpeed = buffer.readUnsignedShort();
        } else if (opcode === 31) {
            const rollAcceleration = buffer.readUnsignedByte();
        } else if (opcode === 32) {
            const rollMaxSpeed = buffer.readUnsignedShort();
        } else if (opcode === 33) {
            const rollTargetAngle = buffer.readShort();
        } else if (opcode === 34) {
            const pitchAcceleration = buffer.readUnsignedByte();
        } else if (opcode === 35) {
            const pitchMaxSpeed = buffer.readUnsignedShort();
        } else if (opcode === 36) {
            const pitchTargetAngle = buffer.readShort();
        } else if (opcode === 37) {
            const movementAcceleration = buffer.readUnsignedByte();
        } else if (opcode === 38) {
            const idleLeftSeqId = buffer.readUnsignedShort();
        } else if (opcode === 39) {
            const idleRightSeqId = buffer.readUnsignedShort();
        } else if (opcode === 40) {
            const walkBackSeqId = buffer.readUnsignedShort();
        } else if (opcode === 41) {
            const walkLeftSeqId = buffer.readUnsignedShort();
        } else if (opcode === 42) {
            const walkRightSeqId = buffer.readUnsignedShort();
        } else if (opcode === 43) {
            buffer.readUnsignedShort();
        } else if (opcode === 44) {
            buffer.readUnsignedShort();
        } else if (opcode === 45) {
            buffer.readUnsignedShort();
        } else if (opcode === 46) {
            const anInt203 = buffer.readUnsignedShort();
        } else if (opcode === 47) {
            const anInt198 = buffer.readUnsignedShort();
        } else if (opcode === 48) {
            const anInt194 = buffer.readUnsignedShort();
        } else if (opcode === 49) {
            const anInt211 = buffer.readUnsignedShort();
        } else if (opcode === 50) {
            const anInt202 = buffer.readUnsignedShort();
        } else if (opcode === 51) {
            const anInt222 = buffer.readUnsignedShort();
        } else if (opcode === 52) {
            const count = buffer.readUnsignedByte();
            for (let i = 0; i < count; i++) {
                buffer.readUnsignedShort();
                buffer.readUnsignedByte();
            }
        } else if (opcode === 53) {
            const bool = false;
        } else if (opcode === 54) {
            const v0 = buffer.readUnsignedByte() << 6;
            const v1 = buffer.readUnsignedByte() << 6;
        } else if (opcode === 55) {
            const bodyPartId = buffer.readUnsignedByte();
            buffer.readUnsignedShort();
        } else if (opcode === 54) {
            const bodyPartId = buffer.readUnsignedByte();
            for (let i = 0; i < 3; i++) {
                buffer.readShort();
            }
        } else {
            throw new Error("BasType: Unknown opcode: " + opcode);
        }
    }
}
