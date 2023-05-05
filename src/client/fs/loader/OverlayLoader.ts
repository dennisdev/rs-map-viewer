import { Archive } from "../Archive";
import { OverlayDefinition } from "../definition/OverlayDefinition";
import {
    ArchiveDefinitionLoader,
    CachedArchiveDefinitionLoader,
} from "./DefinitionLoader";

export class OverlayLoader extends ArchiveDefinitionLoader<OverlayDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, OverlayDefinition, revision);
    }
}

export class CachedOverlayLoader extends CachedArchiveDefinitionLoader<OverlayDefinition> {
    constructor(archive: Archive, revision: number) {
        super(archive, OverlayDefinition, revision);
    }
}
