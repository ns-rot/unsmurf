// util.js

import { formatNationName, formatPrice, formatDate, formatLargeNumber, normalizeName } from './settingsUtils';
import { settingsStore, useSettings } from './settingsStore';
import { puppetMasterCache } from './puppetsFetch';

const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

export async function fetchPuppets() {
  const now = Date.now();
  const settings = useSettings(); // Retrieve current settings
  const lastFetchTime = settings.lastFetchTime || 0;

  // Check if cache is still valid
  if (puppetMasterCache && now - lastFetchTime < CACHE_DURATION) {
    console.log("Puppet cache is still valid. Skipping fetch.");
    return;
  }

  console.log("Fetching puppet data...");
  puppetMasterCache = {}; // Reset the cache

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

  // Manually ensure useSettings reflects the updated time
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

export function tallyCounts(trades, roleKey, isTrade) {
  const tally = {};
  const rawToNormalizedMap = {}; // Map to track raw names for each normalized name

  trades
    .filter((t) => (isTrade ? t.price !== 0 : t.price === 0))
    .forEach((t) => {
      const rawName = t[roleKey]; // Raw name from the trade
      if (!rawName) return; // Skip invalid entries

      let tallyName;

      if (useSettings().section === "puppets") {
        tallyName = findPuppetmaster(
          rawName.toLowerCase().replace(/\s+/g, "_")
        ).master; // Normalize and find puppet master
      } else {
        tallyName = normalizeName(rawName); // Normalize the name
      }

      // Track raw names associated with the normalized name
      if (!rawToNormalizedMap[tallyName]) {
        rawToNormalizedMap[tallyName] = new Set();
      }

      rawToNormalizedMap[tallyName].add(rawName); // Add the raw name for reference

      // Tally counts using the normalized name
      tally[tallyName] = (tally[tallyName] || 0) + 1;
    });

  // Convert tally to an array and include debugging info
  return Object.entries(tally)
    .map(([normalizedName, count]) => {
      const rawNames = Array.from(rawToNormalizedMap[normalizedName]).sort(); // Sort raw names alphabetically
      let aggregatedName;

      if (useSettings().section === "puppets") {
        aggregatedName = normalizedName; // Use puppet master name for aggregation
      } else {
        aggregatedName = rawNames[0]; // Use first alphabetical raw name
      }

      // Build the hyperlink for the aggregated name
      let displayName = `<a href="https://www.nationstates.net/nation=${encodeURIComponent(
        aggregatedName
      )}/page=deck/show_trades" target="_blank" rel="noopener noreferrer">${formatNationName(
        aggregatedName
      )}</a>`;

      // Append number of nations if multiple raw names are grouped
      if (rawNames.length > 1) {
        displayName += ` [${rawNames.length}]`;
      }

      // Debugging: Log normalized name, raw names, and aggregated name
      console.debug({
        normalizedName,
        rawNames,
        aggregatedName,
        count,
      });

      return [displayName, count]; // Return the formatted name and count
    })
    .sort((a, b) => b[1] - a[1]); // Sort by count in descending order
}
  
// Utility function to manage URL parameters
export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

export function setQueryParam(name, value) {
  const params = new URLSearchParams(window.location.search);
  if (value) {
    params.set(name, value);
  } else {
    params.delete(name);
  }
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  history.replaceState({}, '', newUrl);
}

// Fetch data from the API
export async function fetchData(role, nationId) {
  const url = `https://maki.kractero.com/api/trades?limit=-1&${role}=${nationId}&category=All&sortval=Timestamp&sortorder=Desc`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${role} data:`, response.status);
      return [];
    }
    const data = await response.json();
    return data.trades || [];
  } catch (err) {
    console.error(`Error fetching ${role} data:`, err);
    return [];
  }
}

// Build columns and rows
export function makeTallyColumns(tally) {
  const totalCount = tally.reduce((sum, [_n, c]) => sum + c, 0);
  return [
    { label: "Nation", alignment: "left" },
    { label: formatLargeNumber(totalCount), alignment: "right" },
  ];
}

export function makeTallyRows(tally) {
  return tally.map(([n, c]) => {

    // Format the count using the formatLargeNumber function
    const formattedCount = formatLargeNumber(c);

    // Return the formatted row
    return [n, formattedCount];
  });
}

export function makeTradeColumns(role) {
  return [
    { label: role === 'buyer' ? "Buyer" : "Seller", alignment: "left", styles: ["min-w-[8ch]", "max-w-[18ch]"] },
    { label: "Card", alignment: "left", styles: ["min-w-[8ch]", "max-w-[18ch]"] },
    { label: "Price", alignment: "center", styles: ["min-w-[3ch]"] },
    { label: "Date", alignment: "center", styles: ["min-w-[7ch]"] },
  ];
}

export function makeGiftColumns(role) {
  return [
    { label: role === 'buyer' ? "Buyer" : "Seller", alignment: "left", styles: ["min-w-[8ch]", "max-w-[18ch]"] },
    { label: "Card", alignment: "left", styles: ["min-w-[8ch]", "max-w-[18ch]"] },
    { label: "Date", alignment: "center", styles: ["min-w-[7ch]"] },
  ];
}


/**
 * Builds data rows for trades or gifts.
 * @param {Array} records - The array of records (trades or gifts).
 * @param {string} role - The role key ('buyer' or 'seller').
 * @param {function} filterCondition - A function to filter records (e.g., price !== 0 for trades, price === 0 for gifts).
 * @param {boolean} includePrice - Whether to include the price column (only applies to trades).
 * @param {boolean} showRelativeDate - Whether to show relative date by default.
 * @returns {Array} - An array of processed rows for the table.
 */
export function makeRows(records, role, filterCondition, includePrice, showRelativeDate) {
  return records
    .filter(filterCondition)
    .map((r) => {
      const nationDisplay = formatNationName(r[role] || "N/A");
      const nationLink = `<a href="https://www.nationstates.net/nation=${encodeURIComponent(r[role] || "N/A")}"
        target="_blank" rel="noopener noreferrer">${nationDisplay}</a>`;
      const cardLink = `<a href="https://www.nationstates.net/page=deck/card=${r.card_id}/season=${r.season}"
        target="_blank" rel="noopener noreferrer">S${r.season} ${formatNationName(r.card_name) || "N/A"}</a>`;
      const settings = useSettings();
      const rarityCategory = r.category || "C";

      // Conditionally cast "E" to "E1" based on the `redEpics` setting
      // Conditionally cast "L" to "L1" based on the `rainbowLegs` setting
      const normalizedRarity = settings.redEpics && rarityCategory.toUpperCase() === "E"
        ? "E1"
        : settings.rainbowLegs && rarityCategory.toUpperCase() === "L"
        ? "L1"
        : rarityCategory.toUpperCase();

      const rarityClass = `bg-rarity-${normalizedRarity}`;
      const { formatted, relative } = formatDate(r.timestamp);

      // Get puppet master information if the setting is enabled
      let puppetMasterText = '';
      if (settings.showPuppetmasters) {
        const puppetMaster = findPuppetmaster(r[role] || "N/A"); // Resolve puppet master
        if (puppetMaster.master !== r[role]) { // Only show if the puppet master is different
          puppetMasterText = `<span class="text-gray-500 text-sm">${formatNationName(puppetMaster.master)}</span>`;
        }
      }

      // Build the base row with nation, puppet master (if enabled), and card links
      const row = [
        `${nationLink}${puppetMasterText ? `<br>${puppetMasterText}` : ''}`, // Add puppet master info below nation name
        { value: cardLink, class: rarityClass },
      ];

      // Conditionally add the price column only if `includePrice` is true
      if (includePrice) {
        row.push({ value: formatPrice(r.price), class: "" });
      }

      // Add the date column
      row.push({
        value: `<span class="date-formatted ${showRelativeDate ? 'hidden' : 'block'}">${formatted}</span>
                <span class="date-relative ${showRelativeDate ? 'block' : 'hidden'}">${relative}</span>`,
        class: "date-cell",
        onClick: toggleDateFormat, // Attach click handler for toggling
      });

      return row;
    });
}

/**
 * Builds rows for trades (price !== 0).
 * @param {Array} records - The array of trade records.
 * @param {string} role - The role key ('buyer' or 'seller').
 * @returns {Array} - The processed rows for the trade table.
 */
export function makeTradeRows(records, role) {
  return makeRows(records, role, (r) => r.price !== 0, true, useSettings().showRelativeDate); // Include price
}

/**
 * Builds rows for gifts (price === 0).
 * @param {Array} records - The array of gift records.
 * @param {string} role - The role key ('buyer' or 'seller').
 * @returns {Array} - The processed rows for the gift table.
 */
export function makeGiftRows(records, role) {
  return makeRows(records, role, (r) => r.price === 0, false, useSettings().showRelativeDate); // Exclude price
}


  /**
 * Toggles the visibility of all formatted and relative date spans in the table.
 */
export function toggleDateFormat() {
  // Select all date cells
  const dateCells = document.querySelectorAll('.date-cell');

  dateCells.forEach((cell) => {
    const formatted = cell.querySelector('.date-formatted');
    const relative = cell.querySelector('.date-relative');

    if (formatted && relative) {
      // Toggle visibility for all date cells
      formatted.classList.toggle('hidden');
      relative.classList.toggle('hidden');
    }
  });
}
