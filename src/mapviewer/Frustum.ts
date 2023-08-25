/*!
 * Contains code from THREE.js
 * MIT License
 * https://github.com/mrdoob/three.js
 * Contains code from fuzhenn/frustum-intersects
 * MIT License
 * https://github.com/fuzhenn/frustum-intersects/blob/master/src/index.js
 */

import { mat4, vec3, vec4 } from "gl-matrix";

type Planes = [vec4, vec4, vec4, vec4, vec4, vec4];

function setComponents(out: vec4, x: number, y: number, z: number, w: number) {
    // THREE.js Plane.js
    const inverseNormalLength = 1 / Math.sqrt(x * x + y * y + z * z);
    out[0] = x * inverseNormalLength;
    out[1] = y * inverseNormalLength;
    out[2] = z * inverseNormalLength;
    out[3] = w * inverseNormalLength;
    return out;
}

function distanceToPoint(plane: vec4, p: vec3) {
    return plane[0] * p[0] + plane[1] * p[1] + plane[2] * p[2] + plane[3];
}

export class Frustum {
    planes: Planes;

    p: vec3;

    constructor() {
        this.planes = [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ];
        this.p = [0, 0, 0];
    }

    setPlanes(me: mat4) {
        const me0 = me[0],
            me1 = me[1],
            me2 = me[2],
            me3 = me[3];
        const me4 = me[4],
            me5 = me[5],
            me6 = me[6],
            me7 = me[7];
        const me8 = me[8],
            me9 = me[9],
            me10 = me[10],
            me11 = me[11];
        const me12 = me[12],
            me13 = me[13],
            me14 = me[14],
            me15 = me[15];

        //right
        setComponents(this.planes[0], me3 - me0, me7 - me4, me11 - me8, me15 - me12);
        //left
        setComponents(this.planes[1], me3 + me0, me7 + me4, me11 + me8, me15 + me12);
        //bottom
        setComponents(this.planes[2], me3 + me1, me7 + me5, me11 + me9, me15 + me13);
        //top
        setComponents(this.planes[3], me3 - me1, me7 - me5, me11 - me9, me15 - me13);
        //z-far
        setComponents(this.planes[4], me3 - me2, me7 - me6, me11 - me10, me15 - me14);
        //z-near
        setComponents(this.planes[5], me3 + me2, me7 + me6, me11 + me10, me15 + me14);
    }

    intersectsBox(box: number[][]) {
        for (let i = 0; i < 6; i++) {
            const plane = this.planes[i];
            // corner at max distance
            this.p[0] = plane[0] > 0 ? box[1][0] : box[0][0];
            this.p[1] = plane[1] > 0 ? box[1][1] : box[0][1];
            this.p[2] = plane[2] > 0 ? box[1][2] : box[0][2];

            if (distanceToPoint(plane, this.p) < 0) {
                return false;
            }
        }

        return true;
    }
}
