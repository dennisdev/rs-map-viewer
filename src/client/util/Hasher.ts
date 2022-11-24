import xxhash, { XXHashAPI } from "xxhash-wasm";

export class Hasher {
    static hashApi: XXHashAPI | undefined;

    static init(): Promise<XXHashAPI> {
        const promise = xxhash();
        promise.then(api => Hasher.hashApi = api);
        return promise;
    }

    static hash(data: Uint8Array): bigint {
        if (Hasher.hashApi) {
            return Hasher.hashApi.h64Raw(data);
        }
        return Hasher.hashFallback(data);
    }

    static hashFallback(data: Uint8Array): bigint {
        let bits = 8n

        let ret = 0n
        for (const i of data.values()) {
            const bi = BigInt(i)
            ret = (ret << bits) + bi
        }
        return ret
    }
}
