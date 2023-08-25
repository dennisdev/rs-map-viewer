import { ApiReturnType, ApiType } from "../ApiType";

export interface CacheStore<A extends ApiType> {
    read(indexId: number, archiveId: number): ApiReturnType<A, Int8Array>;
}
