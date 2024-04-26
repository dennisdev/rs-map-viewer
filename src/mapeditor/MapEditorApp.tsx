import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { OsrsLoadingBar } from "../components/rs/loading/OsrsLoadingBar";
import { fetchCacheList, loadCacheFiles } from "../util/Caches";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { formatBytes } from "../util/BytesUtil";
import { RenderDataWorkerPool } from "../worker/RenderDataWorkerPool";
import { MapEditor } from "./MapEditor";
import { MapEditorContainer } from "./MapEditorContainer";

export function MapEditorApp(): JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();

    const [errorMessage, setErrorMessage] = useState<string>();
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();
    const [mapEditor, setMapEditor] = useState<MapEditor>();

    useEffect(() => {
        const abortController = new AbortController();

        let workerPool: RenderDataWorkerPool | undefined;

        const load = async () => {
            workerPool = RenderDataWorkerPool.create(Math.min(4, navigator.hardwareConcurrency));

            const cacheList = await fetchCacheList();
            if (!cacheList) {
                setErrorMessage("Failed to load cache list");
                throw new Error("No caches found");
            }

            const cacheInfo = cacheList.latest;

            const cache = await loadCacheFiles(
                cacheInfo,
                abortController.signal,
                setDownloadProgress,
            );

            const mapEditor = new MapEditor(workerPool, cacheList, cache);
            mapEditor.applySearchParams(searchParams);

            setMapEditor(mapEditor);
            setDownloadProgress(undefined);
        };

        load().catch(console.error);

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
    } else if (mapEditor) {
        content = <MapEditorContainer mapEditor={mapEditor} />;
    }

    return <div className="App max-height">{content}</div>;
}
