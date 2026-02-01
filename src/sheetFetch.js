// sheetFetch.js

import { settingsStore } from "./settingsStore";

export let puppetMasterCache = null; // Cache for puppet-master mappings
export let masterToPuppetsCache = null; // Reverse cache for master-to-puppet mappings
export let s4Cache = null; // Cache for S4 data mappings
export let currentNationsCache = null; // Cache for current nations list
export let currentNationSet = null; // Set for fast current nation lookups

const puppetDataUrl = "https://raw.githubusercontent.com/ns-rot/unsmurf/data/static/puppetData.tsv"; // URL to your preprocessed Puppet TSV file
const s4DataUrl = "./static/s4.tsv"; // URL to your preprocessed S4 TSV file
const currentNationsUrl = "https://raw.githubusercontent.com/ns-rot/unsmurf/data/static/currentNations.txt"; // URL to your current nations file

async function fetchWithCache(url) {
  const cacheName = "unsmurf-static-data";
  const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
  const cacheKey = `unsmurf_cache_time_${url}`;

  const now = Date.now();
  let lastCached = null;
  try {
    lastCached = localStorage.getItem(cacheKey);
  } catch (e) {
    console.warn("LocalStorage access failed", e);
  }

  const isValid = lastCached && now - parseInt(lastCached) < cacheDuration;

  if (isValid && "caches" in window) {
    try {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        return cachedResponse;
      }
    } catch (e) {
      console.warn("Cache match failed", e);
    }
  }

  const response = await fetch(url);

  if (response.ok && "caches" in window) {
    try {
      const cache = await caches.open(cacheName);
      await cache.put(url, response.clone());
      try {
        localStorage.setItem(cacheKey, now.toString());
      } catch (e) {
        console.warn("LocalStorage write failed", e);
      }
    } catch (e) {
      console.warn("Cache put failed", e);
    }
  }

  return response;
}

/**
 * Preprocesses the current nations cache into a Set for fast lookups.
 */
function preprocessCurrentNationSet() {
  if (!currentNationsCache) {
    console.warn("Current nations cache is not initialized.");
    return;
  }

  currentNationSet = new Set(currentNationsCache); // Convert to Set
}

/**
 * Fetches and caches puppet data, S4 data, and current nations from their respective files.
 */
export async function fetchSheets() {
  // Reset all caches
  puppetMasterCache = {};
  masterToPuppetsCache = {}; // Initialize reverse lookup map
  s4Cache = {};
  currentNationsCache = [];
  currentNationSet = null;

  try {
    // Fetch all data in parallel
    const promises = [
      fetchWithCache(puppetDataUrl),
      fetchWithCache(s4DataUrl),
      fetchWithCache(currentNationsUrl),
    ];

    let auxDataPromise = null;
    if (window.UNSMURF_AUX_URL) {
      auxDataPromise = fetch(window.UNSMURF_AUX_URL).then(res => {
        if (!res.ok) return null;
        return res.text();
      }).catch(err => {
        return null;
      });
    }

    const [puppetResponse, s4Response, currentNationsResponse] = await Promise.all(promises);

    if (!puppetResponse.ok) throw new Error(`Failed to fetch puppet data: ${puppetResponse.statusText}`);
    if (!s4Response.ok) throw new Error(`Failed to fetch S4 data: ${s4Response.statusText}`);
    if (!currentNationsResponse.ok) throw new Error(`Failed to fetch current nations data: ${currentNationsResponse.statusText}`);

    const [puppetData, s4Data, currentNationsData, auxData] = await Promise.all([
      puppetResponse.text(),
      s4Response.text(),
      currentNationsResponse.text(),
      auxDataPromise
    ]);

    processPuppetData(puppetData);

    let auxLoaded = false;
    if (auxData) {
      processPuppetData(auxData);
      auxLoaded = true;
    }

    if (window.UNSMURF_AUX_DATA) {
      processPuppetData(window.UNSMURF_AUX_DATA);
      auxLoaded = true;
    }

    if (auxLoaded) {
      console.log("Aux Loaded.");
    }

    console.log(`Loaded ${Object.keys(puppetMasterCache).length} puppets.`);
    console.log(`Loaded ${Object.keys(masterToPuppetsCache).length} masters with puppets.`);

    // Process S4 Data
    start = 0;
    next = s4Data.indexOf('\n', start);
    if (next !== -1) start = next + 1; // Skip header

    while (start < s4Data.length) {
      next = s4Data.indexOf('\n', start);
      const lineEnd = next === -1 ? s4Data.length : next;

      const tab1 = s4Data.indexOf('\t', start);
      if (tab1 !== -1 && tab1 < lineEnd) {
        const cardId = normalize(s4Data.substring(start, tab1));
        const cardName = normalize(s4Data.substring(tab1 + 1, lineEnd));

        if (cardId && cardName) {
          s4Cache[cardId] = cardName;
        }
      }

      if (next === -1) break;
      start = next + 1;
    }

    // Process Current Nations Data
    currentNationsCache = [];
    start = 0;
    while (start < currentNationsData.length) {
      next = currentNationsData.indexOf('\n', start);
      const lineEnd = next === -1 ? currentNationsData.length : next;

      if (lineEnd > start) {
        const nation = normalize(currentNationsData.substring(start, lineEnd));
        if (nation) currentNationsCache.push(nation);
      }

      if (next === -1) break;
      start = next + 1;
    }

    // Preprocess the current nations into a Set for fast lookups
    preprocessCurrentNationSet();
  } catch (error) {
    console.error("Error fetching sheet data:", error);
  }

  // Update the settings store to indicate data has been fetched
  settingsStore.update((s) => ({
    ...s,
    dataFetched: true,
  }));
}

