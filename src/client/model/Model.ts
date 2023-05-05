import { COSINE, SINE } from "../Client";
import { TextureLoader } from "../fs/loader/TextureLoader";
import { Renderable } from "../scene/Renderable";
import { AnimationFrame } from "./animation/AnimationFrame";
import { TransformType } from "./animation/TransformType";

export function computeTextureCoords(model: Model): Float32Array | undefined {
    const faceTextures = model.faceTextures;

    if (!faceTextures) {
        return undefined;
    }

    const vertexPositionsX = model.verticesX;
    const vertexPositionsY = model.verticesY;
    const vertexPositionsZ = model.verticesZ;

    const trianglePointsX = model.indices1;
    const trianglePointsY = model.indices2;
    const trianglePointsZ = model.indices3;

    const texTriangleX = model.texTriangleX;
    const texTriangleY = model.texTriangleY;
    const texTriangleZ = model.texTriangleZ;

    const textureCoords = model.textureCoords;

    const faceCount = model.faceCount;
    const faceTextureUCoordinates: Float32Array = new Float32Array(
        faceCount * 6
    );

    for (let i = 0; i < faceCount; i++) {
        const trianglePointX = trianglePointsX[i];
        const trianglePointY = trianglePointsY[i];
        const trianglePointZ = trianglePointsZ[i];

        const textureIdx = faceTextures[i];

        if (textureIdx !== -1) {
            let triangleVertexIdx1: number;
            let triangleVertexIdx2: number;
            let triangleVertexIdx3: number;

            if (textureCoords && textureCoords[i] !== -1) {
                const textureCoordinate = textureCoords[i] & 255;
                triangleVertexIdx1 = texTriangleX[textureCoordinate];
                triangleVertexIdx2 = texTriangleY[textureCoordinate];
                triangleVertexIdx3 = texTriangleZ[textureCoordinate];
            } else {
                triangleVertexIdx1 = trianglePointX;
                triangleVertexIdx2 = trianglePointY;
                triangleVertexIdx3 = trianglePointZ;
            }

            const triangleX = vertexPositionsX[triangleVertexIdx1];
            const triangleY = vertexPositionsY[triangleVertexIdx1];
            const triangleZ = vertexPositionsZ[triangleVertexIdx1];

            const f_882_ = vertexPositionsX[triangleVertexIdx2] - triangleX;
            const f_883_ = vertexPositionsY[triangleVertexIdx2] - triangleY;
            const f_884_ = vertexPositionsZ[triangleVertexIdx2] - triangleZ;
            const f_885_ = vertexPositionsX[triangleVertexIdx3] - triangleX;
            const f_886_ = vertexPositionsY[triangleVertexIdx3] - triangleY;
            const f_887_ = vertexPositionsZ[triangleVertexIdx3] - triangleZ;
            const f_888_ = vertexPositionsX[trianglePointX] - triangleX;
            const f_889_ = vertexPositionsY[trianglePointX] - triangleY;
            const f_890_ = vertexPositionsZ[trianglePointX] - triangleZ;
            const f_891_ = vertexPositionsX[trianglePointY] - triangleX;
            const f_892_ = vertexPositionsY[trianglePointY] - triangleY;
            const f_893_ = vertexPositionsZ[trianglePointY] - triangleZ;
            const f_894_ = vertexPositionsX[trianglePointZ] - triangleX;
            const f_895_ = vertexPositionsY[trianglePointZ] - triangleY;
            const f_896_ = vertexPositionsZ[trianglePointZ] - triangleZ;

            const f_897_ = f_883_ * f_887_ - f_884_ * f_886_;
            const f_898_ = f_884_ * f_885_ - f_882_ * f_887_;
            const f_899_ = f_882_ * f_886_ - f_883_ * f_885_;
            let f_900_ = f_886_ * f_899_ - f_887_ * f_898_;
            let f_901_ = f_887_ * f_897_ - f_885_ * f_899_;
            let f_902_ = f_885_ * f_898_ - f_886_ * f_897_;
            let f_903_ =
                1.0 / (f_900_ * f_882_ + f_901_ * f_883_ + f_902_ * f_884_);

            const u0 =
                (f_900_ * f_888_ + f_901_ * f_889_ + f_902_ * f_890_) * f_903_;
            const u1 =
                (f_900_ * f_891_ + f_901_ * f_892_ + f_902_ * f_893_) * f_903_;
            const u2 =
                (f_900_ * f_894_ + f_901_ * f_895_ + f_902_ * f_896_) * f_903_;

            f_900_ = f_883_ * f_899_ - f_884_ * f_898_;
            f_901_ = f_884_ * f_897_ - f_882_ * f_899_;
            f_902_ = f_882_ * f_898_ - f_883_ * f_897_;
            f_903_ =
                1.0 / (f_900_ * f_885_ + f_901_ * f_886_ + f_902_ * f_887_);

            const v0 =
                (f_900_ * f_888_ + f_901_ * f_889_ + f_902_ * f_890_) * f_903_;
            const v1 =
                (f_900_ * f_891_ + f_901_ * f_892_ + f_902_ * f_893_) * f_903_;
            const v2 =
                (f_900_ * f_894_ + f_901_ * f_895_ + f_902_ * f_896_) * f_903_;

            const idx = i * 6;
            faceTextureUCoordinates[idx] = u0;
            faceTextureUCoordinates[idx + 1] = v0;
            faceTextureUCoordinates[idx + 2] = u1;
            faceTextureUCoordinates[idx + 3] = v1;
            faceTextureUCoordinates[idx + 4] = u2;
            faceTextureUCoordinates[idx + 5] = v2;
        }
    }

    return faceTextureUCoordinates;
}

