import { ByteBuffer } from "../../util/ByteBuffer";
import { MemoryFsDat2 } from "../FileSystem";
import { IndexType } from "../IndexType";
import { CacheInfo } from "../Types";
import { Definition } from "./Definition";

const DEFAULT_ID = 3;

export class GraphicDefaults extends Definition {
    compass: number = -1;
    mapEdge: number = -1;
    mapScenes: number = -1;
    headIconsPk: number = -1;
    headIconsPrayer: number = -1;
    headIconsHint: number = -1;
    mapMarkers: number = -1;
    crosses: number = -1;
    mapDots: number = -1;
    scrollBars: number = -1;
    modIcons: number = -1;

    static load(
        fileSystem: MemoryFsDat2,
        cacheInfo: CacheInfo
    ): GraphicDefaults {
        if (fileSystem.indexExists(IndexType.GRAPHIC_DEFAULTS)) {
            const defaultsIndex = fileSystem.getIndex(
                IndexType.GRAPHIC_DEFAULTS
            );
            const defaultsFile = defaultsIndex.getFile(DEFAULT_ID, 0);
            if (!defaultsFile) {
                throw new Error("GraphicDefaults: File not found");
            }

            const defaults = new GraphicDefaults(
                defaultsFile.archiveId,
                cacheInfo
            );
            defaults.decode(new ByteBuffer(defaultsFile.data));

            return defaults;
        } else {
            const spriteIndex = fileSystem.getIndex(IndexType.SPRITES);

            const defaults = new GraphicDefaults(-1, cacheInfo);
            defaults.compass = spriteIndex.getArchiveId("compass");
            defaults.mapEdge = spriteIndex.getArchiveId("mapedge");
            defaults.mapScenes = spriteIndex.getArchiveId("mapscene");
            defaults.headIconsPk = spriteIndex.getArchiveId("headicons_pk");
            defaults.headIconsPrayer =
                spriteIndex.getArchiveId("headicons_prayer");
            defaults.headIconsHint = spriteIndex.getArchiveId("headicons_hint");
            defaults.mapMarkers = spriteIndex.getArchiveId("mapmarker");
            defaults.crosses = spriteIndex.getArchiveId("cross");
            defaults.mapDots = spriteIndex.getArchiveId("mapdots");
            defaults.scrollBars = spriteIndex.getArchiveId("scrollbar");
            defaults.modIcons = spriteIndex.getArchiveId("mod_icons");

            return defaults;
        }
    }

    decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        switch (opcode) {
            case 1:
                buffer.readMedium();
                break;
            case 2:
                this.compass = buffer.readBigSmart();
                this.mapEdge = buffer.readBigSmart();
                this.mapScenes = buffer.readBigSmart();
                this.headIconsPk = buffer.readBigSmart();
                this.headIconsPrayer = buffer.readBigSmart();
                this.headIconsHint = buffer.readBigSmart();
                this.mapMarkers = buffer.readBigSmart();
                this.crosses = buffer.readBigSmart();
                this.mapDots = buffer.readBigSmart();
                this.scrollBars = buffer.readBigSmart();
                this.modIcons = buffer.readBigSmart();
                break;
        }
    }
}
