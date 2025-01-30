// settingsUtils.js

import { get } from 'svelte/store';
import { settingsStore, useSettings } from './settingsStore';
import Hypher from "hypher";
import english from "hyphenation.en-us";
import french from "hyphenation.fr";
import german from "hyphenation.de";


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
  return name.toLowerCase().trim().replace(/\s+/g, "_");
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

  // Default to English if the specified language is not available
  const hyphenator = hyphenators[language] || hyphenators.en;

  // Helper to insert zero-width space between alpha and numeric boundaries
  function insertZeroWidthSpace(input) {
    return input.replace(/([a-zA-Z])(?=\d)|(\d)(?=[a-zA-Z])/g, '$1\u200B$2');
  }

  // Helper to insert soft hyphens
  function insertShy(word) {
    // Try using the hyphenator for the specified language
    const hyphenated = hyphenator.hyphenate(word).join("&shy;");
    // If no hyphenation occurred, use a fallback to insert every 3 characters
    return hyphenated === word ? word.match(/.{1,3}/g).join("&shy;") : hyphenated;
  }

  // Helper to capitalize the first letter of a segment
  function capitalizeSegment(segment) {
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }

  // Process the name
  return name
    .replace(/_/g, " ") // Replace underscores with spaces
    .split(/(?=[-\s])|(?<=[-\s])/g) // Split by spaces or hyphens, retaining the delimiters
    .map((segment) => {
      if (segment === "-" || segment.trim() === "") {
        // Retain hyphens and spaces as-is
        return segment;
      }

      const withZeroWidthSpace = insertZeroWidthSpace(segment); // Add zero-width space
      const hyphenated = withZeroWidthSpace.length > 8 ? insertShy(withZeroWidthSpace) : withZeroWidthSpace; // Insert soft hyphens for long segments
      return capitalizeSegment(hyphenated); // Capitalize each segment
    })
    .join(""); // Rejoin without adding extra spaces
}

// Utility to format dates
export function formatDate(ts) {
  if (!ts) return { formatted: "", relative: "" };

  const now = new Date();
  const date = new Date(ts * 1000);

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const formatted = `${dd}/${mm}/${yy}`;

  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffYears = Math.floor(diffDays / 365);
  const remainingDays = diffDays % 365;

  const relative = diffYears > 0 ? `${diffYears}y ${remainingDays}d ago` : `${diffDays}d ago`;

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