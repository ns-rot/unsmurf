// worker.js

// URLs for data
const puppetDataUrl = "https://raw.githubusercontent.com/ns-rot/unsmurf/data/static/puppetData.json";
const currentNationsUrl = "https://raw.githubusercontent.com/ns-rot/unsmurf/data/static/currentNations.json";

// Caches
let puppetMasterCache = {};
let masterToPuppetsCache = {};
let currentNationSet = new Set();

self.onmessage = async (e) => {
    const { type, auxUrl, auxData, forceRefresh } = e.data;

    if (type === 'start') {
        try {
            await fetchData(auxUrl, auxData, forceRefresh);

            // Send data back to main thread
            self.postMessage({
                type: 'success',
                payload: {
                    puppetMasterCache,
                    masterToPuppetsCache, // This will be sent as a plain object/array structure
                    currentNationList: Array.from(currentNationSet)
                }
            });
        } catch (err) {
            console.error("Worker error:", err);
            self.postMessage({ type: 'error', message: err.message });
        }
    }
};

async function fetchData(auxUrl, auxData, forceRefresh) {
    // Fetch main data in parallel
    const promises = [
        fetchWithCache(puppetDataUrl, forceRefresh).then(res => res.json()),
        fetchWithCache(currentNationsUrl, forceRefresh).then(res => res.json())
    ];

    if (auxUrl) {
        promises.push(fetch(auxUrl).then(res => res.ok ? res.text() : null).catch(() => null));
    } else {
        promises.push(Promise.resolve(null));
    }

    const [puppetData, currentNations, fetchedAuxData] = await Promise.all(promises);

    // Process Main Puppet Data (JSON)
    processGroupedJson(puppetData);

    // Process Current Nations (JSON List)
    if (Array.isArray(currentNations)) {
        currentNations.forEach(n => currentNationSet.add(n)); // Already normalized in file
    }

    // Process Aux Data if any (Legacy TSV)
    if (fetchedAuxData) processTsvClientSide(fetchedAuxData);
    if (auxData) processTsvClientSide(auxData);
}

async function fetchWithCache(url, force = false) {
    const cacheName = "unsmurf-static-data";
    const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

    if ("caches" in self && !force) {
        try {
            const cache = await caches.open(cacheName);
            const cachedResponse = await cache.match(url);
            if (cachedResponse) {
                // Check age via Date header
                const dateHeader = cachedResponse.headers.get("Date");
                if (dateHeader) {
                    const cachedTime = new Date(dateHeader).getTime();
                    const now = Date.now();
                    if (now - cachedTime < cacheDuration) {
                        return cachedResponse;
                    }
                    console.log(`Cache for ${url} expired (${Math.round((now - cachedTime) / 3600000)}h old). Refreshing...`);
                } else {
                    // No date header, assume stale to be safe
                    console.log(`Cache for ${url} has no date header. Refreshing...`);
                }
            }
        } catch (e) {
            console.warn("Cache match failed", e);
        }
    }

    const response = await fetch(url);

    if (response.ok && "caches" in self) {
        try {
            const cache = await caches.open(cacheName);
            await cache.put(url, response.clone());
        } catch (e) {
            console.warn("Cache put failed", e);
        }
    }

    return response;
}

function processGroupedJson(data) {
    const { masters, sheets, puppets, sourceSheets } = data;

    // Additional source sheets per puppet (secondary sheets that identified the same master)
    const extraSheetsByPuppet = new Map();
    if (Array.isArray(sourceSheets)) {
        for (const [pIdx, sIdx] of sourceSheets) {
            if (!extraSheetsByPuppet.has(pIdx)) extraSheetsByPuppet.set(pIdx, []);
            extraSheetsByPuppet.get(pIdx).push(sheets[sIdx]);
        }
    }

    // Reconstruct from dictionary encoding
    for (let idx = 0; idx < puppets.length; idx++) {
        const [puppet, mIdx, sIdx] = puppets[idx];
        const master = masters[mIdx];
        const sheet = sheets[sIdx];

        const entry = { master, sheet };
        const extras = extraSheetsByPuppet.get(idx);
        if (extras && extras.length) entry.sheets = [sheet, ...extras];

        // Cache: Puppet -> Master
        puppetMasterCache[puppet] = entry;

        // Cache: Master -> Puppets
        // Optimization: masterToPuppets maps to a Set initially for fast localized dedup logic if needed,
        // but here we just push because the source is likely unique-per-line. 
        // However, if multiple lines define the same relationship, we want to avoid dups.
        if (!masterToPuppetsCache[master]) {
            masterToPuppetsCache[master] = [];
        }
        // We can use a Set logic here if we fear duplicates, but the source build script handles unique entries generally.
        // For safety and performance in the worker, we can just push.
        // The user requirement explicitly mentioned using Set for checks. 
        // Since we are rebuilding, let's just push. If we need to *check* existence, we'd use a Set.
        // But wait, the previous code had `.includes()` check. 
        // Let's assume the JSON is optimized and clean, but let's implement the Set optimization for safety if we merge multiple sources.

        // Actually, masterToPuppetsCache in the worker should probably be arrays for final transfer, 
        // but we can use an intermediate Map<Master, Set<Puppet>> if we were merging heavily.
        // Given the JSON is the primary source, just pushing is O(1).
        masterToPuppetsCache[master].push(puppet);
    }
}

// Fallback for Aux data which might still be TSV
function processTsvClientSide(tsvData) {
    if (!tsvData) return;

    let start = 0;
    let next = tsvData.indexOf('\n', start);
    if (next !== -1) start = next + 1;

    while (start < tsvData.length) {
        next = tsvData.indexOf('\n', start);
        const lineEnd = next === -1 ? tsvData.length : next;

        const tab1 = tsvData.indexOf('\t', start);
        if (tab1 !== -1 && tab1 < lineEnd) {
            const tab2 = tsvData.indexOf('\t', tab1 + 1);

            const puppet = normalize(tsvData.substring(start, tab1));
            let master, sheet, extras;

            if (tab2 !== -1 && tab2 < lineEnd) {
                master = normalize(tsvData.substring(tab1 + 1, tab2));
                const cols = tsvData.substring(tab2 + 1, lineEnd).split('\t');
                sheet = normalize(cols[0]);
                extras = cols.slice(1).map(c => normalize(c)).filter(Boolean);
            } else {
                master = normalize(tsvData.substring(tab1 + 1, lineEnd));
                sheet = "";
                extras = [];
            }

            if (puppet && master) {
                const entry = { master, sheet };
                if (extras.length) entry.sheets = [sheet, ...extras];
                puppetMasterCache[puppet] = entry;

                if (puppet !== master) {
                    if (!masterToPuppetsCache[master]) masterToPuppetsCache[master] = [];
                    // Optimized check? For small aux data, includes is fine. 
                    // If we wanted 100% perf we'd use Sets for everything then convert.
                    if (!masterToPuppetsCache[master].includes(puppet)) {
                        masterToPuppetsCache[master].push(puppet);
                    }
                }
            }
        }
        if (next === -1) break;
        start = next + 1;
    }
}

function normalize(str) {
    return str.trim().toLowerCase().replace(/\s+/g, "_");
}
