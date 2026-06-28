// dataUtil.js

import {
  formatNationName,
  formatPrice,
  formatDate,
  formatLargeNumber,
  normalizeName,
  canonicalizeName,
} from "./settingsUtils";
import { useSettings } from "./settingsStore";
import { createVersionedStorage } from "./storageUtils";
import {
  findPuppetmaster,
  isNationCurrent,
  puppetMasterCache,
  masterToPuppetsCache,
} from "./sheetFetch";

export function tallyCounts(trades, roleKey, isTrade, context) {
  const tally = {};
  const rawToNormalizedMap = {};
  const settings = useSettings();
  const section = settings.section;

  if (!trades) return [];

  trades
    .filter((t) => (isTrade ? t.price !== 0 : t.price === 0))
    .forEach((t) => {
      const rawName = t[roleKey];
      if (!rawName) return; // Skip invalid entries

      let tallyName;

      if (section === "puppets") {
        tallyName = findPuppetmaster(
          rawName.toLowerCase().replace(/\s+/g, "_")
        ).master; // Normalize and find puppet master
      } else if (section === "similar-name") {
        tallyName = normalizeName(rawName); // Normalize the name
      } else {
        tallyName = rawName;
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
  return buildTallyContent(tally, rawToNormalizedMap, context, settings);
}

function buildTallyContent(tally, rawToNormalizedMap, context, settings) {
  if (!settings) settings = useSettings();
  const section = settings.section;
  const showCTE = settings.showCTE;

  return Object.entries(tally)
    .map(([normalizedName, count]) => {
      let rawNames = Array.from(rawToNormalizedMap[normalizedName]).sort();
      let aggregatedName;

      if (section === "puppets") {
        aggregatedName = normalizedName;
      } else {
        aggregatedName = rawNames[0];
      }

      let cte = "";
      if (showCTE) {
        cte = isNationCurrent(aggregatedName) ? "" : `<span class="select-none text-red-600 dark:text-red-400">&#xe000;&#x2009;</span>`;
      }

      const displayName = `<a href="${getNationLink(aggregatedName, context)}" target="_blank" rel="noopener noreferrer" data-nation="true" data-nation-name="${aggregatedName}">${cte}${formatNationName(
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

      return [wrappedDisplay, count, aggregatedName];
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
  history.replaceState({}, "", newUrl);
}

// Fetch data from the API
export async function fetchData(role, nationId, forceRefresh = false) {
  const canonicalNationId = canonicalizeName(nationId);
  const cacheKey = `unsmurf_cache_${role}_${canonicalNationId}`;
  const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

  if (!forceRefresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          return { trades: parsed.data, cacheTime: parsed.timestamp };
        }
      } catch (e) {
        console.error("Error parsing cache", e);
      }
    }
  }

  const url = `https://maki.kractero.com/api/trades?limit=-1&${role}=${canonicalNationId}&category=All&sortval=Timestamp&sortorder=Desc`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${role} data:`, response.status);
      return { trades: [], cacheTime: null };
    }
    const data = await response.json();
    const trades = data.trades || [];

    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ timestamp: Date.now(), data: trades })
      );
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }

    return { trades, cacheTime: Date.now() };
  } catch (err) {
    console.error(`Error fetching ${role} data:`, err);
    return { trades: [], cacheTime: null };
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
    {
      label: role === "buyer" ? "Buyer" : "Seller",
      alignment: "left",
      styles: ["min-w-[6ch]", "max-w-[12ch]"],
    },
    {
      label: "Card",
      alignment: "left",
      styles: ["min-w-[6ch]", "max-w-[12ch]"],
    },
    { label: "Price", alignment: "center", styles: ["min-w-[3ch]"] },
    { label: "Date", alignment: "right", styles: ["min-w-[5ch]"] },
  ];
}

export function makeGiftColumns(role) {
  return [
    {
      label: role === "buyer" ? "Buyer" : "Seller",
      alignment: "left",
      styles: ["min-w-[6ch]", "max-w-[12ch]"],
    },
    {
      label: "Card",
      alignment: "left",
      styles: ["min-w-[6ch]", "max-w-[12ch]"],
    },
    { label: "Date", alignment: "right", styles: ["min-w-[5ch]"] },
  ];
}

/**
 * Builds data rows for trades or gifts.
 * @param {Array} records - The array of records (trades or gifts).
 * @param {string} role - The role key ('buyer' or 'seller').
 * @param {function} filterCondition - A function to filter records (e.g., price !== 0 for trades, price === 0 for gifts).
 * @param {boolean} includePrice - Whether to include the price column (only applies to trades).
 * @param {string} dateFormat - "absolute" or "relative".
 * @returns {Array} - An array of processed rows for the table.
 */
