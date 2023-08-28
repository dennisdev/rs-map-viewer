const fs = require("fs");
const AdmZip = require("adm-zip");

const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) {
        return "0 Bytes";
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function askQuestion(query) {
    return new Promise((resolve) =>
        rl.question(query, (ans) => {
            resolve(ans);
        }),
    );
}

async function downloadCaches(count) {
    // renameCacheDirs();
    if (!fs.existsSync("caches/")) {
        fs.mkdirSync("caches/", { recursive: true });
    }

    const resp = await fetch("https://archive.openrs2.org/caches.json");
    const json = await resp.json();

    const caches = json.filter(
        (cache) =>
            cache.scope === "runescape" &&
            cache.game === "oldschool" &&
            cache.environment === "live" &&
            cache.language === "en" &&
            cache.builds.length > 0 &&
            cache.timestamp,
    );

    caches.push(
        ...json.filter(
            (cache) =>
                cache.scope === "runescape" &&
                cache.game === "runescape" &&
                cache.environment === "live" &&
                cache.language === "en" &&
                cache.builds.length > 0 &&
                cache.builds[0].major >= 254 &&
                cache.builds[0].major <= 640 &&
                cache.timestamp,
        ),
    );

    // sort new to old
    caches.sort((a, b) => {
        const isOsrsA = a.game === "oldschool";
        const isOsrsB = b.game === "oldschool";
        const buildA = a.builds[0].major;
        const buildB = b.builds[0].major;
        const dateA = Date.parse(a.timestamp);
        const dateB = Date.parse(b.timestamp);
        return (isOsrsB ? 1 : 0) - (isOsrsA ? 1 : 0) || buildB - buildA || dateB - dateA;
    });

    const cachesToDownload = [];
    let totalBytes = 0;

    for (let i = 0; i < count && i < caches.length; i++) {
        const cache = caches[i];
        const cacheDir = getCacheDir(cache);
        if (fs.existsSync(cacheDir + "info.json")) {
            const oldCache = JSON.parse(fs.readFileSync(cacheDir + "info.json"));
            if (
                oldCache.valid_indexes === undefined ||
                oldCache.valid_groups === undefined ||
                oldCache.valid_keys === undefined ||
                cache.valid_indexes > oldCache.valid_indexes ||
                cache.valid_groups > oldCache.valid_groups ||
                cache.valid_keys > oldCache.valid_keys
            ) {
                cachesToDownload.push(cache);
                totalBytes += cache.size;
            }
        } else if (isValid(cache)) {
            cachesToDownload.push(cache);
            totalBytes += cache.size;
        }
    }

    if (totalBytes > 0) {
        await askQuestion("Downloading ~" + formatBytes(totalBytes) + ". Press enter to continue.");
    }

    for (const cache of cachesToDownload) {
        const cacheDir = getCacheDir(cache);
        await downloadCache(cache, cacheDir);
    }

    console.log("Finished downloading caches");

    deleteDuplicateCaches();
    createCacheList();
}

function getCacheDir(cache) {
    const build = cache.builds[0].major;
    const date = cache.timestamp.split("T")[0];
    if (cache.game === "oldschool") {
        return `caches/osrs-${build}_${date}/`;
    }
    return `caches/rs2-${build}_${date}/`;
}

async function downloadCache(cache, cacheDir) {
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir);
    }

    console.log("Downloading cache to:", cacheDir);

    const cacheZipBuffer = Buffer.from(await fetchCacheFiles(cache));
    const cacheZip = new AdmZip(cacheZipBuffer, { readEntries: true });
    cacheZip.extractEntryTo("cache/", cacheDir, false, true);

    const xteas = await fetchXteas(cache);

    fs.writeFileSync(cacheDir + "keys.json", JSON.stringify(xteas), "utf8");
    fs.writeFileSync(cacheDir + "info.json", JSON.stringify(cache), "utf8");
}

async function fetchCacheFiles(cache) {
    const resp = await fetch(
        `https://archive.openrs2.org/caches/${cache.scope}/${cache.id}/disk.zip`,
    );
    return resp.arrayBuffer();
}

