export enum ApiType {
    SYNC,
    ASYNC,
}

export type ApiReturnType<A extends ApiType, T> = A extends ApiType.SYNC ? T : Promise<T>;
