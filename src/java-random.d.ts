declare module "java-random" {
    export default class JavaRandom {
        constructor(seed: number);
        nextInt(bound?: number): number;
    }
}
