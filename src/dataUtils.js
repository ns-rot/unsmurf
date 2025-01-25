// dataUtil.js

import { formatNationName, formatPrice, formatDate, formatLargeNumber, normalizeName } from './settingsUtils';
import { useSettings } from './settingsStore';
import { findPuppetmaster, isNationCurrent, queryS4 } from './sheetFetch';

export function tallyCounts(trades, roleKey, isTrade) {
  const tally = {};
  const rawToNormalizedMap = {};

  trades
    .filter((t) => (isTrade ? t.price !== 0 : t.price === 0))
    .forEach((t) => {
      const rawName = t[roleKey];
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
      rawToNormalizedMap[tallyName].add(rawName);

      // Tally counts using the normalized name
      tally[tallyName] = (tally[tallyName] || 0) + 1;
    });

  // Format and return the tally
  return buildTallyContent(tally, rawToNormalizedMap);
}

function buildTallyContent(tally, rawToNormalizedMap) {
  return Object.entries(tally)
    .map(([normalizedName, count]) => {
      let rawNames = Array.from(rawToNormalizedMap[normalizedName]).sort();
      let aggregatedName;

      if (useSettings().section === "puppets") {
        aggregatedName = normalizedName;
      } else {
        aggregatedName = rawNames[0];
      }

      let cte = "";
      if (useSettings().showCTE) {
      cte = isNationCurrent(aggregatedName)  ? '' : `<svg xmlns="http://www.w3.org/2000/svg" class="fill-black h-3.5 inline -translate-y-[2px] pr-[3px]" clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" viewBox="0 0 19 24">
      <path d="m16.317 21.569h.091c.645 0 1.263.256 1.718.712.456.456.712 1.074.712 1.718v.001h-18.838s0 0 0-.001c0-.644.256-1.262.712-1.718.455-.456 1.074-.712 1.718-.712h.091v-.175c0-2.069 1.677-3.746 3.746-3.746h.001v-14.076l3.16-3.572 3.142 3.572v14.076h.001c2.069 0 3.746 1.677 3.746 3.746z"></path>
    </svg>`;
  }

      const displayName = `<a href="https://www.nationstates.net/nation=${encodeURIComponent(
        aggregatedName
      )}/page=deck/show_trades" target="_blank" rel="noopener noreferrer">${cte}${formatNationName(
        aggregatedName
      )}</a>`;

      // Only add tally info if there are multiple nations grouped
      let puppetTally = "";
      if (rawNames.length > 1) {
        puppetTally = `<div class="tally-info ml-0.25 inline text-gray-500">
          <span>[${rawNames.length}]</span>
        </div>`;
      }

      const wrappedDisplay = `${displayName}${puppetTally}`;

      console.debug({
        aggregatedName,
        rawNames,
        count,
      });

      return [wrappedDisplay, count];
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
      let cte = "";
      if (useSettings().showCTE) {
      cte = isNationCurrent(r[role])  ? '' : `<svg xmlns="http://www.w3.org/2000/svg" class="fill-black h-3.5 inline -translate-y-[2px] pr-[3px]" clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" viewBox="0 0 19 24">
      <path d="m16.317 21.569h.091c.645 0 1.263.256 1.718.712.456.456.712 1.074.712 1.718v.001h-18.838s0 0 0-.001c0-.644.256-1.262.712-1.718.455-.456 1.074-.712 1.718-.712h.091v-.175c0-2.069 1.677-3.746 3.746-3.746h.001v-14.076l3.16-3.572 3.142 3.572v14.076h.001c2.069 0 3.746 1.677 3.746 3.746z"></path>
    </svg>`;
      }
      let nationDisplay = cte + formatNationName(r[role] || "N/A");
      const nationLink = `<a href="https://www.nationstates.net/nation=${encodeURIComponent(r[role] || "N/A")}"
        target="_blank" rel="noopener noreferrer">${nationDisplay}</a>`;
      const cardLink = `<a href="https://www.nationstates.net/page=deck/card=${r.card_id}/season=${r.season}"
        target="_blank" rel="noopener noreferrer">S${r.season} ${formatNationName(r.card_name || queryS4(r.card_id))}</a>`;
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
          let cte = "";
          if (useSettings().showCTE) {
          cte = isNationCurrent(puppetMaster.master) ? '' : `<svg xmlns="http://www.w3.org/2000/svg" class="fill-gray-500 h-[0.65rem] inline -translate-y-[1.5px] pr-[2.5px]" clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" viewBox="0 0 19 24">
       <path d="m16.317 21.569h.091c.645 0 1.263.256 1.718.712.456.456.712 1.074.712 1.718v.001h-18.838s0 0 0-.001c0-.644.256-1.262.712-1.718.455-.456 1.074-.712 1.718-.712h.091v-.175c0-2.069 1.677-3.746 3.746-3.746h.001v-14.076l3.16-3.572 3.142 3.572v14.076h.001c2.069 0 3.746 1.677 3.746 3.746z"></path>
     </svg>`;
        }
          puppetMasterText += `<span class="text-gray-500 text-sm"><a href="https://www.nationstates.net/nation=${puppetMaster.master}"
        target="_blank" rel="noopener noreferrer">${cte}${formatNationName(puppetMaster.master)}</a></span>`;
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
