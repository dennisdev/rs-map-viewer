import { ApiType, CacheType } from "../Types";

export abstract class BaseStore<A extends ApiType, T extends CacheType> {
    constructor(public readonly cacheType: T) {}

    abstract read(
        indexId: number,
        archiveId: number
    ): A extends ApiType.SYNC ? Int8Array : Promise<Int8Array>;

    getSectorIndexId(indexId: number): number {
        if (this.cacheType === CacheType.DAT) {
            return indexId + 1;
        }
        return indexId;
    }
}

export abstract class Store<T extends CacheType> extends BaseStore<
    ApiType.SYNC,
    T
> {}
export abstract class StoreAsync<T extends CacheType> extends BaseStore<
    ApiType.ASYNC,
    T
> {}
