interface MinimapImageProps {
    src: string;

    left: number;
    top: number;
}

export function MinimapImage({ src, left, top }: MinimapImageProps) {
    return (
        <img className="minimap-image" src={src} width={256} height={256} style={{ left, top }} />
    );
}
