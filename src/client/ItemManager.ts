import { Archive } from "./fs/Archive";
import { ItemDefinition } from "./fs/definition/ItemDefinition";
import { ParamManager } from "./ParamManager";

export class ItemManager {
    private readonly archive: Archive;

    private readonly paramManager: ParamManager;

    private inMembersWorld: boolean;

    // TODO: Use jagex collections
    private definitionCache: Map<number, ItemDefinition>;

    itemCount: number;

    constructor(
        archive: Archive,
        paramManager: ParamManager,
        inMembersWorld: boolean
    ) {
        this.archive = archive;
        this.paramManager = paramManager;
        this.inMembersWorld = inMembersWorld;
        this.definitionCache = new Map();
        this.itemCount = archive.fileCount;
    }

    setInMembersWorld(members: boolean): void {
        if (this.inMembersWorld != members) {
            // clear caches
            this.definitionCache.clear();
            this.inMembersWorld = members;
        }
    }

    getDefinition(id: number): ItemDefinition {
        const cached = this.definitionCache.get(id);
        if (cached) {
            return cached;
        }

        const file = this.archive.getFile(id);

        const def = new ItemDefinition(id);
        if (file) {
            def.decode(file.getDataAsBuffer());
        }
        def.post();
        if (def.noteTemplate !== -1) {
            def.genCert(
                this.getDefinition(def.noteTemplate),
                this.getDefinition(def.note)
            );
        }
        if (def.notedId !== -1) {
            def.genBought(
                this.getDefinition(def.notedId),
                this.getDefinition(def.unnotedId)
            );
        }
        if (def.placeholderTemplate !== -1) {
            def.genPlaceholder(
                this.getDefinition(def.placeholderTemplate),
                this.getDefinition(def.placeholder)
            );
        }

        if (!this.inMembersWorld && def.isMembers) {
            def.name = "Members object";
            def.isTradable = false;

            for (let i = 0; i < def.groundActions.length; i++) {
                def.groundActions[i] = null;
            }

            for (let i = 0; i < def.inventoryActions.length; i++) {
                if (i !== 4) {
                    def.inventoryActions[i] = null;
                }
            }

            def.shiftClickIndex = -2;
            def.team = 0;
            if (def.params) {
                let hasValidParam = false;

                for (let key of Array.from(def.params.keys())) {
                    const param = this.paramManager.getDefinition(key);
                    if (param.autoDisable) {
                        def.params.delete(key);
                    } else {
                        hasValidParam = true;
                    }
                }

                if (!hasValidParam) {
                    def.params = undefined;
                }
            }
        }

        this.definitionCache.set(id, def);
        return def;
    }
}
