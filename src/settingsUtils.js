// settingsUtils.js

import { get } from 'svelte/store';
import { settingsStore, useSettings } from './settingsStore';
import Hypher from "hypher";
import english from "hyphenation.en-us";
import french from "hyphenation.fr";
import german from "hyphenation.de";
import { createNaturalCompare, naturalCompare } from './naturalSort.js';


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

// The natural sort implementation has moved to naturalSort.js
// createNaturalCompare and naturalCompare are re-exported from there
export { createNaturalCompare, naturalCompare } from './naturalSort.js';

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
 * @param {string} name - The name to format.
 * @param {string} [language='en'] - The language for hyphenation ('en', 'fr', 'de', etc.).
 * @returns {string} - The formatted name.
 */
export function formatNationName(name, language = "en") {
  if (!name) return name;

  const hyphenator = hyphenators[language] || hyphenators.en;
  const SHY = "\u00AD"; // Soft Hyphen: invisible unless it wraps

  const processed = String(name)
    .replace(/_/g, " ")
    .split(/(?=[-\s])|(?<=[-\s])/g)
    .map((segment) => {
      if (segment === "-" || segment.trim() === "") return segment;

      // 1. Insert Soft Hyphens at alpha-numeric boundaries
      let text = segment.replace(/([a-zA-Z])(?=\d)|(\d)(?=[a-zA-Z])/g, `$1${SHY}$2`);

      // 2. Hyphenate long segments
      if (text.length > 8) {
        const hyphenated = hyphenator.hyphenate(text).join(SHY);
        text = hyphenated === text ? text.match(/.{1,3}/g).join(SHY) : hyphenated;
      }

      // 3. Capitalize
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join("");

  // 4. Wrap with the '↵' return symbol (indicating a system wrap)
  // This character is unselectable metadata inserted by the browser.
  // We wrap the soft hyphens in a smaller span to reduce the size of the '↵' symbol.
  const styled = processed.replaceAll(SHY, `<span style="font-size: 0.7em; vertical-align: middle;">${SHY}</span>`);
  return `<span style="hyphens: manual; -webkit-hyphens: manual; hyphenate-character: '↵'; -webkit-hyphenate-character: '↵';">${styled}</span>`;
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