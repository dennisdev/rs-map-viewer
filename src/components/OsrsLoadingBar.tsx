import './OsrsLoadingBar.css';

interface OsrsLoadingBarProps {
    text: string,
    progress: number,
}

export function OsrsLoadingBar({ text, progress }: OsrsLoadingBarProps): JSX.Element {
    return (
        <div className="loading-bar">
            <div className="loading-bar-progress-container">
                <div className="loading-bar-progress" style={{width: progress + '%'}}>
                </div>
            </div>
            <div className="loading-bar-text">
                {text} - {progress}%
            </div>
        </div>
    );
};
