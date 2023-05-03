export type Xteas = Map<number, number[]>;

export async function fetchXteas(url: RequestInfo): Promise<Xteas> {
    const resp = await fetch(url);
    const data = await resp.json();
    return new Map(Object.keys(data).map((key) => [parseInt(key), data[key]]));
}