export class Model extends Renderable {
    static animateOriginX: number = 0;
    static animateOriginY: number = 0;
    static animateOriginZ: number = 0;

    verticesCount: number;

    verticesX!: Int32Array;

    verticesY!: Int32Array;

    verticesZ!: Int32Array;

    contourVerticesY?: Int32Array;

    faceCount: number;

    indices1!: Int32Array;

    indices2!: Int32Array;

    indices3!: Int32Array;

    faceColors1!: Int32Array;

    faceColors2!: Int32Array;

    faceColors3!: Int32Array;

    faceRenderPriorities!: Int8Array;

    faceAlphas!: Int8Array;

    textureCoords!: Int8Array;

    faceTextures?: Int16Array;

    priority: number;

    texTriangleCount: number;

    texTriangleX!: Int32Array;

    texTriangleY!: Int32Array;

    texTriangleZ!: Int32Array;

    vertexLabels!: Int32Array[];

    faceLabelsAlpha!: Int32Array[];

    animMayaGroups!: Int32Array[];

    animMayaScales!: Int32Array[];

    isClickable: boolean;

    boundsType!: number;

    bottomY!: number;

    xzRadius!: number;

    diameter!: number;

    radius!: number;

    xMid!: number;

    yMid!: number;

    zMid!: number;

    xMidOffset: number;

    yMidOffset: number;

    zMidOffset: number;

    field2494!: number;

    field2495!: number;

    field2479!: number;

    field2474!: number;

    public static copy(model: Model): Model {
        return Model.merge([model], 1);
    }

    public static copyAnimated(
        model: Model,
        shallowTransparencies: boolean
    ): Model {
        const copy: Model = Object.assign(
            Object.create(Object.getPrototypeOf(model)),
            model
        );
        // const copy = new Model();

        copy.verticesX = new Int32Array(model.verticesCount);
        copy.verticesY = new Int32Array(model.verticesCount);
        copy.verticesZ = new Int32Array(model.verticesCount);

        for (let i = 0; i < model.verticesCount; i++) {
            copy.verticesX[i] = model.verticesX[i];
            copy.verticesY[i] = model.verticesY[i];
            copy.verticesZ[i] = model.verticesZ[i];
        }

        if (!shallowTransparencies && model.faceAlphas) {
            copy.faceAlphas = new Int8Array(model.faceCount);
            for (let i = 0; i < model.faceCount; i++) {
                copy.faceAlphas[i] = model.faceAlphas[i];
            }
        }

        return copy;
    }

