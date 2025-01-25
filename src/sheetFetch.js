//sheetFetch.js

import { settingsStore } from "./settingsStore";

export let puppetMasterCache = null; // Cache for puppet-master mappings
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

  console.log("Preprocessing current nations cache into a Set...");
  currentNationSet = new Set(currentNationsCache); // Convert to Set
  console.log("Current nation Set created.");
}

/**
 * Fetches and caches puppet data, S4 data, and current nations from their respective files.
 */
export async function fetchSheets() {
  console.log("Fetching puppet data, S4 data, and current nations...");

  // Reset all caches
  puppetMasterCache = {};
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
        puppetMasterCache[puppet] = { master, sheet }; // Store puppet-master mappings
      }
    });
    console.log("Puppet data loaded and cached.");

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
    console.log("S4 data loaded and cached.");

    // Fetch and parse the Current Nations file
    const currentNationsResponse = await fetch(currentNationsUrl);
    if (!currentNationsResponse.ok) {
      throw new Error(`Failed to fetch current nations data: ${currentNationsResponse.statusText}`);
    }

    const currentNationsData = await currentNationsResponse.text();
    currentNationsCache = currentNationsData
      .split("\n")
      .map((nation) => nation.trim().toLowerCase().replace(/\s+/g, "_")); // Normalize nation names
    console.log("Current nations data loaded and cached.");

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

  console.log("All sheet data fetched and processed.");
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
 * Query the S4 cache for a given key.
 * @param {string} key - The key to look up in the S4 cache.
 * @returns {string|null} - The corresponding value from the S4 cache, or null if not found.
 */
export function queryS4(key) {
  if (!s4Cache) {
    console.warn("S4 cache is not initialized.");
    return null;
  }

  const value = s4Cache[key];
  if (value) {
    return value;
  }

  return null; // Default to null if not found
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