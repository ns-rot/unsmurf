// settingsUtils.js

import { get } from 'svelte/store';
import { settingsStore, useSettings } from './settingsStore';
import Hypher from "hypher";
import english from "hyphenation.en-us";
import french from "hyphenation.fr";
import german from "hyphenation.de";
import { createNaturalCompare, naturalCompare, classicNaturalCompare } from './contextAwareSort.js';


// Normalize names using constant time patterns
export function normalizeName(name) {
  if (!name) return name;

  const decimalPattern = /\d(?:[\d_-]*\d)?/g;
  const hexPattern = /^[0-9A-Fa-f]+$/;
  const romanPattern = /^[IVXLCDM]+$/i;

  const decimalMatches = [...name.matchAll(decimalPattern)];
  const decimalMatch = decimalMatches.reduce((l, m) => (m[0].length > (l?.length || 0) ? m[0] : l), null);

  const tokens = name.split(/[_\s-]/);
  let selectedMatch = null;

  tokens.forEach((token) => {
    if (hexPattern.test(token)) {
      if (!selectedMatch || (selectedMatch.type !== "decimal" && token.length > selectedMatch.value.length)) {
        selectedMatch = { type: "hex", value: token };
      }
    }
    if (romanPattern.test(token) && isValidRoman(token)) {
      if (!selectedMatch || (selectedMatch.type !== "decimal" && selectedMatch.type !== "hex")) {
        selectedMatch = { type: "roman", value: token };
      }
    }
  });

  if (decimalMatch && (!selectedMatch || decimalMatch.length >= selectedMatch.value.length)) {
    selectedMatch = { type: "decimal", value: decimalMatch };
  }

  if (selectedMatch) {
    const { type, value } = selectedMatch;
    if (type === "decimal") {
      return name.replace(value, value.replace(/\d/g, "@"));
    } else if (type === "hex") {
      return name.replace(value, value.replace(/[0-9A-Fa-f]/g, "@"));
    } else if (type === "roman") {
      return name.replace(value, "#");
    }
  }

  return name;
}

//Canonicalize the nation name
export function canonicalizeName(name) {
  return name.toLowerCase().trim()
    .replace(/\s+/g, "_")   // Collapse multiple spaces into a single underscore
    .replace(/_+/g, "_")   // Collapse multiple underscores into a single underscore
    .replace(/[^a-z0-9_-]/g, ""); // Remove any character not in A-Z, a-z, 0-9, _, or -
}

const romanValues = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

function romanToNumber(s) {
  let total = 0, prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const curr = romanValues[s[i]];
    total += curr < prev ? -curr : curr;
    prev = curr;
  }
  return total;
}

// createNaturalCompare and naturalCompare are re-exported from contextAwareSort.js
export { createNaturalCompare, naturalCompare, classicNaturalCompare } from './contextAwareSort.js';

//Uncanonicalize the nation name
export function uncanonicalizeName(name) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

// Helper to validate Roman numerals
function isValidRoman(roman) {
  const romanRegex = /^(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))$/i;
  return romanRegex.test(roman);
}

// Initialize Hypher instances for different languages
const hyphenators = {
  en: new Hypher(english),
  fr: new Hypher(french),
  de: new Hypher(german),
  // Add more languages as needed
};

/**
 * Format a nation name with optional language selection.
 * Uses Knuth-Plass-style DP to pick optimal line break points,
 * preferring higher-quality breaks (spaces > hard hyphens > soft hyphens)
 * when the line count is the same.
 *
 * @param {string} name - The name to format.
 * @param {string} [language='en'] - The language for hyphenation ('en', 'fr', 'de', etc.).
 * @returns {string} - The formatted name.
 */
const nameFormatCache = new Map();

