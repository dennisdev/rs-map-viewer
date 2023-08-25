import * as PicoGL from "picogl";

declare module "picogl" {
    export interface DrawCall extends Omit<PicoGL.DrawCall, "numElements"> {
        offsets: number[];
        numElements: number[];
    }

    import PicoGL, {
        App,
        DrawCall,
        VertexArray,
        VertexBuffer,
        Texture,
        Program,
        UniformBuffer,
    } from "picogl";

    export default PicoGL;
    export { PicoGL, App, DrawCall, VertexArray, VertexBuffer, Texture, Program, UniformBuffer };
}
