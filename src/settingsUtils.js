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

function tokenizeWord(word) {
  const ordinalMatch = word.match(/^(\d+)(st|nd|rd|th)$/);
  if (ordinalMatch) {
    return [{ type: 'num', val: parseInt(ordinalMatch[1], 10) }];
  }
  if (/^\d+$/.test(word)) {
    return [{ type: 'num', val: parseInt(word, 10) }];
  }
  return [{ type: 'text', val: word }];
}

function detectNumericValues(items) {
  const seriesMap = new Map();
  items.forEach(item => {
    const s = String(item).toLowerCase();
    const parts = s.split(/[_\s-]+/).filter(Boolean);
    parts.forEach((p, i) => {
      if (/^\d+$/.test(p)) {
        const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
        const ctxAlpha = context.reduce((sum, c) => sum + c.replace(/[^a-z]/g, '').length, 0);
        if (ctxAlpha < 3) return;
        const key = JSON.stringify(context) + '|' + i;
        if (!seriesMap.has(key)) seriesMap.set(key, new Map());
        const valMap = seriesMap.get(key);
        const val = parseInt(p, 10);
        if (!valMap.has(val)) valMap.set(val, new Set());
        valMap.get(val).add(p);
      }
    });
  });
  const result = new Map();
  for (const [key, valMap] of seriesMap) {
    if (valMap.size >= 2) {
      const tokens = new Set();
      for (const ts of valMap.values()) {
        for (const t of ts) tokens.add(t);
      }
      result.set(key, tokens);
    }
  }
  return result;
}

function tokenize(s, romanMap, hexMap, numericMap) {
  const lower = s.toLowerCase();
  if (/[_\s-]/.test(lower)) {
    const words = lower.split(/[_\s-]+/).filter(Boolean);
    return words.flatMap((w, i) => {
      if (romanMap) {
        const context = [...words.slice(0, i), ...words.slice(i + 1)];
        const key = JSON.stringify(context) + '|' + i;
        const validSet = romanMap.get(key);
        if (validSet && validSet.has(w)) {
          return [{ type: 'num', val: romanToNumber(w), isRoman: true }];
        }
      }
      if (hexMap) {
        const context = [...words.slice(0, i), ...words.slice(i + 1)];
        const key = JSON.stringify(context) + '|' + i;
        const validSet = hexMap.get(key);
        if (validSet && validSet.has(w)) {
          return [{ type: 'num', val: parseInt(w, 16), isHex: true }];
        }
      }
      if (numericMap && /^\d+$/.test(w)) {
        const context = [...words.slice(0, i), ...words.slice(i + 1)];
        const key = JSON.stringify(context) + '|' + i;
        const validSet = numericMap.get(key);
        if (!(validSet && validSet.has(w))) {
          return [{ type: 'text', val: w }];
        }
      }
      return tokenizeWord(w);
    });
  }
  if (romanMap) {
    const match = lower.match(/^([a-z]+)([ivxlcdm]{2,})$/);
    if (match) {
      const stem = match[1];
      const ctxChars = stem.replace(/[^a-z]/g, '').length;
      if (ctxChars >= 3) {
        const key = JSON.stringify([stem]) + '|' + 1;
        const validSet = romanMap.get(key);
        if (validSet && validSet.has(match[2])) {
          return [
            { type: 'text', val: stem },
            { type: 'num', val: romanToNumber(match[2]), isRoman: true },
          ];
        }
      }
    }
  }
  if (hexMap) {
    const match = lower.match(/^([a-z]+)([0-9a-f]{2,})$/);
    if (match) {
      const stem = match[1];
      const ctxChars = stem.replace(/[^a-z]/g, '').length;
      if (ctxChars >= 3) {
        const key = JSON.stringify([stem]) + '|' + 1;
        const validSet = hexMap.get(key);
        if (validSet && validSet.has(match[2])) {
          return [
            { type: 'text', val: stem },
            { type: 'num', val: parseInt(match[2], 16), isHex: true },
          ];
        }
      }
    }
  }
  if (numericMap && /^\d+$/.test(lower)) {
    const key = JSON.stringify([]) + '|' + 0;
    const validSet = numericMap.get(key);
    if (!(validSet && validSet.has(lower))) {
      return [{ type: 'text', val: lower }];
    }
  }
  return tokenizeWord(lower);
}