async function fetchXteas(cache) {
    const resp = await fetch(
        `https://archive.openrs2.org/caches/${cache.scope}/${cache.id}/keys.json`,
    );
    const keys = await resp.json();

    const xteas = {};
    for (const entry of keys) {
        xteas[entry.group.toString()] = entry.key;
    }

    return xteas;
}

function renameCacheDirs() {
    const cachesPath = "caches/";

    const fileNames = fs.readdirSync(cachesPath);
    for (const name of fileNames) {
        const isDir = fs.lstatSync(cachesPath + name).isDirectory();
        if (!isDir || !fs.existsSync(cachesPath + name + "/info.json")) {
            continue;
        }
        if (name.startsWith("cache-")) {
            console.log("Renaming cache dir:", name);
            fs.renameSync(cachesPath + name, cachesPath + name.replace("cache-", "osrs-"));
        }
        // break;
    }
}

function isValid(info) {
    if (info.valid_indexes !== info.indexes) {
        return false;
    }
    const validGroupPercentage = info.valid_groups / info.groups;
    return validGroupPercentage >= 0.9;
}

function deleteDuplicateCaches() {
    const cachesPath = "caches/";

    const cacheIdDirsMap = new Map();

    const fileNames = fs.readdirSync(cachesPath);
    for (const name of fileNames) {
        const dir = cachesPath + name;
        const isDir = fs.lstatSync(dir).isDirectory();
        if (!isDir || !fs.existsSync(dir + "/info.json")) {
            continue;
        }
        const cacheInfoJson = fs.readFileSync(dir + "/info.json");
        const cacheInfo = JSON.parse(cacheInfoJson);

        const dirs = cacheIdDirsMap.get(cacheInfo.id);
        if (dirs) {
            dirs.push(dir);
        } else {
            cacheIdDirsMap.set(cacheInfo.id, [dir]);
        }
    }

    for (const dirs of cacheIdDirsMap.values()) {
        if (dirs.length <= 1) {
            continue;
        }

        dirs.sort((a, b) => {
            const aStat = fs.statSync(a + "/info.json");
            const bStat = fs.statSync(b + "/info.json");
            return bStat.mtimeMs - aStat.mtimeMs;
        });

        for (let i = 1; i < dirs.length; i++) {
            const dir = dirs[i];
            console.log("Deleting duplicate cache:", dir);
            fs.rmdirSync(dir, { recursive: true });
        }
    }
}

function createCacheList() {
    const cachesPath = "caches/";

    const caches = [];

    const fileNames = fs.readdirSync(cachesPath);
    for (const name of fileNames) {
        const dir = cachesPath + name;
        const isDir = fs.lstatSync(dir).isDirectory();
        if (!isDir || !fs.existsSync(dir + "/info.json")) {
            continue;
        }
        const cacheInfoJson = fs.readFileSync(dir + "/info.json");
        const cacheInfo = JSON.parse(cacheInfoJson);

        const revision = cacheInfo.builds[0].major;

        // Skip 311 for now, missing configs, no nice way to check atm
        if (
            !isValid(cacheInfo) ||
            (cacheInfo.game === "runescape" && (revision < 234 || revision > 640)) ||
            revision === 311
        ) {
            continue;
        }

        const cache = {
            name,
            game: cacheInfo.game,
            revision,
            timestamp: cacheInfo.timestamp,
            size: cacheInfo.size,
        };

        caches.push(cache);
    }

    fs.writeFileSync(cachesPath + "caches.json", JSON.stringify(caches), "utf8");

    console.log("Created a list of " + caches.length + " cache(s)");
}

let downloadCount = 1;
if (process.argv.length > 2) {
    const countArg = process.argv[2];
    if (countArg === "all") {
        downloadCount = Number.MAX_SAFE_INTEGER;
    } else {
        downloadCount = parseInt(countArg);
    }
}

downloadCaches(downloadCount).then(() => {
    process.exit(0);
});
