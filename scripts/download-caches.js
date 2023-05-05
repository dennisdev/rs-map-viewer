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
    const sizes = [
        "Bytes",
        "KiB",
        "MiB",
        "GiB",
        "TiB",
        "PiB",
        "EiB",
        "ZiB",
        "YiB",
    ];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function askQuestion(query) {
    return new Promise((resolve) =>
        rl.question(query, (ans) => {
            resolve(ans);
        })
    );
}

async function downloadCaches(count) {
    const resp = await fetch("https://archive.openrs2.org/caches.json");
    const json = await resp.json();

    const caches = json.filter(
        (cache) =>
            cache.scope === "runescape" &&
            cache.game === "oldschool" &&
            cache.environment === "live" &&
            cache.builds.length > 0 &&
            cache.timestamp
    );

    // sort new to old
    caches.sort((a, b) => {
        const buildA = a.builds[0].major;
        const buildB = b.builds[0].major;
        const dateA = Date.parse(a.timestamp);
        const dateB = Date.parse(b.timestamp);
        return buildB - buildA || dateB - dateA;
    });

    const cachesToDownload = [];
    let totalBytes = 0;

    for (let i = 0; i < count && i < caches.length; i++) {
        const cache = caches[i];
        const cacheDir = getCacheDir(cache);
        if (!fs.existsSync(cacheDir + "info.json")) {
            cachesToDownload.push(cache);
            totalBytes += cache.blocks * 520;
        }
    }

    if (totalBytes > 0) {
        await askQuestion(
            "Downloading ~" +
                formatBytes(totalBytes) +
                ". Press enter to continue."
        );
    }

    for (const cache of cachesToDownload) {
        const cacheDir = getCacheDir(cache);
        await downloadCache(cache, cacheDir);
    }

    console.log("Finished downloading caches");

    createCacheList();
}

function getCacheDir(cache) {
    const build = cache.builds[0].major;
    const date = cache.timestamp.split("T")[0];
    return `caches/cache-${build}_${date}/`;
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
        `https://archive.openrs2.org/caches/${cache.scope}/${cache.id}/disk.zip`
    );
    return resp.arrayBuffer();
}

async function fetchXteas(cache) {
    const resp = await fetch(
        `https://archive.openrs2.org/caches/${cache.scope}/${cache.id}/keys.json`
    );
    const keys = await resp.json();

    const xteas = {};
    for (const entry of keys) {
        xteas[entry.group.toString()] = entry.key;
    }

    return xteas;
}

function createCacheList() {
    const cachesPath = "caches/";

    const caches = [];

    const fileNames = fs.readdirSync(cachesPath);
    for (const name of fileNames) {
        const isDir = fs.lstatSync(cachesPath + name).isDirectory();
        if (!isDir || !fs.existsSync(cachesPath + name + "/info.json")) {
            continue;
        }
        const cacheInfoJson = fs.readFileSync(cachesPath + name + "/info.json");
        const cacheInfo = JSON.parse(cacheInfoJson);

        const revision = cacheInfo.builds[0].major;

        const cache = {
            name,
            revision,
            timestamp: cacheInfo.timestamp,
            size: cacheInfo.size,
        };

        caches.push(cache);
    }

    fs.writeFileSync(
        cachesPath + "caches.json",
        JSON.stringify(caches),
        "utf8"
    );

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

downloadCaches(downloadCount).then(() => rl.close());
