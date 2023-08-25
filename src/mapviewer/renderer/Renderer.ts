import { App as PicoApp } from "picogl";
import { CacheSystem } from "../../rs/cache/CacheSystem";
import { CacheLoaderFactory } from "../../rs/cache/loader/CacheLoaderFactory";
import { MapManager, MapSquare } from "./MapManager";

export abstract class Renderer<T extends MapSquare> {
    abstract mapManager: MapManager<T>;

    abstract init(app: PicoApp): void;

    abstract initCache(
        app: PicoApp | undefined,
        cacheSystem: CacheSystem,
        loaderFacory: CacheLoaderFactory,
    ): void;

    abstract render(
        app: PicoApp,
        time: DOMHighResTimeStamp,
        deltaTimeSec: number,
        resized: boolean,
    ): void;

    abstract clearMaps(): void;

    abstract cleanup(app: PicoApp): void;
}
