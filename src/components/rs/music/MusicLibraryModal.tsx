import { memo, useEffect, useMemo, useState } from "react";
import Modal from "react-modal";

import { MusicEntry } from "../../../mapviewer/music/MusicTrackIndex";
import "./MusicLibraryModal.css";

interface MusicLibraryModalProps {
    isOpen: boolean;
    tracks: MusicEntry[];
    currentCacheId: number | undefined;
    onRequestClose: () => void;
    onSelect: (entry: MusicEntry) => void;
}

const PAGE_SIZE = 50;

export const MusicLibraryModal = memo(function MusicLibraryModal({
    isOpen,
    tracks,
    currentCacheId,
    onRequestClose,
    onSelect,
}: MusicLibraryModalProps): JSX.Element {
    const [query, setQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setVisibleCount(PAGE_SIZE);
        }
    }, [isOpen]);

    const filtered = useMemo<MusicEntry[]>(() => {
        const q = query.trim().toLowerCase();
        if (!q) {
            return tracks;
        }
        return tracks.filter((entry) => {
            if (entry.name.toLowerCase().includes(q)) {
                return true;
            }
            if (entry.sortName && entry.sortName.toLowerCase().includes(q)) {
                return true;
            }
            if (entry.location && entry.location.toLowerCase().includes(q)) {
                return true;
            }
            if (entry.composer && entry.composer.toLowerCase().includes(q)) {
                return true;
            }
            for (const alias of entry.aliases) {
                if (alias.toLowerCase().includes(q)) {
                    return true;
                }
            }
            return false;
        });
    }, [tracks, query]);

    const visible = filtered.slice(0, visibleCount);

    const close = () => {
        onRequestClose();
    };

    const handleSelect = (entry: MusicEntry) => {
        onSelect(entry);
        close();
    };

    return (
        <Modal
            className="music-library-modal rs-border rs-background"
            overlayClassName="music-library-overlay"
            isOpen={isOpen}
            onRequestClose={close}
        >
            <div className="music-library-close content-text" onClick={close}>
                ×
            </div>
            <div className="music-library-header content-text">Music Library</div>
            <input
                className="music-library-search rs-border content-text"
                type="text"
                placeholder="Search by name, location, composer…"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setVisibleCount(PAGE_SIZE);
                }}
                autoFocus
            />
            <div className="music-library-count content-text">
                {filtered.length} track{filtered.length === 1 ? "" : "s"}
                {query && ` match "${query}"`}
            </div>
            <div
                className="music-library-list"
                onScroll={(e) => {
                    const el = e.currentTarget;
                    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
                        setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
                    }
                }}
            >
                {visible.map((entry) => {
                    const isCurrent =
                        currentCacheId !== undefined && entry.cacheId === currentCacheId;
                    const disabled = entry.cacheId === undefined;
                    return (
                        <div
                            key={`${entry.cacheId ?? entry.name}-${entry.name}`}
                            className={
                                "music-library-row content-text" +
                                (isCurrent ? " current" : "") +
                                (disabled ? " disabled" : "")
                            }
                            onClick={() => !disabled && handleSelect(entry)}
                            title={
                                disabled
                                    ? "No cache id — cannot play this track"
                                    : (entry.location ?? entry.name)
                            }
                        >
                            <div className="music-library-row-name">
                                {isCurrent && <span className="music-library-playing">▶</span>}
                                {entry.name}
                            </div>
                            <div className="music-library-row-meta">
                                {entry.composer && <span>{entry.composer}</span>}
                                {entry.duration && <span>{entry.duration}</span>}
                                {entry.cacheId === undefined && <span>(metadata only)</span>}
                            </div>
                        </div>
                    );
                })}
                {visible.length === 0 && (
                    <div className="music-library-empty content-text">No tracks found</div>
                )}
            </div>
        </Modal>
    );
});