export function formatNationName(name, language = "en") {
  if (!name) return name;
  const cacheKey = `${name}|${language}`;
  const cached = nameFormatCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const hyphenator = hyphenators[language] || hyphenators.en;
  const SHY = "\u00AD";
  const TARGET = 12;    // ideal line length in chars (matches max-w-[12ch])
  const MAX_LINE = 12;  // hard cap matching max-w-[12ch]
  const COST = { 0: 0, 1: 3, 2: 21 };  // space > hard hyphen > SHY tiebreaker

  // --- Step 1: Parse into plain text + all possible break points ---
  const segments = String(name)
    .replace(/_/g, " ")
    .split(/(?=[-\s])|(?<=[-\s])/g);

  let text = "";           // plain text (no SHY)
  let breaks = [];         // { pos: number, priority: 0|1|2 }

  for (const seg of segments) {
    if (seg === " " || seg === "") {
      // space break — highest priority
      breaks.push({ pos: text.length + seg.length, priority: 0 });
      text += seg;
      continue;
    }

    if (seg === "-") {
      hardHyphen: {
        // break after the hard hyphen — medium priority
        text += seg;
        breaks.push({ pos: text.length, priority: 1 });
      }
      continue;
    }

    // Word segment
    const start = text.length;
    let word = seg.charAt(0).toUpperCase() + seg.slice(1);
    text += word;

    // Break at alpha-numeric boundary (e.g. abc123)
    const anRe = /([a-zA-Z])(?=\d)|(\d)(?=[a-zA-Z])/g;
    let m;
    while ((m = anRe.exec(word)) !== null) {
      breaks.push({ pos: start + m.index + 1, priority: 2 });
    }

    // Hyphenation breaks from Hypher (only for words long enough to need it)
    if (word.length > 8) {
      const syllables = hyphenator.hyphenate(word);
      if (syllables.length > 1) {
        let pos = start;
        for (let i = 0; i < syllables.length - 1; i++) {
          pos += syllables[i].length;
          breaks.push({ pos, priority: 2 });
        }
      }
    }
  }

  // Remove trailing space break (no content after it)
  if (text.endsWith(" ") && breaks.length > 0 && breaks[breaks.length - 1].pos === text.length) {
    breaks.pop();
  }

  // --- Step 2: DP to select optimal break positions ---
  const n = text.length;
  const INF = 1e9;
  const dp = new Array(n + 1).fill(INF);
  const nextPos = new Array(n + 1).fill(-1);
  dp[n] = 0;

  for (let i = n - 1; i >= 0; i--) {
    // Option: go straight to end of text
    const lineToEnd = n - i;
    if (lineToEnd <= MAX_LINE) {
      dp[i] = Math.pow(TARGET - lineToEnd, 2);
      nextPos[i] = n;
    }

    // Option: break at one of the recorded break points
    for (const bp of breaks) {
      if (bp.pos <= i) continue;
      const lineLen = bp.pos - i;
      if (lineLen > MAX_LINE) continue;

      const badness = Math.pow(TARGET - lineLen, 2) + COST[bp.priority];
      const total = badness + dp[bp.pos];
      if (total < dp[i]) {
        dp[i] = total;
        nextPos[i] = bp.pos;
      }
    }
  }

  // Reconstruct selected break positions
  const selected = new Set();
  let i = 0;
  while (i < n && nextPos[i] > i && nextPos[i] <= n) {
    if (nextPos[i] < n) selected.add(nextPos[i]);
    i = nextPos[i];
  }

  // --- Step 3: Build output with SHY only at selected positions ---
  const styled = text
    .split("")
    .map((ch, idx) => {
      if (ch === "-") {
        // hard hyphen: append ZWSP so the DP-chosen break can activate
        return selected.has(idx + 1) ? `${ch}\u200B` : ch;
      }
      if (ch === " ") {
        // space: naturally breakable, no marker needed
        return ch;
      }
      // word character: if a break was selected here, insert SHY before it
      if (selected.has(idx)) {
        return `<span style="font-size: 0.7em; vertical-align: middle;">${SHY}</span>${ch}`;
      }
      return ch;
    })
    .join("");

  const result = `<span style="hyphens: manual; -webkit-hyphens: manual; hyphenate-character: '↵'; -webkit-hyphenate-character: '↵'; overflow-wrap: break-word;">${styled}</span>`;
  nameFormatCache.set(cacheKey, result);
  return result;
}

// Utility to format dates
export function formatDate(ts) {
  if (!ts) return { formatted: "", relative: "" };

  const now = new Date();
  const date = new Date(ts * 1000);

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const formatted = `${dd}/${mm}<wbr>/${yy}`;

  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffYears = Math.floor(diffDays / 365);
  const remainingDays = diffDays % 365;

  const relative = diffYears > 0 ? `${diffYears}y ${remainingDays}d` : `${diffDays}d`;

  return { formatted, relative };
}

// Utility to format prices
export function formatPrice(price) {
  if (typeof price !== 'number') return 'N/A';
  const [integer, decimal] = price.toFixed(2).split('.');
  if (decimal === '00') {
    return `<span class="whitespace-nowrap">${integer}-</span>`;
  }
  return `<span class="whitespace-nowrap">${integer}<span class="text-sm font-medium underline relative top-[-0.4em]">${decimal}</span></span>`;
}

// Format large numbers into human-readable forms
export function formatLargeNumber(value) {
  if (value > 10000) {
    return `${Math.floor(value / 1000)}K`;
  } else if (value > 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value;
}

export function redirectToPage() {
  if (!nationId.trim()) {
    alert('Please enter a nation name.');
    return;
  }
}