export class CollisionMap {
    width: number;
    
    height: number;

    offsetX: number;

    offsetY: number;
    
    flags: Int32Array;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.offsetX = 0;
        this.offsetY = 0;
        this.flags = new Int32Array(width * height);
        this.reset();
    }

    reset(): void {
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				if (x !== 0 && y !== 0 && x < this.width - 5 && y < this.height - 5) { 
                    this.setFlag(x, y, 16777216);
				} else {
                    this.setFlag(x, y, 16777215);
				}
			}
		}
    }

    getFlag(x: number, y: number): number {
        return this.flags[x + y * this.width];
    }

    setFlag(x: number, y: number, flag: number): void {
        this.flags[x + y * this.width] = flag;
    }

    flag(x: number, y: number, flag: number): void {
        this.flags[x + y * this.width] |= flag;
    }

    unflag(x: number, y: number, flag: number): void {
        this.flags[x + y * this.width] &= ~flag;
    }
}
