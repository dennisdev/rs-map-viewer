import { mat4, quat, vec3 } from "gl-matrix";

import { ByteBuffer } from "../../io/ByteBuffer";
import { SeqBase } from "../seq/SeqBase";
import { SeqBaseLoader } from "../seq/SeqBaseLoader";
import { Curve } from "./Curve";
import { getCurveIndex, getCurveTypeForId } from "./CurveType";
import { MatrixPool } from "./MatrixPool";
import { QuatPool } from "./QuatPool";
import { SkeletalBase } from "./SkeletalBase";
import { SkeletalBone } from "./SkeletalBone";
import {
    SkeletalTransformType,
    getCurveCount,
    getTransformTypeForId,
} from "./SkeletalTransformType";

const rotateAxis = vec3.create();
const scaleVector = vec3.create();

export class SkeletalSeq {
    poseId: number;
    curveCount: number;

    boneCurves: Curve[][];
    curves: Curve[][];

    hasAlphaTransform: boolean = false;

    static load(baseLoader: SeqBaseLoader, id: number, data: Int8Array): SkeletalSeq {
        const buffer = new ByteBuffer(data);

        const version = buffer.readUnsignedByte();
        const baseId = buffer.readUnsignedShort();
        const base = baseLoader.load(baseId);
        if (!base) {
            throw new Error("Invalid skeletal base id: " + baseId);
        }
        const skeletalBase = base.skeletalBase;
        if (!skeletalBase) {
            throw new Error("Missing skeletal base: " + baseId);
        }

        return new SkeletalSeq(id, version, base, skeletalBase, buffer);
    }

    constructor(
        readonly id: number,
        readonly version: number,
        readonly base: SeqBase,
        readonly skeletalBase: SkeletalBase,
        buffer: ByteBuffer,
    ) {
        buffer.readUnsignedShort();
        buffer.readUnsignedShort();
        this.poseId = buffer.readUnsignedByte();
        this.curveCount = buffer.readUnsignedShort();
        this.boneCurves = new Array(skeletalBase.bones.length);
        this.curves = new Array(base.count);

        for (let i = 0; i < this.curveCount; i++) {
            const transformType = getTransformTypeForId(buffer.readUnsignedByte());

            const boneIndex = buffer.readSmart2();
            const curveType = getCurveTypeForId(buffer.readUnsignedByte());

            const curve = new Curve(i);
            curve.decode(buffer, version);

            let curves: Curve[][];
            if (transformType === SkeletalTransformType.BONE) {
                curves = this.boneCurves;
            } else {
                curves = this.curves;
            }

            if (curves[boneIndex] === undefined) {
                curves[boneIndex] = new Array(getCurveCount(transformType));
            }

            curve.load();
            curves[boneIndex][getCurveIndex(curveType)] = curve;

            if (transformType === SkeletalTransformType.ALPHA) {
                this.hasAlphaTransform = true;
            }
        }
    }

    updateAnimMatrix(frame: number, bone: SkeletalBone, boneIndex: number, poseId: number): void {
        const matrix = MatrixPool.get();

        this.applyRotation(matrix, boneIndex, bone, frame);
        this.applyScaling(matrix, boneIndex, bone, frame);
        this.applyTranslation(matrix, boneIndex, bone, frame);
        bone.setAnimMatrix(matrix);

        MatrixPool.release(matrix);
    }

    applyRotation(matrix: mat4, boneIndex: number, bone: SkeletalBone, frame: number): void {
        const rotation = bone.getRotation(this.poseId);
        let rotateX = rotation[0];
        let rotateY = rotation[1];
        let rotateZ = rotation[2];

        if (this.boneCurves[boneIndex]) {
            const curveX = this.boneCurves[boneIndex][0];
            const curveY = this.boneCurves[boneIndex][1];
            const curveZ = this.boneCurves[boneIndex][2];
            if (curveX) {
                rotateX = curveX.getValue(frame);
            }
            if (curveY) {
                rotateY = curveY.getValue(frame);
            }
            if (curveZ) {
                rotateZ = curveZ.getValue(frame);
            }
        }

        const quatX = QuatPool.get();
        vec3.set(rotateAxis, 1, 0, 0);
        quat.setAxisAngle(quatX, rotateAxis, rotateX);
        const quatY = QuatPool.get();
        vec3.set(rotateAxis, 0, 1, 0);
        quat.setAxisAngle(quatY, rotateAxis, rotateY);
        const quatZ = QuatPool.get();
        vec3.set(rotateAxis, 0, 0, 1);
        quat.setAxisAngle(quatZ, rotateAxis, rotateZ);
        const quaternion = QuatPool.get();
        quat.mul(quaternion, quatZ, quaternion);
        quat.mul(quaternion, quatX, quaternion);
        quat.mul(quaternion, quatY, quaternion);

        const rotateMatrix = MatrixPool.get();

        mat4.fromQuat(rotateMatrix, quaternion);
        mat4.mul(matrix, rotateMatrix, matrix);

        QuatPool.release(quatX);
        QuatPool.release(quatY);
        QuatPool.release(quatZ);
        QuatPool.release(quaternion);
        MatrixPool.release(rotateMatrix);
    }

    applyScaling(matrix: mat4, boneIndex: number, bone: SkeletalBone, frame: number): void {
        const scaling = bone.getScaling(this.poseId);
        let scaleX = scaling[0];
        let scaleY = scaling[1];
        let scaleZ = scaling[2];

        if (this.boneCurves[boneIndex]) {
            const curveX = this.boneCurves[boneIndex][6];
            const curveY = this.boneCurves[boneIndex][7];
            const curveZ = this.boneCurves[boneIndex][8];
            if (curveX) {
                scaleX = curveX.getValue(frame);
            }
            if (curveY) {
                scaleY = curveY.getValue(frame);
            }
            if (curveZ) {
                scaleZ = curveZ.getValue(frame);
            }
        }

        const scaleMatrix = MatrixPool.get();

        vec3.set(scaleVector, scaleX, scaleY, scaleZ);
        mat4.fromScaling(scaleMatrix, scaleVector);
        mat4.mul(matrix, scaleMatrix, matrix);

        MatrixPool.release(scaleMatrix);
    }

    applyTranslation(matrix: mat4, boneIndex: number, bone: SkeletalBone, frame: number): void {
        const translation = bone.getTranslation(this.poseId);
        let transX = translation[0];
        let transY = translation[1];
        let transZ = translation[2];

        if (this.boneCurves[boneIndex]) {
            const curveX = this.boneCurves[boneIndex][3];
            const curveY = this.boneCurves[boneIndex][4];
            const curveZ = this.boneCurves[boneIndex][5];
            if (curveX) {
                transX = curveX.getValue(frame);
            }
            if (curveY) {
                transY = curveY.getValue(frame);
            }
            if (curveZ) {
                transZ = curveZ.getValue(frame);
            }
        }

        matrix[12] = transX;
        matrix[13] = transY;
        matrix[14] = transZ;
    }
}