/**
 * Processes raw TSV data and updates the puppet caches.
 * @param {string} tsvData - The raw TSV data string.
 */
function processPuppetData(tsvData) {
  let start = 0;
  let next = tsvData.indexOf('\n', start);
  if (next !== -1) start = next + 1;

  while (start < tsvData.length) {
    next = tsvData.indexOf('\n', start);
    const lineEnd = next === -1 ? tsvData.length : next;

    const tab1 = tsvData.indexOf('\t', start);
    const tab2 = tsvData.indexOf('\t', tab1 + 1);

    if (tab1 !== -1 && tab1 < lineEnd && tab2 !== -1 && tab2 < lineEnd) {
      const puppet = normalize(tsvData.substring(start, tab1));
      const master = normalize(tsvData.substring(tab1 + 1, tab2));
      const sheet = normalize(tsvData.substring(tab2 + 1, lineEnd));

      if (puppet && master) {
        puppetMasterCache[puppet] = { master, sheet };
        if (puppet !== master) {
          if (!masterToPuppetsCache[master]) masterToPuppetsCache[master] = [];
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

// Helper for fast normalization
function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Find the master of a given puppet name.
 * @param {string} name - The puppet's name to look up.
 * @returns {object} - An object with the master name and the source sheet name.
 */
export function findPuppetmaster(name) {
  if (!puppetMasterCache) {
    console.warn("Puppet cache is not initialized. Returning the original name.");
    return { master: name, sheet: null };
  }

  const entry = puppetMasterCache[name.toLowerCase()];
  if (entry) {
    return { master: entry.master, sheet: entry.sheet }; // Return master and sheet name
  }

  return { master: name, sheet: null }; // Default to original name if not found
}

/**
 * Returns a list of puppets belonging to a given master.
 * @param {string} masterName - The master nation's name.
 * @returns {Array<string>} - List of puppet nations under this master.
 */
export function listPuppets(masterName) {
  if (!masterToPuppetsCache) {
    console.warn("Puppet cache is not initialized.");
    return [];
  }

  const normalizedMaster = masterName.trim().toLowerCase().replace(/\s+/g, "_");
  return masterToPuppetsCache[normalizedMaster] || [];
}

/**
 * Returns the number of puppets under a given master.
 * @param {string} masterName - The master nation's name.
 * @returns {number} - The count of puppets under this master.
 */
export function tallyPuppets(masterName) {
  if (!masterToPuppetsCache) {
    console.warn("Puppet cache is not initialized.");
    return 0;
  }

  const normalizedMaster = masterName.trim().toLowerCase().replace(/\s+/g, "_");
  return masterToPuppetsCache[normalizedMaster]?.length || 0;
}

/**
 * Query the S4 cache for a given key.
 * @param {string} key - The key to look up in the S4 cache.
 * @returns {string|null} - The corresponding value from the S4 cache, or null if not found.
 */
export function queryS4(key) {
  if (!s4Cache) {
    console.warn("S4 cache is not initialized.");
    return null;
  }

  return s4Cache[key] || null; // Default to null if not found
}

/**
 * Check if a given nation is in the current nations cache.
 * @param {string} nation - The nation name to check.
 * @returns {boolean} - True if the nation is found, false otherwise.
 */
export function isNationCurrent(nation) {
  if (!currentNationSet) {
    console.warn("Current nation Set is not initialized.");
    return false;
  }

  const normalizedNation = nation.trim().toLowerCase().replace(/\s+/g, "_");
  return currentNationSet.has(normalizedNation);
}