// sheetFetch.js

import { settingsStore } from "./settingsStore";

export let puppetMasterCache = null; // Cache for puppet-master mappings
export let masterToPuppetsCache = null; // Reverse cache for master-to-puppet mappings
export let s4Cache = null; // Cache for S4 data mappings
export let currentNationsCache = null; // Cache for current nations list
export let currentNationSet = null; // Set for fast current nation lookups

const puppetDataUrl = "./static/puppetData.tsv"; // URL to your preprocessed Puppet TSV file
const s4DataUrl = "./static/s4.tsv"; // URL to your preprocessed S4 TSV file
const currentNationsUrl = "./static/currentNations.txt"; // URL to your current nations file

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
    // Fetch and parse the Puppet Data TSV
    const puppetResponse = await fetch(puppetDataUrl);
    if (!puppetResponse.ok) {
      throw new Error(`Failed to fetch puppet data: ${puppetResponse.statusText}`);
    }

    const puppetData = await puppetResponse.text();
    const puppetLines = puppetData.split("\n").slice(1); // Skip header row
    puppetLines.forEach((line) => {
      const [puppet, master, sheet] = line.split("\t").map((col) =>
        col.trim().toLowerCase().replace(/\s+/g, "_")
      );

      if (puppet && master) {
        // Store puppet-to-master mapping
        puppetMasterCache[puppet] = { master, sheet };

        // Ignore self-mapping (master === puppet)
        if (puppet !== master) {
          if (!masterToPuppetsCache[master]) {
            masterToPuppetsCache[master] = [];
          }
          masterToPuppetsCache[master].push(puppet);
        }
      }
    });

    console.log(`Loaded ${Object.keys(puppetMasterCache).length} puppets.`);
    console.log(`Loaded ${Object.keys(masterToPuppetsCache).length} masters with puppets.`);
    
    // Fetch and parse the S4 Data TSV
    const s4Response = await fetch(s4DataUrl);
    if (!s4Response.ok) {
      throw new Error(`Failed to fetch S4 data: ${s4Response.statusText}`);
    }

    const s4Data = await s4Response.text();
    const s4Lines = s4Data.split("\n").slice(1); // Skip header row
    s4Lines.forEach((line) => {
      const [cardId, cardName] = line.split("\t").map((col) =>
        col.trim().toLowerCase().replace(/\s+/g, "_")
      );
      if (cardId && cardName) {
        s4Cache[cardId] = cardName; // Store card ID-to-name mappings
      }
    });

    // Fetch and parse the Current Nations file
    const currentNationsResponse = await fetch(currentNationsUrl);
    if (!currentNationsResponse.ok) {
      throw new Error(`Failed to fetch current nations data: ${currentNationsResponse.statusText}`);
    }

    const currentNationsData = await currentNationsResponse.text();
    currentNationsCache = currentNationsData
      .split("\n")
      .map((nation) => nation.trim().toLowerCase().replace(/\s+/g, "_")); // Normalize nation names

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