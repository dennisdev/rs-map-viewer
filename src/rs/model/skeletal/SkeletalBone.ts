import { ReadonlyMat4, mat4, vec3 } from "gl-matrix";

import { ByteBuffer } from "../../io/ByteBuffer";
import { MatrixPool } from "./MatrixPool";

export class SkeletalBone {
    parentId: number;
    localMatrices: mat4[];
    modelMatrices: mat4[];
    invertedModelMatrices: mat4[];

    animMatrix: mat4 = mat4.create();
    updateAnimModelMatrix: boolean = false;
    updateFinalMatrix: boolean = false;

    animModelMatrix: mat4 = mat4.create();
    finalMatrix: mat4 = mat4.create();

    parent?: SkeletalBone;

    rotations!: vec3[];
    translations!: vec3[];
    scalings!: vec3[];

    static readMat4(buffer: ByteBuffer, compact: boolean): mat4 {
        if (compact) {
            throw new Error("Not implemented");
        } else {
            const m = new Float32Array(16);
            for (let i = 0; i < 16; i++) {
                m[i] = buffer.readFloat();
            }
            return m;
        }
    }

    static getRotation(out: vec3, m: ReadonlyMat4): vec3 {
        out[0] = -Math.asin(m[6]);
        out[1] = 0;
        out[2] = 0;
        const cosRotationX = Math.cos(out[0]);
        if (Math.abs(cosRotationX) > 0.005) {
            out[1] = Math.atan2(m[2], m[10]);
            out[2] = Math.atan2(m[4], m[5]);
        } else {
            const sinRotationY = m[1];
            const cosRotationY = m[0];
            if (m[6] < 0) {
                out[1] = Math.atan2(sinRotationY, cosRotationY);
            } else {
                out[1] = -Math.atan2(sinRotationY, cosRotationY);
            }
            out[2] = 0;
        }

        return out;
    }

    constructor(poseCount: number, buffer: ByteBuffer, matrixCompact: boolean) {
        this.parentId = buffer.readShort();
        this.localMatrices = new Array(poseCount);
        this.modelMatrices = new Array(poseCount);
        this.invertedModelMatrices = new Array(poseCount);

        // Direction vector maybe
        const unused: number[][] = new Array(poseCount);

        for (let i = 0; i < poseCount; i++) {
            this.localMatrices[i] = SkeletalBone.readMat4(buffer, matrixCompact);
            unused[i] = new Array(3);
            unused[i][0] = buffer.readFloat();
            unused[i][1] = buffer.readFloat();
            unused[i][2] = buffer.readFloat();
        }

        this.extractTransformations();
    }

    extractTransformations(): void {
        const poseCount = this.localMatrices.length;
        this.rotations = new Array(poseCount);
        this.translations = new Array(poseCount);
        this.scalings = new Array(poseCount);

        const invertedLocalMatrix = MatrixPool.get();

        for (let i = 0; i < poseCount; i++) {
            const localMatrix = this.getLocalMatrix(i);
            mat4.invert(invertedLocalMatrix, localMatrix);

            this.rotations[i] = vec3.create();
            this.translations[i] = vec3.create();
            this.scalings[i] = vec3.create();

            SkeletalBone.getRotation(this.rotations[i], invertedLocalMatrix);
            mat4.getTranslation(this.translations[i], localMatrix);
            mat4.getScaling(this.scalings[i], localMatrix);
        }

        MatrixPool.release(invertedLocalMatrix);
    }

    getLocalMatrix(poseId: number): mat4 {
        return this.localMatrices[poseId];
    }

    getModelMatrix(poseId: number): mat4 {
        if (this.modelMatrices[poseId] === undefined) {
            const modelMatrix = mat4.create();
            if (this.parent) {
                mat4.mul(
                    modelMatrix,
                    this.parent.getModelMatrix(poseId),
                    this.getLocalMatrix(poseId),
                );
            } else {
                mat4.copy(modelMatrix, this.getLocalMatrix(poseId));
            }
            this.modelMatrices[poseId] = modelMatrix;
        }
        return this.modelMatrices[poseId];
    }

    getInvertedModelMatrix(poseId: number): mat4 {
        if (this.invertedModelMatrices[poseId] === undefined) {
            this.invertedModelMatrices[poseId] = mat4.invert(
                mat4.create(),
                this.getModelMatrix(poseId),
            );
        }
        return this.invertedModelMatrices[poseId];
    }

    setAnimMatrix(animMatrix: mat4): void {
        mat4.copy(this.animMatrix, animMatrix);
        this.updateAnimModelMatrix = true;
        this.updateFinalMatrix = true;
    }

    getAnimMatrix(): mat4 {
        return this.animMatrix;
    }

    getAnimModelMatrix(): mat4 {
        if (this.updateAnimModelMatrix) {
            this.updateAnimModelMatrix = false;

            if (this.parent) {
                mat4.mul(
                    this.animModelMatrix,
                    this.parent.getAnimModelMatrix(),
                    this.getAnimMatrix(),
                );
            } else {
                mat4.copy(this.animModelMatrix, this.getAnimMatrix());
            }
        }
        return this.animModelMatrix;
    }

    getFinalMatrix(poseId: number): mat4 {
        if (this.updateFinalMatrix) {
            this.updateFinalMatrix = false;

            mat4.mul(
                this.finalMatrix,
                this.getAnimModelMatrix(),
                this.getInvertedModelMatrix(poseId),
            );
        }
        return this.finalMatrix;
    }

    getRotation(poseId: number): vec3 {
        return this.rotations[poseId];
    }

    getTranslation(poseId: number): vec3 {
        return this.translations[poseId];
    }

    getScaling(poseId: number): vec3 {
        return this.scalings[poseId];
    }
}