function detectRomanValues(items) {
  const seriesMap = new Map();
  items.forEach(item => {
    const s = String(item).toLowerCase();
    const parts = s.split(/[_\s-]+/).filter(Boolean);
    parts.forEach((p, i) => {
      if (/^[ivxlcdm]{2,}$/.test(p) && isValidRoman(p)) {
        const val = romanToNumber(p);
        const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
        const ctxChars = context.reduce((sum, c) => sum + c.replace(/[^a-z]/g, '').length, 0);
        if (ctxChars < 3) return;
        const key = JSON.stringify(context) + '|' + i;
        if (!seriesMap.has(key)) seriesMap.set(key, new Map());
        const valMap = seriesMap.get(key);
        if (!valMap.has(val)) valMap.set(val, new Set());
        valMap.get(val).add(p);
      }
    });
    if (parts.length === 1 && !/[_\s-]/.test(s)) {
      const m = s.match(/^([a-z]+)([ivxlcdm]{2,})$/);
      if (m && isValidRoman(m[2])) {
        const p = m[2], val = romanToNumber(p), i = 1;
        const context = [m[1]];
        const ctxChars = context.reduce((sum, c) => sum + c.replace(/[^a-z]/g, '').length, 0);
        if (ctxChars < 3) return;
        const key = JSON.stringify(context) + '|' + i;
        if (!seriesMap.has(key)) seriesMap.set(key, new Map());
        const valMap = seriesMap.get(key);
        if (!valMap.has(val)) valMap.set(val, new Set());
        valMap.get(val).add(p);
      }
    }
  });
  const result = new Map();
  for (const [key, valMap] of seriesMap) {
    if (valMap.size >= 2) {
      const tokens = new Set();
      for (const ts of valMap.values()) {
        for (const t of ts) tokens.add(t);
      }
      result.set(key, tokens);
    }
  }
  return result;
}

function detectHexValues(items) {
  const seriesMap = new Map();
  items.forEach(item => {
    const s = String(item).toLowerCase();
    const parts = s.split(/[_\s-]+/).filter(Boolean);
    parts.forEach((p, i) => {
      if (/^[0-9a-f]{2,}$/.test(p) && /[a-f]/.test(p)) {
        const val = parseInt(p, 16);
        const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
        const ctxChars = context.reduce((sum, c) => sum + c.replace(/[^a-z]/g, '').length, 0);
        if (ctxChars < 3) return;
        const key = JSON.stringify(context) + '|' + i;
        if (!seriesMap.has(key)) seriesMap.set(key, new Map());
        const valMap = seriesMap.get(key);
        if (!valMap.has(val)) valMap.set(val, new Set());
        valMap.get(val).add(p);
      }
    });
    if (parts.length === 1 && !/[_\s-]/.test(s)) {
      const m = s.match(/^([a-z]+)([0-9a-f]{2,})$/);
      if (m && /[a-f]/.test(m[2])) {
        const p = m[2], val = parseInt(p, 16), i = 1;
        const context = [m[1]];
        const ctxChars = context.reduce((sum, c) => sum + c.replace(/[^a-z]/g, '').length, 0);
        if (ctxChars < 3) return;
        const key = JSON.stringify(context) + '|' + i;
        if (!seriesMap.has(key)) seriesMap.set(key, new Map());
        const valMap = seriesMap.get(key);
        if (!valMap.has(val)) valMap.set(val, new Set());
        valMap.get(val).add(p);
      }
    }
  });
  const result = new Map();
  for (const [key, valMap] of seriesMap) {
    if (valMap.size >= 2) {
      const tokens = new Set();
      for (const ts of valMap.values()) {
        for (const t of ts) tokens.add(t);
      }
      result.set(key, tokens);
    }
  }

  items.forEach(item => {
    const s = String(item).toLowerCase();
    const parts = s.split(/[_\s-]+/).filter(Boolean);
    parts.forEach((p, i) => {
      if (/^\d+$/.test(p)) {
        const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
        const ctxChars = context.reduce((sum, c) => sum + c.replace(/[^a-z]/g, '').length, 0);
        if (ctxChars < 3) return;
        const key = JSON.stringify(context) + '|' + i;
        if (result.has(key)) {
          result.get(key).add(p);
        }
      }
    });
    if (parts.length === 1 && !/[_\s-]/.test(s)) {
      const m = s.match(/^([a-z]+)(\d{2,})$/);
      if (m) {
        const p = m[2], i = 1;
        const context = [m[1]];
        const ctxChars = context.reduce((sum, c) => sum + c.replace(/[^a-z]/g, '').length, 0);
        if (ctxChars >= 3) {
          const key = JSON.stringify(context) + '|' + i;
          if (result.has(key)) {
            result.get(key).add(p);
          }
        }
      }
    }
  });

  return result;
}

