export const SINE = new Int32Array(2048);
export const COSINE = new Int32Array(2048);

for (let i = 0; i < 2048; i++) {
    SINE[i] = (65536.0 * Math.sin(i * 0.0030679615)) | 0;
    COSINE[i] = (65536.0 * Math.cos(i * 0.0030679615)) | 0;
}

export class Client {

}