    public static merge(models: Model[], count: number): Model {
        const model = new Model();
        model.merge(models, count);
        return model;
    }

    static resetAnimateOrigin() {
        Model.animateOriginX = 0;
        Model.animateOriginY = 0;
        Model.animateOriginZ = 0;
    }

    constructor() {
        super();
        this.verticesCount = 0;
        this.faceCount = 0;
        this.priority = 0;
        this.texTriangleCount = 0;
        this.isClickable = false;
        this.xMidOffset = -1;
        this.yMidOffset = -1;
        this.zMidOffset = -1;
    }

    merge(models: Model[], count: number): void {
        let hasRenderPriority = false;
        let hasAlpha = false;
        let hasTexture = false;
        let hasTextureCoord = false;
        this.verticesCount = 0;
        this.faceCount = 0;
        this.texTriangleCount = 0;
        this.priority = -1;

        for (let i = 0; i < count; i++) {
            const model = models[i];
            if (model) {
                this.verticesCount += model.verticesCount;
                this.faceCount += model.faceCount;
                this.texTriangleCount += model.texTriangleCount;
                if (model.faceRenderPriorities) {
                    hasRenderPriority = true;
                } else {
                    if (this.priority === -1) {
                        this.priority = model.priority;
                    }

                    if (this.priority !== model.priority) {
                        hasRenderPriority = true;
                    }
                }

                hasAlpha ||= !!model.faceAlphas;
                hasTexture ||= !!model.faceTextures;
                hasTextureCoord ||= !!model.textureCoords;
            }
        }

        this.verticesX = new Int32Array(this.verticesCount);
        this.verticesY = new Int32Array(this.verticesCount);
        this.verticesZ = new Int32Array(this.verticesCount);
        this.indices1 = new Int32Array(this.faceCount);
        this.indices2 = new Int32Array(this.faceCount);
        this.indices3 = new Int32Array(this.faceCount);
        this.faceColors1 = new Int32Array(this.faceCount);
        this.faceColors2 = new Int32Array(this.faceCount);
        this.faceColors3 = new Int32Array(this.faceCount);
        if (hasRenderPriority) {
            this.faceRenderPriorities = new Int8Array(this.faceCount);
        }

        if (hasAlpha) {
            this.faceAlphas = new Int8Array(this.faceCount);
        }

        if (hasTexture) {
            this.faceTextures = new Int16Array(this.faceCount);
        }

        if (hasTextureCoord) {
            this.textureCoords = new Int8Array(this.faceCount);
        }

        if (this.texTriangleCount > 0) {
            this.texTriangleX = new Int32Array(this.texTriangleCount);
            this.texTriangleY = new Int32Array(this.texTriangleCount);
            this.texTriangleZ = new Int32Array(this.texTriangleCount);
        }

        this.verticesCount = 0;
        this.faceCount = 0;
        this.texTriangleCount = 0;

        for (let i = 0; i < count; i++) {
            const model = models[i];
            if (model) {
                for (let f = 0; f < model.faceCount; f++) {
                    this.indices1[this.faceCount] =
                        this.verticesCount + model.indices1[f];
                    this.indices2[this.faceCount] =
                        this.verticesCount + model.indices2[f];
                    this.indices3[this.faceCount] =
                        this.verticesCount + model.indices3[f];
                    this.faceColors1[this.faceCount] = model.faceColors1[f];
                    this.faceColors2[this.faceCount] = model.faceColors2[f];
                    this.faceColors3[this.faceCount] = model.faceColors3[f];
                    if (hasRenderPriority) {
                        if (model.faceRenderPriorities) {
                            this.faceRenderPriorities[this.faceCount] =
                                model.faceRenderPriorities[f];
                        } else {
                            this.faceRenderPriorities[this.faceCount] =
                                model.priority;
                        }
                    }

                    if (hasAlpha && model.faceAlphas) {
                        this.faceAlphas[this.faceCount] = model.faceAlphas[f];
                    }

                    if (hasTexture && this.faceTextures) {
                        if (model.faceTextures) {
                            this.faceTextures[this.faceCount] =
                                model.faceTextures[f];
                        } else {
                            this.faceTextures[this.faceCount] = -1;
                        }
                    }

                    if (hasTextureCoord) {
                        if (
                            model.textureCoords &&
                            model.textureCoords[f] !== -1
                        ) {
                            this.textureCoords[this.faceCount] =
                                this.texTriangleCount + model.textureCoords[f];
                        } else {
                            this.textureCoords[this.faceCount] = -1;
                        }
                    }

                    this.faceCount++;
                }

                for (let v = 0; v < model.texTriangleCount; v++) {
                    this.texTriangleX[this.texTriangleCount] =
                        this.verticesCount + model.texTriangleX[v];
                    this.texTriangleY[this.texTriangleCount] =
                        this.verticesCount + model.texTriangleY[v];
                    this.texTriangleZ[this.texTriangleCount] =
                        this.verticesCount + model.texTriangleZ[v];
                    this.texTriangleCount++;
                }

                for (let v = 0; v < model.verticesCount; v++) {
                    this.verticesX[this.verticesCount] = model.verticesX[v];
                    this.verticesY[this.verticesCount] = model.verticesY[v];
                    this.verticesZ[this.verticesCount] = model.verticesZ[v];
                    this.verticesCount++;
                }
            }
        }
    }

