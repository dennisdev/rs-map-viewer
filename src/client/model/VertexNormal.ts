export class VertexNormal {
    public x: number = 0;

    public y: number = 0;

    public z: number = 0;

    public magnitude: number = 0;

    public static copy(other: VertexNormal): VertexNormal {
        const normal = new VertexNormal();
        normal.x = other.x;
        normal.y = other.y;
        normal.z = other.z;
        normal.magnitude = other.magnitude;
        return normal;
    }
}
