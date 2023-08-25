export abstract class RouteStrategy {
    approxDestX: number = 0;
    approxDestY: number = 0;
    destSizeX: number = 1;
    destSizeY: number = 1;

    abstract hasArrived(tileX: number, tileY: number, level: number): boolean;
}

export class ExactRouteStrategy extends RouteStrategy {
    hasArrived(tileX: number, tileY: number, level: number): boolean {
        return tileX === this.approxDestX && tileY === this.approxDestY;
    }
}
