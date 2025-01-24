import { settingsStore, useSettings } from "./settingsStore";

export let puppetMasterCache = null; // Cache for puppet-master mappings
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const tsvFileUrl = "/static/puppetData.tsv"; // URL to your preprocessed TSV file

/**
 * Load puppet data from the TSV file via HTTP.
 */
export async function fetchPuppets() {
  const now = Date.now();
  const settings = useSettings();
  const lastFetchTime = settings.lastFetchTime || 0;

  if (puppetMasterCache && now - lastFetchTime < CACHE_DURATION) {
    console.log("Puppet cache is still valid. Skipping fetch.");
    return;
  }

  console.log("Loading puppet data from TSV via HTTP...");
  puppetMasterCache = {}; // Reset the cache

  try {
    // Fetch the TSV file from the server
    const response = await fetch(tsvFileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch TSV file: ${response.statusText}`);
    }

    const tsvData = await response.text(); // Read the response as text
    const lines = tsvData.split("\n").slice(1); // Skip the header row

    lines.forEach((line) => {
      const [puppet, master, sheet] = line.split("\t").map((col) =>
        col.trim().toLowerCase().replace(/\s+/g, "_")
      );

      if (puppet && master) {
        puppetMasterCache[puppet] = { master, sheet };
      }
    });

    console.log("Puppet data loaded and cached.");
  } catch (error) {
    console.error("Failed to load puppet data from TSV:", error);
  }

  // Update the last fetch timestamp in the settings store
  settingsStore.update((s) => ({
    ...s,
    lastFetchTime: now,
  }));

  return now; // Optional, if you want the caller to know the updated timestamp
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
