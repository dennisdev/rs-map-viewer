import { Model } from "../../client/model/Model";
import { Hasher } from "../../client/util/Hasher";
import { DataBuffer } from "./DataBuffer";

export function getModelHash(modelHashBuf: ModelHashBuffer, model: Model): number {
    const textureIds = (model.faceTextures && new Int32Array(model.faceTextures)) || new Int32Array(0);

    const datas = [model.faceColors1, model.faceColors2, model.faceColors3, model.verticesX, model.verticesY, model.verticesZ, textureIds];
    let dataLength = 0;
    for (const data of datas) {
        dataLength += data.length;
    }

    modelHashBuf.ensureSize(dataLength);

    let modelDataOffset = 0;
    for (const data of datas) {
        modelHashBuf.ints.set(data, modelDataOffset);
        modelDataOffset += data.length;
    }

    const hashData = modelHashBuf.bytes.subarray(0, modelDataOffset * 4);
    return Hasher.hash32(hashData);
}

export class ModelHashBuffer extends DataBuffer {
    ints: Int32Array;

    constructor(count: number) {
        super(4, count);
        this.ints = new Int32Array(this.bytes.buffer);
    }

    override ensureSize(count: number): boolean {
        const resized = super.ensureSize(count);
        if (resized) {
            this.ints = new Int32Array(this.bytes.buffer);
        }
        return resized;
    }
}
