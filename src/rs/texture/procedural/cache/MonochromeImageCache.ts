import Denque from "denque";

export class MonochromeImageCacheSlot {
    constructor(
        public readonly imageId: number,
        public readonly slotId: number,
    ) {}
}

export class MonochromeImageCache {
    static SLOT_USED = new MonochromeImageCacheSlot(0, 0);

    slotCount: number;

    maxId: number;

    usageTracker: Denque<MonochromeImageCacheSlot>;

    images: Int32Array[];

    slots: MonochromeImageCacheSlot[];

    usedSlots: number;

    lastRequest: number;

    dirty: boolean;

    constructor(slotCount: number, maxId: number, imageSize: number) {
        this.slotCount = slotCount;
        this.maxId = maxId;
        this.usageTracker = new Denque<MonochromeImageCacheSlot>();
        this.images = new Array(slotCount);
        for (let i = 0; i < slotCount; i++) {
            this.images[i] = new Int32Array(imageSize);
        }
        this.slots = new Array(slotCount);
        this.usedSlots = 0;
        this.lastRequest = -1;
        this.dirty = false;
    }

    get(req: number): Int32Array {
        if (this.slotCount === this.maxId) {
            this.dirty = this.slots[req] === undefined;
            this.slots[req] = MonochromeImageCache.SLOT_USED;
            return this.images[req];
        } else if (this.slotCount === 1) {
            this.dirty = req !== this.lastRequest;
            this.lastRequest = req;
            return this.images[0];
        } else {
            let slot = this.slots[req];
            if (slot === undefined) {
                this.dirty = true;
                if (this.usedSlots < this.slotCount) {
                    slot = new MonochromeImageCacheSlot(req, this.usedSlots);
                    this.usedSlots++;
                } else {
                    const oldSlot = this.usageTracker.pop();
                    if (oldSlot) {
                        slot = new MonochromeImageCacheSlot(req, oldSlot.slotId);
                        delete this.slots[oldSlot.imageId];
                    }
                }
                this.slots[req] = slot;
            } else {
                this.dirty = false;
            }
            this.usageTracker.unshift(slot);
            return this.images[slot.slotId];
        }
    }

    getAll(): Int32Array[] {
        if (this.maxId !== this.slotCount) {
            throw new Error("Can only retrieve a full image cache");
        }
        for (let slot = 0; slot < this.slotCount; slot++) {
            this.slots[slot] = MonochromeImageCache.SLOT_USED;
        }
        return this.images;
    }
}
