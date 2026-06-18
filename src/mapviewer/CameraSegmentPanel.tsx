import { DurationMode } from "./CameraTrack";

interface CameraSegmentPanelProps {
    segmentCount: number;
    durationMode: DurationMode;
    segmentDurations: number[];
    onSegmentDurationChange: (index: number, value: number) => void;
    onHighlight: (index: number) => void;
    hidden: boolean;
}

const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: 10,
    top: 10,
    zIndex: 10,
    maxHeight: "60vh",
    overflowY: "auto",
    padding: "6px 8px",
    background: "rgba(20, 22, 26, 0.85)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    color: "#e6e6e6",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: "20px",
    userSelect: "none",
    minWidth: 150,
    pointerEvents: "auto",
};

const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "2px 4px",
    borderRadius: 4,
    cursor: "default",
};

/**
 * Floating list of the rail's segments. Hovering a row highlights that segment
 * in the world (via {@link CameraSegmentPanelProps.onHighlight}); in PER_SEGMENT
 * duration mode each row also hosts an editable per-segment duration.
 *
 * Rendered as a sibling to the Leva panel because Leva controls don't expose
 * mouse hover events.
 */
export function CameraSegmentPanel({
    segmentCount,
    durationMode,
    segmentDurations,
    onSegmentDurationChange,
    onHighlight,
    hidden,
}: CameraSegmentPanelProps): JSX.Element | null {
    if (hidden || segmentCount <= 0) {
        return null;
    }
    const perSegment = durationMode === DurationMode.PER_SEGMENT;
    const rows: JSX.Element[] = [];
    for (let i = 0; i < segmentCount; i++) {
        rows.push(
            <div
                key={i}
                style={rowStyle}
                onMouseEnter={() => onHighlight(i)}
                onMouseLeave={() => onHighlight(-1)}
            >
                <span>
                    Seg {i}: {i}→{i + 1}
                </span>
                {perSegment && (
                    <input
                        type="number"
                        value={segmentDurations[i] ?? 0}
                        min={0.1}
                        step={0.1}
                        style={{ width: 56 }}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            onSegmentDurationChange(i, isNaN(v) ? 0 : v);
                        }}
                    />
                )}
            </div>,
        );
    }
    return (
        <div style={panelStyle}>
            <div style={{ opacity: 0.6, marginBottom: 2 }}>Segments</div>
            {rows}
        </div>
    );
}
