// sheetFetch.js

import { settingsStore } from "./settingsStore";

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
export async function fetchSheets() {
  // Reset all caches
  puppetMasterCache = {};
  masterToPuppetsCache = {};
  currentNationsCache = [];
  currentNationSet = null;

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const { type, payload, message } = e.data;

      if (type === 'success') {
        puppetMasterCache = payload.puppetMasterCache;
        masterToPuppetsCache = payload.masterToPuppetsCache;
        currentNationsCache = payload.currentNationList;
        currentNationSet = new Set(payload.currentNationList);

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

    // Send start message
    worker.postMessage({
      type: 'start',
      auxUrl: window.UNSMURF_AUX_URL || null,
      auxData: window.UNSMURF_AUX_DATA || null
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
 * Counts the number of active (non-CTE) puppets in a given list.
 * @param {Array<string>} puppetList - List of puppet names.
 * @returns {number} - The count of active puppets.
 */
export function countActivePuppets(puppetList) {
  if (!puppetList) return 0;
  return puppetList.reduce((acc, p) => acc + (isNationCurrent(p) ? 1 : 0), 0);
}

/**
 * Check if a given nation is in the current nations cache.
 * @param {string} nation - The nation name to check.
 * @returns {boolean} - True if the nation is found, false otherwise.
 */
export function isNationCurrent(nation) {
  if (!currentNationSet) {
    // console.warn("Current nation Set is not initialized.");
    return false;
  }

  const normalizedNation = nation.trim().toLowerCase().replace(/\s+/g, "_");
  return currentNationSet.has(normalizedNation);
}