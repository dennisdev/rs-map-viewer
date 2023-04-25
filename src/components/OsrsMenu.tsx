import { useLayoutEffect, useRef, useState } from 'react';
import './OsrsMenu.css';

export type MenuOption = {
    name: string,
    npcName?: string,
    level?: number,
    onClick?: () => void
};

export interface OsrsMenuProps {
    x: number,
    y: number,
    options: MenuOption[];
}

export function OsrsMenu({ x, y, options }: OsrsMenuProps): JSX.Element {
    const [realX, setX] = useState(x);
    const [realY, setY] = useState(y);

    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (ref.current) {
            const { width } = ref.current.getBoundingClientRect();
            setX(x - width / 2);
            setY(y);
        }
    }, [x, y, options]);

    return (
        <div className="context-menu-container" ref={ref} style={{ left: realX, top: realY }} onContextMenu={(e) => { e.preventDefault(); }} >
            <div className="context-menu">
                <div className="title">
                    Choose Option
                </div>
                <div className="line"></div>
                <div className="options">
                    {options.map(option => {
                        return (
                            <div className="option" key={option.name} onClick={option.onClick}>
                                <span className="option-name">{option.name}</span> {option.npcName
                                    && (<span className="npc-name">{option.npcName}</span>)} {option.level !== undefined && option.level > 0
                                    && (<span className="npc-level">{' (Level-'}{option.level}{')'}</span>)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
