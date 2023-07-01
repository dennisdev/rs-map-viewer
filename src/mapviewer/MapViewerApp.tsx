import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DownloadProgress } from "../client/fs/FileSystem";
import {
    CacheInfo,
    deleteOldCaches,
    fetchCacheList,
    getLatestCache,
    loadCache,
} from "./CacheInfo";
import { MapViewer } from "./MapViewer";
import { fetchNpcSpawns } from "./npc/NpcSpawn";
import { fetchItemSpawns } from "./item/ItemSpawn";
import { isIos, isWallpaperEngine } from "./util/DeviceUtil";
import { ChunkLoaderWorkerPool } from "./chunk/ChunkLoaderWorkerPool";
import WebFont from "webfontloader";
import { OsrsLoadingBar } from "../components/OsrsLoadingBar";
import { formatBytes } from "./util/BytesUtil";
import { MapViewerContainer } from "./MapViewerContainer";

const MAX_POOL_SIZE = isWallpaperEngine ? 1 : 4;

const poolSize = Math.min(navigator.hardwareConcurrency, MAX_POOL_SIZE);
const pool = ChunkLoaderWorkerPool.init(poolSize);
// console.log('start App', performance.now());

const cachesPromise = fetchCacheList();

export function MapViewerApp() {
    const [downloadProgress, setDownloadProgress] = useState<
        DownloadProgress | undefined
    >(undefined);
    const [mapViewer, setMapViewer] = useState<MapViewer | undefined>(
        undefined
    );
    const [caches, setCaches] = useState<CacheInfo[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();

    // const test = new Test();

    useEffect(() => {
        // console.log('start fetch', performance.now());
        console.time("first load");
        const load = async () => {
            const npcSpawnsPromise = fetchNpcSpawns();
            const itemSpawnsPromise = fetchItemSpawns();

            const cacheNameParam = searchParams.get("cache");
            const caches = await cachesPromise;
            deleteOldCaches(caches);
            const latestCacheInfo = getLatestCache(caches);
            if (!latestCacheInfo) {
                console.error("Could not load the latest cache info");
                return;
            }

            let cacheInfo: CacheInfo | undefined = undefined;
            if (cacheNameParam) {
                cacheInfo = caches.find(
                    (cache) => cache.name === cacheNameParam
                );
            }
            if (!cacheInfo) {
                cacheInfo = latestCacheInfo;
            }

            const loadedCache = await loadCache(cacheInfo, setDownloadProgress);
            setDownloadProgress(undefined);

            console.time("load npc spawns");
            const npcSpawns = await npcSpawnsPromise;
            console.timeEnd("load npc spawns");

            console.time("load item spawns");
            const itemSpawns = await itemSpawnsPromise;
            console.timeEnd("load item spawns");

            console.log("item spawn count", itemSpawns.length);

            const mapViewer = new MapViewer(
                pool,
                loadedCache,
                latestCacheInfo,
                npcSpawns,
                itemSpawns
            );
            mapViewer.applySearchParams(searchParams);

            setCaches(caches);
            setMapViewer(mapViewer);
        };

        if (!isIos) {
            load().catch(console.error);
        }

        WebFont.load({
            custom: {
                families: ["OSRS"],
            },
        });
    }, []);

    let content: JSX.Element | undefined = undefined;
    if (isIos) {
        content = (
            <div className="center-content-container">
                <div className="content-text">iOS is not supported.</div>
            </div>
        );
    } else if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress =
            ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        content = (
            <div className="center-content-container">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    } else if (mapViewer) {
        content = (
            <MapViewerContainer
                mapViewer={mapViewer}
                caches={caches}
            ></MapViewerContainer>
        );
    }
    return <div className="App">{content}</div>;
}