export function makeRows(
  records,
  role,
  filterCondition,
  includePrice,
  dateFormat,
  context
) {
  return records.filter(filterCondition).map((r) => {
    let cte = "";
    if (useSettings().showCTE) {
      cte = isNationCurrent(r[role]) ? "" : `<span class="select-none text-red-600 dark:text-red-400">&#xe000;&#x2009;</span>`;
    }
    let nationDisplay = cte + formatNationName(r[role] || "N/A");
    const nationLink = `<a href="${getNationLink(r[role] || "N/A", context)}"
        target="_blank" rel="noopener noreferrer" data-nation="true" data-nation-name="${r[role] || "N/A"}">${nationDisplay}</a>`;
    const seasonText = `S${r.season}`;
    const cardNameDisplay = formatNationName(r.card_name || r.card_id);
    const cardUrl = `https://www.nationstates.net/page=deck/card=${r.card_id}/season=${r.season}`;
    const settings = useSettings();
    const rarityCategory = r.category || "C";

    // Conditionally cast "E" to "E1" based on the `redEpics` setting
    // Conditionally cast "L" to "L1" based on the `rainbowLegs` setting
    const normalizedRarity =
      settings.redEpics && rarityCategory.toUpperCase() === "E"
        ? "E1"
        : settings.rainbowLegs && rarityCategory.toUpperCase() === "L"
          ? "L1"
          : rarityCategory.toUpperCase();

    let rarityClass = "";
    let displayCardLinkContent = "";

    const isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (settings.midnightMode && isDark) {
      // In midnight mode, use a pill for the season number instead of a swatch
      const pillClass = `inline-block px-1.5 py-0.5 rounded-full text-[10px] leading-none font-semibold bg-rarityMidnight-${normalizedRarity} text-black mr-1 align-middle relative -top-[1px]`;
      displayCardLinkContent = `<span class="${pillClass}">${seasonText}</span>${cardNameDisplay}`;
    } else {
      // Standard mode: full background color on the cell
      displayCardLinkContent = `${seasonText} ${cardNameDisplay}`;
      rarityClass = `bg-rarity-${normalizedRarity} dark:bg-rarityDark-${normalizedRarity}`;
    }

    const displayCardLink = `<a href="${cardUrl}" target="_blank" rel="noopener noreferrer">${displayCardLinkContent}</a>`;

    const { formatted, relative } = formatDate(r.timestamp);

    // Get puppet master information if the setting is enabled
    let puppetMasterText = "";
    if (settings.showPuppetmasters) {
      const puppetMaster = findPuppetmaster(r[role] || "N/A"); // Resolve puppet master
      if (puppetMaster.master !== r[role]) {
        // Only show if the puppet master is different
        if (useSettings().showCTE) {
          cte = isNationCurrent(puppetMaster.master) ? "" : `<span class="select-none text-red-400 dark:text-red-400 opacity-60">&#xe000;&#x2009;</span>`;
        }
        puppetMasterText += `<span class="text-gray-500 text-sm"><a href="${getNationLink(puppetMaster.master, context)}"
        target="_blank" rel="noopener noreferrer" data-nation="true" data-nation-name="${puppetMaster.master}">${cte}${formatNationName(
          puppetMaster.master
        )}</a></span>`;
      }
    }

    // Build the base row with nation, puppet master (if enabled), and card links
    const row = [
      `${nationLink}${puppetMasterText ? `<br>${puppetMasterText}` : ""}`, // Add puppet master info below nation name
      { value: displayCardLink, class: rarityClass },
    ];

    // Conditionally add the price column only if `includePrice` is true
    if (includePrice) {
      row.push({ value: formatPrice(r.price), class: "" });
    }

    // Add the date column
    row.push({
      value: `<span class="date-formatted ${dateFormat === "relative" ? "hidden" : "block"
        }">${formatted}</span>
                <span class="date-relative ${dateFormat === "relative" ? "block" : "hidden"
        }">${relative}</span>`,
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
export function makeTradeRows(records, role, context) {
  return makeRows(
    records,
    role,
    (r) => r.price !== 0,
    true,
    useSettings().dateFormat,
    context
  ); // Include price
}

/**
 * Builds rows for gifts (price === 0).
 * @param {Array} records - The array of gift records.
 * @param {string} role - The role key ('buyer' or 'seller').
 * @returns {Array} - The processed rows for the gift table.
 */
export function makeGiftRows(records, role, context) {
  return makeRows(
    records,
    role,
    (r) => r.price === 0,
    false,
    useSettings().dateFormat,
    context
  ); // Exclude price
}

/**
 * Toggles the visibility of all formatted and relative date spans in the table.
 */
export function toggleDateFormat() {
  // Select all date cells
  const dateCells = document.querySelectorAll(".date-cell");

  dateCells.forEach((cell) => {
    const formatted = cell.querySelector(".date-formatted");
    const relative = cell.querySelector(".date-relative");

    if (formatted && relative) {
      // Toggle visibility for all date cells
      formatted.classList.toggle("hidden");
      relative.classList.toggle("hidden");
    }
  });
}

export function getNationLink(nationName, context) {
  const settings = useSettings();
  const encodedName = encodeURIComponent(nationName);

  let linkType = "nation";

  // Check for CTE override first
  if (settings.enableCTELink && !isNationCurrent(nationName)) {
    linkType = settings.linkTypeCTE;
  } else {
    // Determine link type based on context
    switch (context) {
      case "tallySent":
        linkType = settings.linkTypeTallySent;
        break;
      case "tallyReceived":
        linkType = settings.linkTypeTallyReceived;
        break;
      case "detailedSent":
        linkType = settings.linkTypeDetailedSent;
        break;
      case "detailedReceived":
        linkType = settings.linkTypeDetailedReceived;
        break;
      case "puppetPopup":
        linkType = settings.linkTypePuppet;
        break;
      default:
        linkType = "nation";
    }
  }

  switch (linkType) {
    case "trades":
      return `https://www.nationstates.net/nation=${encodedName}/page=deck/show_trades`;
    case "buys":
      return `https://www.nationstates.net/nation=${encodedName}/page=deck/show_trades=buys`;
    case "sells":
      return `https://www.nationstates.net/nation=${encodedName}/page=deck/show_trades=sales`;
    case "unsmurf":
      return `https://ns-rot.github.io/unsmurf/?q=${encodedName}`;
    case "boneyard":
      return `https://www.nationstates.net/page=boneyard?nation=${encodedName}`;
    case "custom":
      return settings.customLinkTemplate
        ? settings.customLinkTemplate.replace(/{nation}/g, encodedName).replace(/\[nation\]/g, encodedName)
        : `https://www.nationstates.net/nation=${encodedName}`;
    case "nation":
    default:
      return `https://www.nationstates.net/nation=${encodedName}`;
  }
}

export function getAllNationLinks(nationName) {
  const settings = useSettings();
  const encodedName = encodeURIComponent(nationName);

  const links = [
    { value: "unsmurf", label: "Unsmurf", url: `https://ns-rot.github.io/unsmurf/?q=${encodedName}` },
    { value: "nation", label: "NationStates", url: `https://www.nationstates.net/nation=${encodedName}` },
    { value: "trades", label: "NS Deck", url: `https://www.nationstates.net/nation=${encodedName}/page=deck/show_trades` },
    { value: "buys", label: "NS Card Buys", url: `https://www.nationstates.net/nation=${encodedName}/page=deck/show_trades=buys` },
    { value: "sells", label: "NS Card Sales", url: `https://www.nationstates.net/nation=${encodedName}/page=deck/show_trades=sales` },
    { value: "boneyard", label: "NS Boneyard", url: `https://www.nationstates.net/page=boneyard?nation=${encodedName}` },
    { value: "custom", label: settings.customLinkLabel || "Custom URL", url: null },
  ];

  const custom = links.find((l) => l.value === "custom");
  if (custom) {
    if (settings.customLinkTemplate && settings.customLinkTemplate !== "https://www.nationstates.net/nation={nation}") {
      custom.url = settings.customLinkTemplate
        .replace(/{nation}/g, encodedName)
        .replace(/\[nation\]/g, encodedName);
    }
    if (!custom.url) {
      return links.filter((l) => l.value !== "custom");
    }
  }

  return links;
}

const RANDOM_STATE_VERSION = 1;

// Random state schema v1 — single source of truth for shape, types, and defaults
const randomStateSchema = {
  candidates:         { type: "array:string", default: [] },
  blacklist:          { type: "array:string", default: [] },
  completedDays:      { type: "array:string", default: [] },
  dayPageMap:         { type: "map:number", default: {} },
  lastBlacklistReset: { type: "number", default: "Date.now()" },
  createdAt:          { type: "number", default: "Date.now()" },
};

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const randomStateMigrations = {
  1: (s) => {
    if (!Array.isArray(s.candidates)) s.candidates = [];
    if (!Array.isArray(s.blacklist)) s.blacklist = [];
    if (!Array.isArray(s.completedDays)) s.completedDays = [];
    if (!s.dayPageMap || typeof s.dayPageMap !== "object" || Array.isArray(s.dayPageMap)) {
      s.dayPageMap = {};
    } else {
      for (const [k, v] of Object.entries(s.dayPageMap)) {
        if (typeof v !== "number" || !Number.isFinite(v) || v < 1) {
          delete s.dayPageMap[k];
        }
      }
    }
    if (typeof s.lastBlacklistReset !== "number" || !Number.isFinite(s.lastBlacklistReset)) {
      s.lastBlacklistReset = Date.now();
    }
    if (typeof s.createdAt !== "number" || !Number.isFinite(s.createdAt)) {
      s.createdAt = Date.now();
    }
    s.version = 1;
    return s;
  },
};

function repairRandomState(s) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);
  const cutoffStr = fmtDate(cutoff);
  s.completedDays = (s.completedDays || []).filter((d) => d >= cutoffStr);
  s.dayPageMap = s.dayPageMap || {};
  for (const d of Object.keys(s.dayPageMap)) {
    if (d < cutoffStr) delete s.dayPageMap[d];
  }
  if (Date.now() - (s.lastBlacklistReset || 0) > 24 * 60 * 60 * 1000) {
    s.candidates = [];
    s.blacklist = [];
    s.lastBlacklistReset = Date.now();
  }
  s.candidates = s.candidates || [];
  s.blacklist = s.blacklist || [];
  return s;
}

const randomDefaults = Object.fromEntries(
  Object.entries(randomStateSchema).map(([k, v]) => [
    k,
    v.default === "Date.now()" ? Date.now() : v.default,
  ])
);

const randomStorage = createVersionedStorage("unsmurf_random_state", {
  defaults: randomDefaults,
  migrations: randomStateMigrations,
  currentVersion: RANDOM_STATE_VERSION,
  repair: repairRandomState,
});

function readRandomState() {
  return randomStorage.read();
}

function saveRandomState(state) {
  randomStorage.save(state);
}

export function pickRandomCandidate() {
  const state = readRandomState();
  if (state.candidates.length === 0) return null;
  const idx = Math.floor(Math.random() * state.candidates.length);
  const pick = state.candidates[idx];
  state.candidates.splice(idx, 1);
  const norm = pick.toLowerCase().replace(/\s+/g, "_");
  if (!state.blacklist.includes(norm)) {
    state.blacklist.push(norm);
  }
  saveRandomState(state);
  return pick;
}

export function randomCandidateCount() {
  return readRandomState().candidates.length;
}

export async function refillRandomCandidates() {
  const state = readRandomState();

  const now = new Date();
  const available = [];
  for (let i = 1; i <= 28; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = fmtDate(d);
    if (!state.completedDays.includes(ds)) {
      available.push(ds);
    }
  }
  if (available.length === 0) return false;

  const day = available[Math.floor(Math.random() * available.length)];
  const page = state.dayPageMap[day] || 1;
  const d = new Date(day);
  d.setDate(d.getDate() + 1);
  const beforetime = fmtDate(d);
  const url = `https://maki.kractero.com/api/trades-paginated?page=${page}&maxprice=0&sincetime=${day}&beforetime=${beforetime}&limit=50`;

  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    return false;
  }
  if (!response.ok) return false;

  const data = await response.json();
  const trades = data.trades || data || [];

  for (const trade of trades) {
    const seller = trade.seller;
    if (!seller) continue;
    const norm = seller.toLowerCase().replace(/\s+/g, "_");
    if (state.blacklist.includes(norm)) continue;
    const isKnownPuppet = puppetMasterCache && puppetMasterCache[norm];
    const isKnownMaster = masterToPuppetsCache && masterToPuppetsCache[norm];
    if (!isKnownPuppet && !isKnownMaster) {
      state.candidates.push(seller);
      state.blacklist.push(norm);
    }
  }

  if (trades.length < 50) {
    if (!state.completedDays.includes(day)) {
      state.completedDays.push(day);
    }
    delete state.dayPageMap[day];
  } else {
    state.dayPageMap[day] = page + 1;
  }

  saveRandomState(state);
  return state.candidates.length > 0;
}
