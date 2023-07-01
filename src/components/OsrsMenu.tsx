import { useLayoutEffect, useRef, useState } from "react";
import "./OsrsMenu.css";
import { InteractType } from "../mapviewer/chunk/InteractType";

export type Target = {
    name: string;
    type: InteractType;
};

export type MenuOption = {
    id: number;
    action: string;
    target?: Target;
    level?: number;
    onClick?: () => void;
};

function getTargetClassName(type: InteractType) {
    switch (type) {
        case InteractType.OBJECT:
            return "object-name";
        case InteractType.NPC:
            return "npc-name";
        case InteractType.ITEM:
            return "item-name";
    }
}

export interface OsrsMenuProps {
    x: number;
    y: number;
    options: MenuOption[];
    tooltip: boolean;
    debugId: boolean;
}

export function OsrsMenu({
    x,
    y,
    options,
    tooltip,
    debugId,
}: OsrsMenuProps): JSX.Element {
    const [realX, setX] = useState(x);
    const [realY, setY] = useState(y);

    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (ref.current) {
            const { width, height } = ref.current.getBoundingClientRect();
            let realX = x - width / 2;
            let realY = y;
            if (tooltip) {
                realX = x;
                realY = y + 20;
            }
            if (ref.current.parentElement) {
                const parentRect =
                    ref.current.parentElement.getBoundingClientRect();
                realX = Math.max(Math.min(realX, parentRect.width - width), 0);
                realY = Math.max(
                    Math.min(realY, parentRect.height - height),
                    0
                );
            }
            setX(realX);
            setY(realY);
        }
    }, [x, y, options, tooltip]);

    if (tooltip) {
        options = options.filter(
            (option) =>
                option.action !== "Walk here" &&
                option.action !== "Examine" &&
                option.action !== "Cancel"
        );
        if (options.length === 0) {
            return <span style={{ display: "none" }}></span>;
        }
        options = [options[0]];
    }

    const optionElements = options.map((option, index) => {
        return (
            <div
                className="option"
                key={option.action + "-" + option.id + "-" + index}
                onClick={option.onClick}
            >
                <span className="option-name">{option.action}</span>{" "}
                {option.target && (
                    <span className={getTargetClassName(option.target.type)}>
                        {option.target.name}
                    </span>
                )}{" "}
                {option.level !== undefined && option.level > 0 && (
                    <span className="npc-level">
                        {" (Level-"}
                        {option.level}
                        {")"}
                    </span>
                )}
                {debugId && option.id !== -1 && (
                    <span className="target-id">
                        {" (Id-" + option.id + ")"}
                    </span>
                )}
            </div>
        );
    });

    return (
        <div
            className={`context-menu-container ${tooltip ? "tooltip" : ""}`}
            ref={ref}
            style={{ left: realX, top: realY }}
            onContextMenu={(e) => {
                e.preventDefault();
            }}
            onFocus={(e) => {
                if (tooltip) {
                    e.preventDefault();
                }
            }}
        >
            <div className="context-menu">
                {!tooltip && <div className="title">Choose Option</div>}
                {!tooltip && <div className="line"></div>}
                <div className="options">{optionElements}</div>
            </div>
        </div>
    );
}
