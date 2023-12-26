import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { MenuEntry, MenuTargetType } from "../../../rs/MenuEntry";
import "./OsrsMenu.css";

function getTargetClassName(type: MenuTargetType): string {
    switch (type) {
        case MenuTargetType.NPC:
            return "npc-name";
        case MenuTargetType.LOC:
            return "object-name";
        case MenuTargetType.OBJ:
            return "item-name";
        default:
            return "";
    }
}

export interface OsrsMenuEntry extends MenuEntry {
    onClick?: (entry: MenuEntry) => void;
}

export interface OsrsMenuProps {
    x: number;
    y: number;
    entries: OsrsMenuEntry[];
    tooltip: boolean;
    debugId: boolean;
}

function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
}

const BORDER_SIZE = 10;

export function OsrsMenu({
    x,
    y,
    entries,
    tooltip,
    debugId,
}: OsrsMenuProps): JSX.Element | undefined {
    const [realX, setX] = useState(x);
    const [realY, setY] = useState(y);

    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (ref.current) {
            let { width, height } = ref.current.getBoundingClientRect();

            let realX: number;
            let realY: number;
            if (tooltip) {
                realX = x;
                realY = y + 20;
            } else {
                width -= BORDER_SIZE * 2;
                height -= BORDER_SIZE * 2;
                realX = x - width / 2 - BORDER_SIZE;
                realY = y - BORDER_SIZE;
            }
            if (ref.current.parentElement) {
                const parentRect = ref.current.parentElement.getBoundingClientRect();
                realX = Math.max(
                    Math.min(realX, parentRect.width - width - BORDER_SIZE),
                    -BORDER_SIZE,
                );
                realY = Math.max(
                    Math.min(realY, parentRect.height - height - BORDER_SIZE),
                    -BORDER_SIZE,
                );
            }
            setX(realX);
            setY(realY);
        }
    }, [x, y, entries, tooltip]);

    const onFocus = useCallback(
        (e: React.FocusEvent) => {
            if (tooltip) {
                e.preventDefault();
            }
        },
        [tooltip],
    );

    const onOptionClicked = useCallback(
        (e: React.MouseEvent) => {
            const index = parseInt(e.currentTarget.getAttribute("data-index") ?? "0");
            const entry = entries[index];
            if (entry.onClick) {
                entry.onClick(entry);
            }
            // console.log("clicked", entry);
        },
        [entries],
    );

    if (tooltip) {
        entries = entries.filter(
            (entry) =>
                entry.option !== "Walk here" &&
                entry.option !== "Examine" &&
                entry.option !== "Cancel",
        );
        if (entries.length === 0) {
            return undefined;
        }
        entries.length = 1;
    }

    const optionElements = entries.map((entry, index) => {
        return (
            <div
                className="option"
                key={entry.option + "-" + entry.targetId + "-" + index}
                data-index={index}
                onClick={onOptionClicked}
            >
                <span className="option-name">{entry.option}</span>{" "}
                {entry.targetType !== MenuTargetType.NONE && (
                    <span className={getTargetClassName(entry.targetType)}>{entry.targetName}</span>
                )}{" "}
                {entry.targetLevel > 0 && (
                    <span className="npc-level">
                        {" (Level-"}
                        {entry.targetLevel}
                        {")"}
                    </span>
                )}
                {debugId && entry.targetId !== -1 && (
                    <span className="target-id">{" (Id-" + entry.targetId + ")"}</span>
                )}
            </div>
        );
    });

    return (
        <div
            className={`context-menu-container ${tooltip ? "tooltip" : ""}`}
            ref={ref}
            style={{ left: realX, top: realY }}
            onContextMenu={onContextMenu}
            onFocus={onFocus}
        >
            <div className="context-menu">
                {!tooltip && <div className="title">Choose Option</div>}
                {!tooltip && <div className="line"></div>}
                <div className="options">{optionElements}</div>
            </div>
        </div>
    );
}
