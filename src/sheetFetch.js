// sheetFetch.js

import { settingsStore } from "./settingsStore";
import { createVersionedStorage } from "./storageUtils";

// Tracks the puppetData.json schema version this deployment understands.
// If a previous session stored an older schema, we bypass the HTTP cache and refetch.
const DATA_SCHEMA_KEY = "unsmurfDataSchema";
const DATA_SCHEMA_VERSION = 2;
const dataSchemaStorage = createVersionedStorage(DATA_SCHEMA_KEY, {
  defaults: { schema: 1 },
  currentVersion: 1,
});

export let puppetMasterCache = null; // Cache for puppet-master mappings
export let masterToPuppetsCache = null; // Reverse cache for master-to-puppet mappings
export let currentNationsCache = null; // Cache for current nations list
export let currentNationSet = null; // Set for fast current nation lookups

const puppetDataUrl = "https://raw.githubusercontent.com/ns-rot/unsmurf/data/static/puppetData.tsv"; // URL to your preprocessed Puppet TSV file
const currentNationsUrl = "https://raw.githubusercontent.com/ns-rot/unsmurf/data/static/currentNations.txt"; // URL to your current nations file


/**
 * Fetches and caches puppet data, S4 data, and current nations from their respective files.
 * Uses a Web Worker to prevent blocking the main thread.
 */
export async function fetchSheets(forceRefresh = false) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const { type, payload, message } = e.data;

      if (type === 'success') {
        puppetMasterCache = payload.puppetMasterCache;
        masterToPuppetsCache = payload.masterToPuppetsCache;
        currentNationsCache = payload.currentNationList;
        currentNationSet = new Set(payload.currentNationList);

        if (typeof payload.puppetDataVersion === 'number') {
          if (payload.puppetDataVersion !== DATA_SCHEMA_VERSION) {
            console.warn(`Server data uses schema v${payload.puppetDataVersion}, this build expects v${DATA_SCHEMA_VERSION}.`);
          }
          dataSchemaStorage.save({ schema: DATA_SCHEMA_VERSION, version: 1 });
        }

        console.log(`Loaded ${Object.keys(puppetMasterCache).length} puppets.`);
        console.log(`Loaded ${Object.keys(masterToPuppetsCache).length} masters with puppets.`);

        // Update the settings store to indicate data has been fetched
        settingsStore.update((s) => ({
          ...s,
          dataFetched: true,
        }));

        worker.terminate();
        resolve();
      } else if (type === 'error') {
        console.error("Worker error:", message);
        worker.terminate();
        reject(new Error(message));
      }
    };

    worker.onerror = (err) => {
      console.error("Worker script error:", err);
      reject(err);
    };

    // Force a refetch if a schema bump is pending from an earlier session
    const storedSchema = dataSchemaStorage.read().schema || 1;
    const force = forceRefresh || storedSchema < DATA_SCHEMA_VERSION;
    if (force && !forceRefresh) {
      console.log(`Data schema bumped (${storedSchema} -> ${DATA_SCHEMA_VERSION}); bypassing cache.`);
    }

    // Send start message
    worker.postMessage({
      type: 'start',
      auxUrl: window.UNSMURF_AUX_URL || null,
      auxData: window.UNSMURF_AUX_DATA || null,
      forceRefresh: force
    });
  });
}

/**
 * Find the master of a given puppet name.
 * @param {string} name - The puppet's name to look up.
 * @returns {object} - An object with the master name and the source sheet name.
 */
export function findPuppetmaster(name) {
  if (!puppetMasterCache) {
    // console.warn("Puppet cache is not initialized. Returning the original name."); 
    // Suppress warning during init
    return { master: name, sheet: null, sheets: [] };
  }

  const entry = puppetMasterCache[name.toLowerCase()];
  if (entry) {
    return { master: entry.master, sheet: entry.sheet, sheets: entry.sheets || [entry.sheet] }; // Return master, sheet, and all source sheets
  }

  return { master: name, sheet: null, sheets: [] }; // Default to original name if not found
}

/**
 * Returns a list of puppets belonging to a given master, excluding the master itself.
 * @param {string} masterName - The master nation's name.
 * @returns {Array<string>} - List of puppet nations under this master.
 */
export function listPuppets(masterName) {
  if (!masterToPuppetsCache) {
    console.warn("Puppet cache is not initialized.");
    return [];
  }

  const normalizedMaster = masterName.trim().toLowerCase().replace(/\s+/g, "_");
  const puppets = masterToPuppetsCache[normalizedMaster] || [];
  return puppets.filter((p) => p !== normalizedMaster);
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
  const puppets = masterToPuppetsCache[normalizedMaster] || [];
  return puppets.filter(p => p !== normalizedMaster).length;
}

/**
 * Counts the number of active (non-CTE) puppets in a given list.
 * @param {Array<string>} puppetList - List of puppet names.
 * @returns {number} - The count of active puppets.
 */
export function countActivePuppets(puppetList) {
  if (!puppetList) return 0;
  return puppetList.reduce((acc, p) => acc + (isNationCurrent(p) ? 1 : 0), 0);
}

/**
 * Returns a list of all masters sorted by active puppet count.
 * @param {number} threshold - Minimum number of total puppets to include.
 * @returns {Array<{name: string, count: number, activeCount: number}>} - Sorted list of masters.
 */
export function getTopMasters(threshold = 0) {
  if (!masterToPuppetsCache) return [];

  return Object.entries(masterToPuppetsCache)
    .map(([name, puppets]) => {
      // Exclude self from puppet list
      const filteredPuppets = puppets.filter(p => p !== name);
      const activeCount = countActivePuppets(filteredPuppets);
      return {
        name,
        count: filteredPuppets.length,
        activeCount,
      };
    })
    .filter((m) => m.count > 0 && m.count >= threshold)
    .sort((a, b) => b.activeCount - a.activeCount || b.count - a.count);
}

/**
 * Search across both active nations and known puppets by prefix.
 * Active nations are prioritized in results.
 * @param {string} query - The search query.
 * @param {number} maxResults - Maximum number of results to return.
 * @returns {Array<string>} - Matching canonicalized names.
 */
export function searchNations(query, maxResults = 10) {
  if (!currentNationsCache || !query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim().replace(/\s+/g, "_");

  const results = [];
  const seen = new Set();

  for (const name of currentNationsCache) {
    if (name.startsWith(q)) {
      seen.add(name);
      results.push(name);
      if (results.length >= maxResults) return results;
    }
  }

  if (masterToPuppetsCache) {
    for (const puppets of Object.values(masterToPuppetsCache)) {
      for (const puppet of puppets) {
        if (!seen.has(puppet) && puppet.startsWith(q)) {
          seen.add(puppet);
          results.push(puppet);
          if (results.length >= maxResults) return results;
        }
      }
    }
  }

  return results;
}

export function isNationCurrent(nation) {
  if (!currentNationSet) {
    // console.warn("Current nation Set is not initialized.");
    return false;
  }

  const normalizedNation = nation.trim().toLowerCase().replace(/\s+/g, "_");
  return currentNationSet.has(normalizedNation);
}