import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { registerSerializer } from "threads";
import WebFont from "webfontloader";

import { OsrsLoadingBar } from "../components/rs/loading/OsrsLoadingBar";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { formatBytes } from "../util/BytesUtil";
import { isIos, isWallpaperEngine } from "../util/DeviceUtil";
import { renderDataLoaderSerializer } from "../worker/RenderDataLoader";
import { RenderDataWorkerPool } from "../worker/RenderDataWorkerPool";
import { fetchCacheList, loadCacheFiles } from "./Caches";
import { MapViewer } from "./MapViewer";
import { MapViewerContainer } from "./MapViewerContainer";
import { getAvailableRenderers } from "./MapViewerRenderers";
import { fetchNpcSpawns, getNpcSpawnsUrl } from "./data/npc/NpcSpawn";
import { fetchObjSpawns } from "./data/obj/ObjSpawn";

registerSerializer(renderDataLoaderSerializer);

WebFont.load({
    custom: {
        families: ["OSRS Bold", "OSRS Small"],
    },
});

function MapViewerApp() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [errorMessage, setErrorMessage] = useState<string>();
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();
    const [mapViewer, setMapViewer] = useState<MapViewer>();

    useEffect(() => {
        const abortController = new AbortController();

        let workerPool: RenderDataWorkerPool | undefined;

        const load = async () => {
            workerPool = RenderDataWorkerPool.create(
                isWallpaperEngine ? 1 : Math.min(4, navigator.hardwareConcurrency),
            );

            const objSpawnsPromise = fetchObjSpawns();

            const cacheList = await fetchCacheList();
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

            const mapImageCache = await caches.open("map-images");

            const availableRenderers = getAvailableRenderers();
            if (availableRenderers.length === 0) {
                setErrorMessage("No renderers available");
                return;
            }

            // Add some way to get preferred renderer
            const rendererType = availableRenderers[0];

            const mapViewer = new MapViewer(
                workerPool,
                cacheList,
                objSpawns,
                npcSpawns,
                mapImageCache,
                rendererType,
                cache,
            );
            mapViewer.applySearchParams(searchParams);
            mapViewer.init();

            setMapViewer(mapViewer);
            setDownloadProgress(undefined);
        };

        if (isIos) {
            setErrorMessage("iOS is not supported.");
        } else {
            load().catch(console.error);
        }

        return () => {
            abortController.abort();
            if (workerPool) {
                workerPool.terminate();
            }
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
