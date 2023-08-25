import { useEffect, useState } from "react";
import { fetchCacheList, loadCacheFiles } from "./Caches";
import { renderDataLoaderSerializer } from "./worker/RenderDataLoader";
import { registerSerializer } from "threads/worker";
import { RenderDataWorkerPool } from "./worker/RenderDataWorkerPool";
import { MapViewer } from "./MapViewer";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { OsrsLoadingBar } from "../components/rs/loading/OsrsLoadingBar";
import { formatBytes } from "../util/BytesUtil";
import { MapViewerContainer } from "./MapViewerContainer";
import { useSearchParams } from "react-router-dom";
import WebFont from "webfontloader";
import { fetchObjSpawns } from "./data/obj/ObjSpawn";
import { fetchNpcSpawns, getNpcSpawnsUrl } from "./data/npc/NpcSpawn";
import { isIos, isWallpaperEngine } from "../util/DeviceUtil";

registerSerializer(renderDataLoaderSerializer);

WebFont.load({
    custom: {
        families: ["OSRS Bold", "OSRS Small"],
    },
});

const cachesPromise = fetchCacheList();

const workerPool = RenderDataWorkerPool.create(isWallpaperEngine ? 1 : 4);

function MapViewerApp() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [errorMessage, setErrorMessage] = useState<string>();
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();
    const [mapViewer, setMapViewer] = useState<MapViewer>();

    useEffect(() => {
        const abortController = new AbortController();

        const load = async () => {
            const objSpawnsPromise = fetchObjSpawns();

            const cacheList = await cachesPromise;
            if (!cacheList) {
                setErrorMessage("Failed to load cache list");
                throw new Error("No caches found");
            }

            const cacheNameParam = searchParams.get("cache");
            let cacheInfo = cacheList.latest;
            if (cacheNameParam) {
                const foundCache = cacheList.caches.find((cache) => cache.name === cacheNameParam);
                if (foundCache) {
                    cacheInfo = foundCache;
                }
            }

            const [cache, objSpawns, npcSpawns] = await Promise.all([
                loadCacheFiles(cacheInfo, abortController.signal, setDownloadProgress),
                objSpawnsPromise,
                fetchNpcSpawns(getNpcSpawnsUrl(cacheInfo)),
            ]);

            const mapViewer = new MapViewer(workerPool, cacheList, objSpawns, npcSpawns, cache);
            mapViewer.applySearchParams(searchParams);
            mapViewer.init();
            // mapViewer.initCache(cache);

            setDownloadProgress(undefined);
            setMapViewer(mapViewer);
        };

        if (isIos) {
            setErrorMessage("iOS is not supported.");
        } else {
            load().catch(console.error);
        }

        return () => {
            abortController.abort();
        };
    }, []);

    let content: JSX.Element | undefined;
    if (errorMessage) {
        content = <div className="center-container max-height content-text">{errorMessage}</div>;
    } else if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress = ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        content = (
            <div className="center-container max-height">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    } else if (mapViewer) {
        content = <MapViewerContainer mapViewer={mapViewer} />;
    }

    return <div className="App max-height">{content}</div>;
}

export default MapViewerApp;
