import { ByteBuffer } from "../../io/ByteBuffer";
import { SkeletalBone } from "./SkeletalBone";
import { SkeletalSeq } from "./SkeletalSeq";

export class SkeletalBase {
    bones: SkeletalBone[];
    poseCount: number;

    constructor(buffer: ByteBuffer, count: number) {
        this.bones = new Array(count);
        this.poseCount = buffer.readUnsignedByte();

        for (let i = 0; i < this.bones.length; i++) {
            this.bones[i] = new SkeletalBone(this.poseCount, buffer, false);
        }

        this.linkBones();
    }

    linkBones(): void {
        for (let i = 0; i < this.bones.length; i++) {
            const bone = this.bones[i];
            if (bone.parentId >= 0) {
                bone.parent = this.bones[bone.parentId];
            }
        }
    }

    updateAnimMatrices(
        skeletalSeq: SkeletalSeq,
        frame: number,
        masks: boolean[] | undefined = undefined,
        mask: boolean = false,
    ): void {
        const poseId = skeletalSeq.poseId;

        let boneIndex = 0;
        for (const bone of this.bones) {
            if (masks === undefined || masks[boneIndex] === mask) {
                skeletalSeq.updateAnimMatrix(frame, bone, boneIndex, poseId);
            }
            boneIndex++;
        }
    }

    getBoneCount(): number {
        return this.bones.length;
    }

    getBone(id: number): SkeletalBone | undefined {
        if (id >= this.getBoneCount()) {
            return undefined;
        }
        return this.bones[id];
    }
}
