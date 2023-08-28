import { mat4 } from "gl-matrix";

export class MatrixPool {
    static matrixIndex: number;
    static matrixLimit: number;
    static matrixPool: mat4[];

    static IDENTITY: mat4 = mat4.create();

    static init(size: number): void {
        MatrixPool.matrixIndex = 0;
        MatrixPool.matrixLimit = size;
        MatrixPool.matrixPool = new Array(size);
    }

    static get(): mat4 {
        if (MatrixPool.matrixIndex === 0) {
            return mat4.create();
        } else {
            mat4.identity(MatrixPool.matrixPool[--MatrixPool.matrixIndex]);
            return MatrixPool.matrixPool[MatrixPool.matrixIndex];
        }
    }

    static release(m: mat4): void {
        if (MatrixPool.matrixIndex < MatrixPool.matrixLimit - 1) {
            MatrixPool.matrixPool[MatrixPool.matrixIndex++] = m;
        }
    }
}
MatrixPool.init(100);
