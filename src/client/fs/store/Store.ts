export abstract class Store<T> {
    abstract read(indexId: number, archiveId: number): T;
}

export abstract class StoreAsync extends Store<Promise<Int8Array>> {}

export abstract class StoreSync extends Store<Int8Array> {}
