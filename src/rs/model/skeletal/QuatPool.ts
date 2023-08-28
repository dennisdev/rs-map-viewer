import { quat } from "gl-matrix";

export class QuatPool {
    static quatIndex: number;
    static quatLimit: number;
    static quatPool: quat[];

    static init(size: number): void {
        QuatPool.quatIndex = 0;
        QuatPool.quatLimit = size;
        QuatPool.quatPool = new Array(size);
    }

    static get(): quat {
        if (QuatPool.quatIndex === 0) {
            return quat.create();
        } else {
            quat.identity(QuatPool.quatPool[--QuatPool.quatIndex]);
            return QuatPool.quatPool[QuatPool.quatIndex];
        }
    }

    static release(q: quat): void {
        if (QuatPool.quatIndex < QuatPool.quatLimit - 1) {
            QuatPool.quatPool[QuatPool.quatIndex++] = q;
        }
    }
}
QuatPool.init(100);