    calculateBoundsCylinder(): void {
        if (this.boundsType !== 1) {
            this.boundsType = 1;
            this.height = 0;
            this.bottomY = 0;
            this.xzRadius = 0;

            for (let i = 0; i < this.verticesCount; i++) {
                const vertX = this.verticesX[i];
                const vertY = this.verticesY[i];
                const vertZ = this.verticesZ[i];
                if (-vertY > this.height) {
                    this.height = -vertY;
                }

                if (vertY > this.bottomY) {
                    this.bottomY = vertY;
                }

                const var5 = vertX * vertX + vertZ * vertZ;
                if (var5 > this.xzRadius) {
                    this.xzRadius = var5;
                }
            }

            this.xzRadius = (Math.sqrt(this.xzRadius) + 0.99) | 0;
            this.radius =
                (Math.sqrt(
                    this.xzRadius * this.xzRadius + this.height * this.height
                ) +
                    0.99) |
                0;
            this.diameter =
                (this.radius +
                    (Math.sqrt(
                        this.xzRadius * this.xzRadius +
                            this.bottomY * this.bottomY
                    ) +
                        0.99)) |
                0;
        }
    }

    invalidateBounds(): void {
        this.boundsType = 0;
        this.xMidOffset = -1;
    }

    contourGround(
        heightMap: Int32Array[],
        tileX: number,
        tileHeight: number,
        tileY: number,
        var5: boolean,
        clipType: number
    ): Model {
        this.calculateBoundsCylinder();
        let var7 = tileX - this.xzRadius;
        let var8 = tileX + this.xzRadius;
        let var9 = tileY - this.xzRadius;
        let var10 = tileY + this.xzRadius;
        if (
            var7 >= 0 &&
            (var8 + 128) >> 7 < heightMap.length &&
            var9 >= 0 &&
            (var10 + 128) >> 7 < heightMap[0].length
        ) {
            var7 >>= 7;
            var8 = (var8 + 127) >> 7;
            var9 >>= 7;
            var10 = (var10 + 127) >> 7;
            if (
                tileHeight === heightMap[var7][var9] &&
                tileHeight === heightMap[var8][var9] &&
                tileHeight === heightMap[var7][var10] &&
                tileHeight === heightMap[var8][var10]
            ) {
                return this;
            } else {
                let model: Model;
                if (var5) {
                    model = new Model();
                    model.verticesCount = this.verticesCount;
                    model.faceCount = this.faceCount;
                    model.texTriangleCount = this.texTriangleCount;
                    model.verticesX = this.verticesX;
                    model.verticesZ = this.verticesZ;
                    model.indices1 = this.indices1;
                    model.indices2 = this.indices2;
                    model.indices3 = this.indices3;
                    model.faceColors1 = this.faceColors1;
                    model.faceColors2 = this.faceColors2;
                    model.faceColors3 = this.faceColors3;
                    model.faceRenderPriorities = this.faceRenderPriorities;
                    model.faceAlphas = this.faceAlphas;
                    model.textureCoords = this.textureCoords;
                    model.faceTextures = this.faceTextures;
                    model.priority = this.priority;
                    model.texTriangleX = this.texTriangleX;
                    model.texTriangleY = this.texTriangleY;
                    model.texTriangleZ = this.texTriangleZ;
                    model.vertexLabels = this.vertexLabels;
                    model.faceLabelsAlpha = this.faceLabelsAlpha;
                    model.isClickable = this.isClickable;
                    model.verticesY = this.verticesY;
                } else {
                    model = this;
                }
                model.contourVerticesY = new Int32Array(model.verticesCount);

                if (clipType === 0) {
                    for (let i = 0; i < model.verticesCount; i++) {
                        const var13 = tileX + this.verticesX[i];
                        const var14 = tileY + this.verticesZ[i];
                        const var15 = var13 & 127;
                        const var16 = var14 & 127;
                        const var17 = var13 >> 7;
                        const var18 = var14 >> 7;
                        const var19 =
                            (heightMap[var17][var18] * (128 - var15) +
                                heightMap[var17 + 1][var18] * var15) >>
                            7;
                        const var20 =
                            (heightMap[var17][var18 + 1] * (128 - var15) +
                                var15 * heightMap[var17 + 1][var18 + 1]) >>
                            7;
                        const var21 =
                            (var19 * (128 - var16) + var20 * var16) >> 7;
                        model.contourVerticesY[i] =
                            var21 + this.verticesY[i] - tileHeight;
                    }
                } else {
                    for (let i = 0; i < model.verticesCount; i++) {
                        const var13 =
                            ((-this.verticesY[i] << 16) / this.height) | 0;
                        if (var13 < clipType) {
                            const var14 = tileX + this.verticesX[i];
                            const var15 = tileY + this.verticesZ[i];
                            const var16 = var14 & 127;
                            const var17 = var15 & 127;
                            const var18 = var14 >> 7;
                            const var19 = var15 >> 7;
                            const var20 =
                                (heightMap[var18][var19] * (128 - var16) +
                                    heightMap[var18 + 1][var19] * var16) >>
                                7;
                            const var21 =
                                (heightMap[var18][var19 + 1] * (128 - var16) +
                                    var16 * heightMap[var18 + 1][var19 + 1]) >>
                                7;
                            const var22 =
                                (var20 * (128 - var17) + var21 * var17) >> 7;
                            model.contourVerticesY[i] =
                                (((clipType - var13) * (var22 - tileHeight)) /
                                    clipType +
                                    this.verticesY[i]) |
                                0;
                        }
                    }
                }

                model.invalidateBounds();
                return model;
            }
        } else {
            return this;
        }
    }

