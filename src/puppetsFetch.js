// puppetsFetch.js

import { settingsStore, useSettings } from './settingsStore';

export let puppetMasterCache = null; // Cache for puppet-master mappings
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

const sheets = [
  {
    name: "9003",
    url: "https://docs.google.com/spreadsheets/d/1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4/export?format=tsv&id=1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4&gid=733627866",
    puppetColumn: 0,
    mainColumn: 1,
    headerRows: 1,
  },
  {
    name: "XKI",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSem15AVLXgdjxWBZOnWRFnF6NwkY0gVKPYI8aWuHJzlbyILBL3o1F5GK1hSK3iiBlXLIZBI5jdpkVr/pub?gid=916202163&single=true&output=tsv",
    puppetColumn: 0,
    mainColumn: 1,
    headerRows: 0,
  },
  {
    name: "Rot",
    url: "https://docs.google.com/spreadsheets/d/1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4/export?format=tsv&id=1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4",
    puppetColumn: 0,
    mainColumn: 1,
    headerRows: 1,
  },
  {
    name: "Rot Ext",
    url: "https://docs.google.com/spreadsheets/d/1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4/export?format=tsv&id=1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4&gid=708581263",
    puppetColumn: 0,
    mainColumn: 1,
    headerRows: 1,
  },
];

/**
 * Fetch and cache puppet data from external sheets.
 */
export async function fetchPuppets() {
  const now = Date.now();
  const settings = useSettings();
  const lastFetchTime = settings.lastFetchTime || 0;

  if (puppetMasterCache && now - lastFetchTime < CACHE_DURATION) {
    console.log("Puppet cache is still valid. Skipping fetch.");
    return;
  }

  console.log("Fetching puppet data...");
  puppetMasterCache = {}; // Reset the cache

  async function loadSheet(sheet) {
    console.log(`Fetching sheet: ${sheet.name}`);
    const response = await fetch(sheet.url);
    if (!response.ok) {
      console.error(`Failed to fetch sheet: ${sheet.url}`);
      return;
    }

    const data = await response.text();
    const lines = data.split("\n").slice(sheet.headerRows); // Skip header rows
    lines.forEach((line) => {
      const columns = line.split("\t"); // TSV data split
      const puppet = columns[sheet.puppetColumn]?.trim().toLowerCase().replace(/\s+/g, "_"); // Normalize puppet name
      const master = columns[sheet.mainColumn]?.trim().toLowerCase().replace(/\s+/g, "_"); // Normalize master name
      if (puppet && master) {
        puppetMasterCache[puppet] = { master, sheet: sheet.name }; // Store sheet name
      }
    });
  }

  // Fetch all sheets
  for (const sheet of sheets) {
    await loadSheet(sheet);
  }

  // Update the last fetch timestamp in the settings store
  settingsStore.update((s) => ({
    ...s,
    lastFetchTime: now,
  }));

  console.log("Puppet data fetched and cached.");
  return now; // Optional, if you want the caller to know the updated timestamp
}

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