export function createNaturalCompare(items) {
  const romanMap = detectRomanValues(items);
  const hexMap = detectHexValues(items);
  const numericMap = detectNumericValues(items);
  const cache = new Map();

  function prepare(s) {
    const cached = cache.get(s);
    if (cached) return cached;
    const tokens = tokenize(s, romanMap, hexMap, numericMap);
    const pattern = tokens.filter(t => t.type === 'text').map(t => t.val).join('');
    const result = { tokens, pattern };
    cache.set(s, result);
    return result;
  }

  const compare = function compare(a, b) {
    const pA = prepare(a);
    const pB = prepare(b);

    const aAllNum = pA.tokens.every(t => t.type === 'num');
    const bAllNum = pB.tokens.every(t => t.type === 'num');

    if (aAllNum && bAllNum) {
      const aT = pA.tokens, bT = pB.tokens;
      if (!aT.some(t => t.isRoman) && !bT.some(t => t.isRoman) && !aT.some(t => t.isHex) && !bT.some(t => t.isHex)) {
        const aDigitStr = aT.map(t => String(t.val)).join('');
        const bDigitStr = bT.map(t => String(t.val)).join('');
        const aTrim = aDigitStr.replace(/^0+/, '') || '0';
        const bTrim = bDigitStr.replace(/^0+/, '') || '0';
        const lenDiff = aTrim.length - bTrim.length;
        if (lenDiff !== 0) return lenDiff;
        const strDiff = aTrim.localeCompare(bTrim);
        if (strDiff !== 0) return strDiff;
      }
    }

    const patternDiff = pA.pattern.localeCompare(pB.pattern);
    if (patternDiff !== 0) return patternDiff;

    const aTokens = pA.tokens;
    const bTokens = pB.tokens;
    for (let i = 0; i < Math.max(aTokens.length, bTokens.length); i++) {
      const tA = aTokens[i];
      const tB = bTokens[i];
      if (tA === undefined) return -1;
      if (tB === undefined) return 1;

      if (tA.type === 'num' && tB.type === 'num') {
        const diff = tA.val - tB.val;
        if (diff !== 0) return diff;
      } else if (tA.type === 'text' && tB.type === 'text') {
        const diff = tA.val.localeCompare(tB.val);
        if (diff !== 0) return diff;
      } else {
        return tA.type === 'num' ? -1 : 1;
      }
    }
    return 0;
  };

  compare.getStem = function(name) {
    return prepare(name).tokens.filter(t => t.type === 'text').map(t => t.val).join('');
  };

  return compare;
}

export function naturalCompare(a, b) {
  return createNaturalCompare([a, b])(a, b);
}

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