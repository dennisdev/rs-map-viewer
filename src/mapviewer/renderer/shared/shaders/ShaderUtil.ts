export type ProgramSource = [string, string];

export function prependDefines(source: string, defines: string[]): string {
    const header = "#version 300 es";

    const newHeader = defines.reduce((acc, define) => {
        return acc + "#define " + define + " 1\n";
    }, header + "\n");

    return source.replace(header, newHeader);
}
