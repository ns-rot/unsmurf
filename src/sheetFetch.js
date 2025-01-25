import { settingsStore } from "./settingsStore";

export let puppetMasterCache = null; // Cache for puppet-master mappings
export let s4Cache = null; // Cache for S4 data mappings
const tsvFileUrl = "./static/puppetData.tsv"; // URL to your preprocessed TSV file
const s4SheetUrl = "./static/s4.tsv"; // URL to your preprocessed S4 TSV file

/**
 * Load puppet data and S4 data from their respective TSV files via HTTP.
 */
export async function fetchSheets() {
  console.log("Loading puppet and S4 data from TSV files via HTTP...");
  puppetMasterCache = {}; // Reset the puppet cache
  s4Cache = {}; // Reset the S4 cache

  try {
    // Fetch the puppet data TSV
    const puppetResponse = await fetch(tsvFileUrl);
    if (!puppetResponse.ok) {
      throw new Error(`Failed to fetch puppet TSV file: ${puppetResponse.statusText}`);
    }

    const puppetData = await puppetResponse.text();
    const puppetLines = puppetData.split("\n").slice(1); // Skip the header row
    puppetLines.forEach((line) => {
      const [puppet, master, sheet] = line.split("\t").map((col) =>
        col.trim().toLowerCase().replace(/\s+/g, "_")
      );

      if (puppet && master) {
        puppetMasterCache[puppet] = { master, sheet };
      }
    });

    console.log("Puppet data loaded and cached.");

    // Fetch the S4 data TSV
    const s4Response = await fetch(s4SheetUrl);
    if (!s4Response.ok) {
      throw new Error(`Failed to fetch S4 TSV file: ${s4Response.statusText}`);
    }

    const s4Data = await s4Response.text();
    const s4Lines = s4Data.split("\n").slice(1); // Skip the header row
    s4Lines.forEach((line) => {
      const [key, value] = line.split("\t").map((col) =>
        col.trim().toLowerCase().replace(/\s+/g, "_")
      );

      if (key && value) {
        s4Cache[key] = value; // Populate the S4 cache
      }
    });

    console.log("S4 data loaded and cached.");
  } catch (error) {
    console.error("Failed to load TSV data:", error);
  }

  // Update the settings store to indicate that data has been fetched
  settingsStore.update((s) => ({
    ...s,
    dataFetched: true, // Flag to indicate data has been fetched (optional)
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
