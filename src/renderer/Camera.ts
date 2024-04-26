import { mat4, vec3 } from "gl-matrix";

import { DEGREES_TO_RADIANS, RS_TO_RADIANS } from "../rs/MathConstants";
import { clamp } from "../util/MathUtil";
import { Frustum } from "./Frustum";

export interface CameraPosition {
    position: vec3;
    pitch: number;
    yaw: number;
}

export enum ProjectionType {
    PERSPECTIVE,
    ORTHO,
}

export class Camera {
    static moveCameraRotOrigin: vec3 = vec3.create();
    static deltaTemp: vec3 = vec3.create();

    pos: vec3;

    pitch: number;
    yaw: number;

    projectionType: ProjectionType = ProjectionType.PERSPECTIVE;

    fov: number = 90;
    orthoZoom: number = 15;

    projectionMatrix: mat4 = mat4.create();
    cameraMatrix: mat4 = mat4.create();
    viewMatrix: mat4 = mat4.create();
    viewProjMatrix: mat4 = mat4.create();

    frustum = new Frustum();

    updated: boolean = false;
    updatedPosition: boolean = false;
    updatedLastFrame: boolean = false;

    constructor(x: number, y: number, z: number, pitch: number, yaw: number) {
        this.pos = vec3.fromValues(x, y, z);
        this.pitch = pitch;
        this.yaw = yaw;
    }

    setProjectionType(type: ProjectionType) {
        this.projectionType = type;
        this.updated = true;
    }

    move(deltaX: number, deltaY: number, deltaZ: number, rotatePitch: boolean = false): void {
        Camera.deltaTemp[0] = deltaX;
        Camera.deltaTemp[1] = deltaY;
        Camera.deltaTemp[2] = deltaZ;

        if (rotatePitch) {
            vec3.rotateX(
                Camera.deltaTemp,
                Camera.deltaTemp,
                Camera.moveCameraRotOrigin,
                -this.pitch * RS_TO_RADIANS,
            );
        }
        vec3.rotateY(
            Camera.deltaTemp,
            Camera.deltaTemp,
            Camera.moveCameraRotOrigin,
            (this.yaw - 1024) * RS_TO_RADIANS,
        );

        vec3.add(this.pos, this.pos, Camera.deltaTemp);
        this.updated = true;
        this.updatedPosition = true;
    }

    updatePitch(pitch: number, deltaPitch: number): void {
        const maxPitch = this.projectionType === ProjectionType.PERSPECTIVE ? 512 : 0;
        this.pitch = clamp(pitch + deltaPitch, -512, maxPitch);
        this.updated = true;
    }

    getYaw(): number {
        return this.yaw & 2047;
    }

    setYaw(yaw: number): void {
        this.yaw = yaw;
        this.updated = true;
    }

    updateYaw(yaw: number, deltaYaw: number): void {
        this.setYaw(yaw + deltaYaw);
    }

    update(width: number, height: number) {
        // Projection
        mat4.identity(this.projectionMatrix);
        if (this.projectionType === ProjectionType.PERSPECTIVE) {
            mat4.perspective(
                this.projectionMatrix,
                this.fov * DEGREES_TO_RADIANS,
                width / height,
                0.1,
                1024.0 * 4,
            );
        } else {
            mat4.ortho(
                this.projectionMatrix,
                -width / this.orthoZoom,
                width / this.orthoZoom,
                -height / this.orthoZoom,
                height / this.orthoZoom,
                -1024.0 * 4,
                1024.0 * 4,
            );
        }

        // View
        const pitch = this.pitch * RS_TO_RADIANS;
        const yaw = (this.yaw - 1024) * RS_TO_RADIANS;

        mat4.identity(this.cameraMatrix);

        mat4.translate(this.cameraMatrix, this.cameraMatrix, this.pos);
        mat4.rotateY(this.cameraMatrix, this.cameraMatrix, yaw);
        mat4.rotateZ(this.cameraMatrix, this.cameraMatrix, 180 * DEGREES_TO_RADIANS); // Roll
        mat4.rotateX(this.cameraMatrix, this.cameraMatrix, pitch);

        mat4.invert(this.viewMatrix, this.cameraMatrix);

        // Calculate view projection matrix
        mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);

        this.frustum.setPlanes(this.viewProjMatrix);
    }

    onFrameEnd() {
        this.updatedLastFrame = this.updated;
        this.updated = false;
        this.updatedPosition = false;
    }

    getPosX(): number {
        return this.pos[0];
    }

    getPosY(): number {
        return this.pos[1];
    }

    getPosZ(): number {
        return this.pos[2];
    }

    getMapX(): number {
        return this.getPosX() >> 6;
    }

    getMapY(): number {
        return this.getPosZ() >> 6;
    }
}
