export abstract class Renderable {
    height: number;

    constructor() {
        this.height = 1000;
    }
}

class DummyRenderable extends Renderable {
    constructor() {
        super();
    }
}

export const DUMMY_RENDERABLE = new DummyRenderable();
