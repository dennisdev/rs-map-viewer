export class VertexNormal {
    x: number = 0;
    y: number = 0;
    z: number = 0;

    magnitude: number = 0;

    static copy(other: VertexNormal): VertexNormal {
        const normal = new VertexNormal();
        normal.x = other.x;
        normal.y = other.y;
        normal.z = other.z;
        normal.magnitude = other.magnitude;
        return normal;
    }
}
