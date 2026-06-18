import react from "@vitejs/plugin-react";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const CACHES_ROOT = resolve(process.cwd(), "caches");

const MIME_TYPES: Record<string, string> = {
    ".dat": "application/octet-stream",
    ".dat2": "application/octet-stream",
    ".json": "application/json",
    ".png": "image/png",
    ".wasm": "application/wasm",
    ".zip": "application/zip",
};

function mimeFor(filePath: string): string {
    const dot = filePath.lastIndexOf(".");
    if (dot === -1) {
        return "application/octet-stream";
    }
    return MIME_TYPES[filePath.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

// Replicates ts-shader-loader: resolves `#include "./path";` directives in
// .glsl files and returns the resulting source as a string module.
function glslIncludesPlugin(): Plugin {
    const includeRegex = /^[ \t]*#include\s+"([^"]+)"\s*;?[ \t]*$/gm;

    return {
        name: "glsl-includes",
        enforce: "pre",
        load(id) {
            if (!/\.glsl($|\?)/.test(id)) {
                return null;
            }
            const filePath = id.replace(/\?.*$/, "");

            const resolveIncludes = (file: string, source: string): string =>
                source.replace(includeRegex, (_match, relPath: string) => {
                    const incPath = resolve(dirname(file), relPath);
                    this.addWatchFile(incPath);
                    return resolveIncludes(incPath, readFileSync(incPath, "utf8"));
                });

            const resolved = resolveIncludes(filePath, readFileSync(filePath, "utf8"));
            return `export default ${JSON.stringify(resolved)};`;
        },
    };
}

// Serves the gitignored `caches/` directory at `/caches` during dev,
// matching the previous craco devServer express.static middleware.
function serveCachesPlugin(): Plugin {
    return {
        name: "serve-caches",
        configureServer(server) {
            server.middlewares.use("/caches", (req, res, next) => {
                const reqUrl = decodeURIComponent((req.url ?? "").replace(/^\//, ""));
                const filePath = normalize(join(CACHES_ROOT, reqUrl));
                const rel = relative(CACHES_ROOT, filePath);
                if (rel.startsWith("..") || rel.includes(`..${sep}`)) {
                    res.statusCode = 403;
                    res.end();
                    return;
                }
                const notFound = () => {
                    res.statusCode = 404;
                    res.end();
                };
                try {
                    const stat = statSync(filePath);
                    if (stat.isDirectory()) {
                        notFound();
                        return;
                    }
                    res.setHeader("Content-Type", mimeFor(filePath));
                    res.setHeader("Cache-Control", "no-cache");
                    createReadStream(filePath).on("error", notFound).pipe(res);
                } catch {
                    notFound();
                }
            });
        },
    };
}

// Routes bare `.wasm` imports (e.g. the Emscripten `require("./module.wasm")`
// hack inside @foxglove/wasm-bz2) through Vite's `?url` asset handling so they
// resolve to an asset URL string, matching webpack's behaviour. Imports that
// already carry a query (e.g. `*.wasm?url`) are left untouched.
function wasmAssetUrlPlugin(): Plugin {
    return {
        name: "wasm-asset-url",
        enforce: "pre",
        async resolveId(source, importer, options) {
            if (!source.endsWith(".wasm") || source.includes("?")) {
                return null;
            }
            const resolution = await this.resolve(source, importer, {
                ...options,
                skipSelf: true,
            });
            if (!resolution) {
                return null;
            }
            return { ...resolution, id: `${resolution.id}?url` };
        },
    };
}

export default defineConfig({
    plugins: [react(), glslIncludesPlugin(), serveCachesPlugin(), wasmAssetUrlPlugin()],
    resolve: {
        // ".web.*" takes precedence so browser-specific variants (e.g. Gzip.web.ts)
        // resolve the same way they did under CRA's webpack config.
        extensions: [
            ".web.ts",
            ".web.tsx",
            ".web.js",
            ".mjs",
            ".js",
            ".ts",
            ".jsx",
            ".tsx",
            ".json",
        ],
    },
    server: {
        // Required for SharedArrayBuffer / multi-threaded workers.
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
    worker: {
        // User plugins are not applied to worker bundles by default; the wasm
        // URL handling is needed there too (the worker imports @foxglove/wasm-bz2).
        plugins: () => [wasmAssetUrlPlugin()],
    },
    build: {
        target: "es2020",
        sourcemap: true,
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["src/setupTests.ts"],
        passWithNoTests: true,
    },
});
