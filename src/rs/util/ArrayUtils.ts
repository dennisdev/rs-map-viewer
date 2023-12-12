export class ArrayUtils {
    static fill(array: Int32Array, start: number, length: number, value: number) {
        array.fill(value, start, start + length);
        // for (let i = start; i < start + length; i++) {
        //     array[i] = value;
        // }
    }
}
