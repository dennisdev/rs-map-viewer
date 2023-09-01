import { ByteBuffer } from "../../io/ByteBuffer";
import { interpolateCurve } from "./CurveInterp";
import { CurveInterpType, getInterpTypeForId } from "./CurveInterpType";

export class Curve {
    type!: number;
    startInterpType!: CurveInterpType;
    endInterpType!: CurveInterpType;
    bool!: boolean;

    points?: CurvePoint[];

    startTick!: number;
    endTick!: number;

    values!: Float32Array;
    minValue!: number;
    maxValue!: number;

    noInterp: boolean = false;

    pointIndex: number = 0;
    pointIndexUpdated: boolean = true;

    interpBool: boolean = false;
    interpV0: number = 0;
    interpV1: number = 0;
    interpV2: number = 0;
    interpV3: number = 0;
    interpV4: number = 0;
    interpV5: number = 0;
    interpV6: number = 0;
    interpV7: number = 0;
    interpV8: number = 0;
    interpV9: number = 0;

    constructor(readonly id: number) {}

    decode(buffer: ByteBuffer, version: number): void {
        const count = buffer.readUnsignedShort();
        this.type = buffer.readUnsignedByte();

        this.startInterpType = getInterpTypeForId(buffer.readUnsignedByte());
        this.endInterpType = getInterpTypeForId(buffer.readUnsignedByte());
        this.bool = buffer.readUnsignedByte() !== 0;

        this.points = new Array(count);

        let lastPoint: CurvePoint | undefined;
        for (let i = 0; i < count; i++) {
            const point = new CurvePoint();
            point.decode(buffer, version);
            this.points[i] = point;
            if (lastPoint) {
                lastPoint.next = point;
            }

            lastPoint = point;
        }
    }

    load(): void {
        if (!this.points) {
            return;
        }

        this.startTick = this.points[0].x;
        this.endTick = this.points[this.points.length - 1].x;
        this.values = new Float32Array(this.getTickDuration() + 1);

        for (let t = this.startTick; t <= this.endTick; t++) {
            this.values[t - this.startTick] = interpolateCurve(this, t);
        }

        this.points = undefined;
        // Possible jagex bug? This is always 0 because points are undefined
        this.minValue = interpolateCurve(this, this.startTick - 1);
        this.maxValue = interpolateCurve(this, this.endTick + 1);
    }

    getValue(t: number): number {
        if (t < this.startTick) {
            return this.minValue;
        } else if (t > this.endTick) {
            return this.maxValue;
        } else {
            return this.values[t - this.startTick];
        }
    }

    getPointIndex(t: number): number {
        if (!this.points) {
            return this.pointIndex;
        }

        if (
            this.pointIndex < 0 ||
            this.points[this.pointIndex].x > t ||
            (this.points[this.pointIndex].next && this.points[this.pointIndex].next!.x <= t)
        ) {
            if (t >= this.startTick && t <= this.endTick) {
                const pointCount = this.points.length;
                let newPointIndex = this.pointIndex;
                if (pointCount > 0) {
                    let startPointIndex = 0;
                    let endPointIndex = pointCount - 1;

                    do {
                        // Middle point index
                        const pointIndex = (startPointIndex + endPointIndex) >> 1;
                        if (t < this.points[pointIndex].x) {
                            if (t > this.points[pointIndex - 1].x) {
                                newPointIndex = pointIndex - 1;
                                break;
                            }

                            endPointIndex = pointIndex - 1;
                        } else {
                            if (t <= this.points[pointIndex].x) {
                                newPointIndex = pointIndex;
                                break;
                            }

                            if (t < this.points[pointIndex + 1].x) {
                                newPointIndex = pointIndex;
                                break;
                            }

                            startPointIndex = pointIndex + 1;
                        }
                    } while (startPointIndex <= endPointIndex);
                }

                if (this.pointIndex !== newPointIndex) {
                    this.pointIndex = newPointIndex;
                    this.pointIndexUpdated = true;
                }

                return this.pointIndex;
            } else {
                return -1;
            }
        } else {
            return this.pointIndex;
        }
    }

    getCurvePoint(t: number): CurvePoint | undefined {
        if (!this.points) {
            return undefined;
        }
        const index = this.getPointIndex(t);
        if (index < 0 || index >= this.points.length) {
            return undefined;
        }
        return this.points[index];
    }

    getPointCount(): number {
        if (this.points) {
            return this.points.length;
        }
        return 0;
    }

    getTickDuration(): number {
        return this.endTick - this.startTick;
    }
}

export class CurvePoint {
    x!: number;
    y!: number;
    field2!: number;
    field3!: number;
    field4!: number;
    field5!: number;

    next?: CurvePoint;

    decode(buffer: ByteBuffer, version: number): void {
        this.x = buffer.readShort();
        this.y = buffer.readFloat();
        this.field2 = buffer.readFloat();
        this.field3 = buffer.readFloat();
        this.field4 = buffer.readFloat();
        this.field5 = buffer.readFloat();
    }
}
