import { useLayoutEffect, useRef, useState } from "react";
import "./OsrsMenu.css";

export enum TargetType {
    NPC,
    OBJECT,
}

export type Target = {
    name: string;
    type: TargetType;
};

export type MenuOption = {
    id: number;
    action: string;
    target?: Target;
    level?: number;
    onClick?: () => void;
};

function getTargetClassName(targetType: TargetType) {
    switch (targetType) {
        case TargetType.NPC:
            return "npc-name";
        case TargetType.OBJECT:
            return "object-name";
    }
}

export interface OsrsMenuProps {
    x: number;
    y: number;
    options: MenuOption[];
    tooltip: boolean;
}

export function OsrsMenu({
    x,
    y,
    options,
    tooltip,
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