    rotate90(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            const temp = this.verticesX[i];
            this.verticesX[i] = this.verticesZ[i];
            this.verticesZ[i] = -temp;
        }

        this.invalidateBounds();
    }

    rotate180(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] = -this.verticesX[i];
            this.verticesZ[i] = -this.verticesZ[i];
        }

        this.invalidateBounds();
    }

    rotate270(): void {
        for (let i = 0; i < this.verticesCount; i++) {
            const temp = this.verticesZ[i];
            this.verticesZ[i] = this.verticesX[i];
            this.verticesX[i] = -temp;
        }

        this.invalidateBounds();
    }

    rotate(angle: number): void {
        const sin = SINE[angle];
        const cos = COSINE[angle];

        for (let i = 0; i < this.verticesCount; i++) {
            const temp =
                (sin * this.verticesZ[i] + cos * this.verticesX[i]) >> 16;
            this.verticesZ[i] =
                (cos * this.verticesZ[i] - sin * this.verticesX[i]) >> 16;
            this.verticesX[i] = temp;
        }

        this.invalidateBounds();
    }

    translate(x: number, y: number, z: number): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] += x;
            this.verticesY[i] += y;
            this.verticesZ[i] += z;
        }

        this.invalidateBounds();
    }

    scale(x: number, y: number, z: number): void {
        for (let i = 0; i < this.verticesCount; i++) {
            this.verticesX[i] = ((this.verticesX[i] * x) / 128) | 0;
            this.verticesY[i] = ((this.verticesY[i] * y) / 128) | 0;
            this.verticesZ[i] = ((this.verticesZ[i] * z) / 128) | 0;
        }

        this.invalidateBounds();
    }

    hasAlpha(textureLoader: TextureLoader): boolean {
        if (this.faceAlphas) {
            return true;
        }
        if (this.faceTextures) {
            for (let i = 0; i < this.faceCount; i++) {
                const textureId = this.faceTextures[i];
                if (textureId !== -1 && textureLoader.hasAlpha(textureId)) {
                    return true;
                }
            }
        }
        return false;
    }

    getXZRadius(): number {
        this.calculateBoundsCylinder();
        return this.xzRadius;
    }

    animate(frame: AnimationFrame | undefined) {
        if (this.vertexLabels && frame) {
            Model.resetAnimateOrigin();

            const skeleton = frame.skeleton;

            for (let i = 0; i < frame.transformCount; i++) {
                const group = frame.transformGroups[i];
                // console.log(group, i, skeleton.types[group]);
                this.transform(
                    skeleton.types[group],
                    skeleton.labels[group],
                    frame.transformX[i],
                    frame.transformY[i],
                    frame.transformZ[i]
                );
            }

            this.invalidateBounds();
        }
    }

    transform(
        type: TransformType,
        labels: number[],
        tx: number,
        ty: number,
        tz: number
    ) {
        switch (type) {
            case TransformType.ORIGIN:
                Model.resetAnimateOrigin();

                let groupVertexCount = 0;

                for (const label of labels) {
                    if (label < this.vertexLabels.length) {
                        for (const v of this.vertexLabels[label]) {
                            Model.animateOriginX += this.verticesX[v];
                            Model.animateOriginY += this.verticesY[v];
                            Model.animateOriginZ += this.verticesZ[v];
                            groupVertexCount++;
                        }
                    }
                }

                if (groupVertexCount > 0) {
                    Model.animateOriginX =
                        tx + ((Model.animateOriginX / groupVertexCount) | 0);
                    Model.animateOriginY =
                        ty + ((Model.animateOriginY / groupVertexCount) | 0);
                    Model.animateOriginZ =
                        tz + ((Model.animateOriginZ / groupVertexCount) | 0);
                } else {
                    Model.animateOriginX = tx;
                    Model.animateOriginY = ty;
                    Model.animateOriginZ = tz;
                }
                break;
            case TransformType.TRANSLATE:
                for (const label of labels) {
                    if (label < this.vertexLabels.length) {
                        for (const v of this.vertexLabels[label]) {
                            this.verticesX[v] += tx;
                            this.verticesY[v] += ty;
                            this.verticesZ[v] += tz;
                        }
                    }
                }
                break;
            case TransformType.ROTATE:
                for (const label of labels) {
                    if (label < this.vertexLabels.length) {
                        for (const v of this.vertexLabels[label]) {
                            this.verticesX[v] -= Model.animateOriginX;
                            this.verticesY[v] -= Model.animateOriginY;
                            this.verticesZ[v] -= Model.animateOriginZ;

                            const angleX = (tx & 0xff) * 8;
                            const angleY = (ty & 0xff) * 8;
                            const angleZ = (tz & 0xff) * 8;

                            // roll
                            if (angleZ !== 0) {
                                const sin = SINE[angleZ];
                                const cos = COSINE[angleZ];
                                const temp =
                                    (sin * this.verticesY[v] +
                                        cos * this.verticesX[v]) >>
                                    16;
                                this.verticesY[v] =
                                    (cos * this.verticesY[v] -
                                        sin * this.verticesX[v]) >>
                                    16;
                                this.verticesX[v] = temp;
                            }

                            // pitch
                            if (angleX !== 0) {
                                const sin = SINE[angleX];
                                const cos = COSINE[angleX];
                                const temp =
                                    (cos * this.verticesY[v] -
                                        sin * this.verticesZ[v]) >>
                                    16;
                                this.verticesZ[v] =
                                    (sin * this.verticesY[v] +
                                        cos * this.verticesZ[v]) >>
                                    16;
                                this.verticesY[v] = temp;
                            }

                            // yaw
                            if (angleY !== 0) {
                                const sin = SINE[angleY];
                                const cos = COSINE[angleY];
                                const temp =
                                    (sin * this.verticesZ[v] +
                                        cos * this.verticesX[v]) >>
                                    16;
                                this.verticesZ[v] =
                                    (cos * this.verticesZ[v] -
                                        sin * this.verticesX[v]) >>
                                    16;
                                this.verticesX[v] = temp;
                            }

                            this.verticesX[v] += Model.animateOriginX;
                            this.verticesY[v] += Model.animateOriginY;
                            this.verticesZ[v] += Model.animateOriginZ;
                        }
                    }
                }
                break;
            case TransformType.SCALE:
                for (const label of labels) {
                    if (label < this.vertexLabels.length) {
                        for (const v of this.vertexLabels[label]) {
                            this.verticesX[v] -= Model.animateOriginX;
                            this.verticesY[v] -= Model.animateOriginY;
                            this.verticesZ[v] -= Model.animateOriginZ;

                            this.verticesX[v] =
                                ((tx * this.verticesX[v]) / 128) | 0;
                            this.verticesY[v] =
                                ((ty * this.verticesY[v]) / 128) | 0;
                            this.verticesZ[v] =
                                ((tz * this.verticesZ[v]) / 128) | 0;

                            this.verticesX[v] += Model.animateOriginX;
                            this.verticesY[v] += Model.animateOriginY;
                            this.verticesZ[v] += Model.animateOriginZ;
                        }
                    }
                }
                break;
            case TransformType.ALPHA:
                if (this.faceLabelsAlpha && this.faceAlphas) {
                    for (const label of labels) {
                        if (label < this.faceLabelsAlpha.length) {
                            // if (this.faceCount === 700) {
                            // console.log('here', label, this.faceLabelsAlpha);
                            // }
                            for (const f of this.faceLabelsAlpha[label]) {
                                let newAlpha =
                                    (this.faceAlphas[f] & 0xff) + tx * 8;
                                if (newAlpha < 0) {
                                    newAlpha = 0;
                                } else if (newAlpha > 255) {
                                    newAlpha = 255;
                                }

                                // if (this.faceCount === 700) {
                                // console.log('changing alpha', f, newAlpha, this.faceAlphas[f] & 0xFF);
                                // }
                                this.faceAlphas[f] = newAlpha;
                                // this.faceAlphas[f] = 0;
                            }
                        }
                    }
                }
                break;
        }
    }
}
