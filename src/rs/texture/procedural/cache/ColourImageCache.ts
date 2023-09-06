import Denque from "denque";

export class ColourImageCacheSlot {
    constructor(
        public readonly imageId: number,
        public readonly slotId: number,
    ) {}
}

export class ColourImageCache {
    static SLOT_USED = new ColourImageCacheSlot(0, 0);

    slotCount: number;

    maxId: number;

    usageTracker: Denque<ColourImageCacheSlot>;

    images: Int32Array[][];

    slots: ColourImageCacheSlot[];

    usedSlots: number;

    lastRequest: number;

    dirty: boolean;

    constructor(slotCount: number, maxId: number, imageSize: number) {
        this.slotCount = slotCount;
        this.maxId = maxId;
        this.usageTracker = new Denque<ColourImageCacheSlot>();
        this.images = new Array(slotCount);
        for (let i = 0; i < slotCount; i++) {
            this.images[i] = new Array(3);
            for (let p = 0; p < 3; p++) {
                this.images[i][p] = new Int32Array(imageSize);
            }
        }
        this.slots = new Array(slotCount);
        this.usedSlots = 0;
        this.lastRequest = -1;
        this.dirty = false;
    }

    get(req: number): Int32Array[] {
        if (this.slotCount === this.maxId) {
            this.dirty = this.slots[req] === undefined;
            this.slots[req] = ColourImageCache.SLOT_USED;
            return this.images[req];
        } else if (this.slotCount === 1) {
            this.dirty = req !== this.lastRequest;
            this.lastRequest = req;
            return this.images[0];
        } else {
            let slot = this.slots[req];
            if (slot === undefined) {
                this.dirty = true;
                if (this.slotCount > this.usedSlots) {
                    slot = new ColourImageCacheSlot(req, this.usedSlots);
                    this.usedSlots++;
                } else {
                    const oldSlot = this.usageTracker.pop();
                    if (oldSlot) {
                        slot = new ColourImageCacheSlot(req, oldSlot.slotId);
                        delete this.slots[oldSlot.imageId];
                    }
                }
                this.slots[req] = slot;
            } else {
                this.dirty = false;
            }
            // Remove the slot from the usage tracker and add it to the front
            for (let i = 0; i < this.usageTracker.length; i++) {
                if (this.usageTracker.peekAt(i) === slot) {
                    this.usageTracker.removeOne(i);
                    break;
                }
            }
            this.usageTracker.unshift(slot);
            return this.images[slot.slotId];
        }
    }
}
