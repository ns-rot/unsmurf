/**
 * Natural sort for NationStates nation names.
 * Context-dependent Roman numeral, hex, and numeric series detection.
 */

const SEP = /[_\s-]+/;

// --- Individual token classifiers (all single-token returns) ---

const ROMAN_WORD_RE = /^[ivxlcdm]+$/i;
const HEX_WORD_RE = /^[0-9a-f]+$/i;
const HEX_HAS_LETTER = /[a-f]/i;
const ORDINAL_RE = /^(\d+)(st|nd|rd|th)$/i;
const DIGIT_RE = /^\d+$/;

const CONCAT_ROMAN_RE = /^([a-z]+)([ivxlcdm]+)$/;
const CONCAT_HEX_RE = /^([a-z]+)([0-9a-f]+)$/;

const romanCharValues = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

function romanToNumber(s) {
  let total = 0, prev = 0;
  s = s.toLowerCase();
  for (let i = s.length - 1; i >= 0; i--) {
    const curr = romanCharValues[s[i]];
    total += curr < prev ? -curr : curr;
    prev = curr;
  }
  return total;
}

function isValidRoman(s) {
  return /^(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))$/i.test(s);
}

/** Count alpha characters in an array of strings. */
function alphaChars(parts) {
  return parts.reduce((sum, p) => sum + p.replace(/[^a-z]/g, '').length, 0);
}

/** Build a context key from surrounding words and position. */
function contextKey(contextParts, index) {
  return contextParts.join('|') + '|' + index;
}

/**
 * Detect Roman, hex, and numeric series in a single 2-pass scan.
 *
 * Pass 1: find "confirmed" series (same context+position with >=2 distinct numeric values)
 * for all three types simultaneously.  Pass 2: at confirmed positions, add permissive matches.
 *
 * Returns { romanMap, hexMap, numericMap } — each is Map<contextKey, Set<rawToken>>.
 */
function detectAllSeries(items) {
  const romanSeries = new Map(), hexSeries = new Map(), numericSeries = new Map();

  // Pre-split to avoid redundant work across passes and types
  const prepped = items.map(item => {
    const s = String(item).toLowerCase();
    const parts = s.split(SEP).filter(Boolean);
    const alphaPerPart = parts.map(p => p.replace(/[^a-z]/g, '').length);
    const totalAlpha = alphaPerPart.reduce((a, b) => a + b, 0);
    return { s, parts, alphaPerPart, totalAlpha };
  });

  // ── Pass 1: stringent matches for all 3 types ──
  for (const { s, parts, alphaPerPart, totalAlpha } of prepped) {
    for (let i = 0; i < parts.length; i++) {
      const w = parts[i];
      if (totalAlpha - alphaPerPart[i] < 3) continue;
      const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
      const key = contextKey(context, i);

      if (w.length >= 2 && isValidRoman(w)) {
        const val = romanToNumber(w);
        if (!romanSeries.has(key)) romanSeries.set(key, new Map());
        const m = romanSeries.get(key);
        if (!m.has(val)) m.set(val, new Set());
        m.get(val).add(w);
      }
      if (w.length >= 2 && HEX_WORD_RE.test(w) && HEX_HAS_LETTER.test(w)) {
        const val = parseInt(w, 16);
        if (!hexSeries.has(key)) hexSeries.set(key, new Map());
        const m = hexSeries.get(key);
        if (!m.has(val)) m.set(val, new Set());
        m.get(val).add(w);
      }
      if (DIGIT_RE.test(w)) {
        const val = parseInt(w, 10);
        if (!numericSeries.has(key)) numericSeries.set(key, new Map());
        const m = numericSeries.get(key);
        if (!m.has(val)) m.set(val, new Set());
        m.get(val).add(w);
      }
    }

    // Concat names (single-part)
    if (parts.length === 1) {
      const rm = s.match(/^([a-z]+)([ivxlcdm]{2,})$/);
      if (rm && isValidRoman(rm[2]) && alphaChars([rm[1]]) >= 3) {
        const key = contextKey([rm[1]], 1);
        const val = romanToNumber(rm[2]);
        if (!romanSeries.has(key)) romanSeries.set(key, new Map());
        const m = romanSeries.get(key);
        if (!m.has(val)) m.set(val, new Set());
        m.get(val).add(rm[2]);
      }
      const hm = s.match(/^([a-z]+)([0-9a-f]{2,})$/);
      if (hm && HEX_HAS_LETTER.test(hm[2]) && alphaChars([hm[1]]) >= 3) {
        const key = contextKey([hm[1]], 1);
        const val = parseInt(hm[2], 16);
        if (!hexSeries.has(key)) hexSeries.set(key, new Map());
        const m = hexSeries.get(key);
        if (!m.has(val)) m.set(val, new Set());
        m.get(val).add(hm[2]);
      }
      const nm = s.match(/^([a-z]{3,})(\d+)$/);
      if (nm && alphaChars([nm[1]]) >= 3) {
        const key = contextKey([nm[1]], 1);
        const val = parseInt(nm[2], 10);
        if (!numericSeries.has(key)) numericSeries.set(key, new Map());
        const m = numericSeries.get(key);
        if (!m.has(val)) m.set(val, new Set());
        m.get(val).add(nm[2]);
      }
    }
  }

  // Keep only groups with >=2 distinct numeric values
  function filterMap(seriesMap) {
    const result = new Map();
    for (const [key, valMap] of seriesMap) {
      if (valMap.size >= 2) {
        const tokens = new Set();
        for (const ts of valMap.values()) for (const t of ts) tokens.add(t);
        result.set(key, tokens);
      }
    }
    return result;
  }
  const romanMap = filterMap(romanSeries);
  const hexMap = filterMap(hexSeries);
  const numericMap = filterMap(numericSeries);

  // ── Pass 2: permissive matches at confirmed positions ──
  for (const { s, parts, alphaPerPart, totalAlpha } of prepped) {
    for (let i = 0; i < parts.length; i++) {
      const w = parts[i];
      if (totalAlpha - alphaPerPart[i] < 3) continue;
      const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
      const key = contextKey(context, i);

      if (romanMap.has(key) && ROMAN_WORD_RE.test(w)) romanMap.get(key).add(w);
      if (hexMap.has(key) && ((HEX_WORD_RE.test(w) && HEX_HAS_LETTER.test(w)) || DIGIT_RE.test(w))) hexMap.get(key).add(w);
      if (numericMap.has(key) && DIGIT_RE.test(w)) numericMap.get(key).add(w);
    }

    // Concat second pass
    if (parts.length === 1) {
      const rc = s.match(CONCAT_ROMAN_RE);
      if (rc && alphaChars([rc[1]]) >= 3) {
        const key = contextKey([rc[1]], 1);
        if (romanMap.has(key)) romanMap.get(key).add(rc[2]);
      }
      const dc = s.match(/^([a-z]+)(\d{2,})$/);
      if (dc && alphaChars([dc[1]]) >= 3) {
        const key = contextKey([dc[1]], 1);
        if (hexMap.has(key)) hexMap.get(key).add(dc[2]);
      }
      const hc = s.match(CONCAT_HEX_RE);
      if (hc && HEX_HAS_LETTER.test(hc[2]) && alphaChars([hc[1]]) >= 3) {
        const key = contextKey([hc[1]], 1);
        if (hexMap.has(key)) hexMap.get(key).add(hc[2]);
      }
      const nc = s.match(/^([a-z]{3,})(\d+)$/);
      if (nc && alphaChars([nc[1]]) >= 3) {
        const key = contextKey([nc[1]], 1);
        if (numericMap.has(key)) numericMap.get(key).add(nc[2]);
      }
    }
  }

  return { romanMap, hexMap, numericMap };
}

// --- Tokenize ---

function tokenizeConcat(s, romanMap, hexMap, numericMap) {
  const lower = s.toLowerCase();

  // Try Roman suffix
  if (romanMap) {
    const m = lower.match(CONCAT_ROMAN_RE);
    if (m) {
      const stem = m[1], suffix = m[2];
      if (alphaChars([stem]) >= 3) {
        const key = contextKey([stem], 1);
        const vs = romanMap.get(key);
        if (vs && vs.has(suffix)) {
          return [
            { type: 'text', val: stem },
            { type: 'num', val: romanToNumber(suffix), isRoman: true },
          ];
        }
      }
    }
  }

  // Try hex suffix
  if (hexMap) {
    const m = lower.match(CONCAT_HEX_RE);
    if (m) {
      const stem = m[1], suffix = m[2];
      if (alphaChars([stem]) >= 3) {
        const key = contextKey([stem], 1);
        const vs = hexMap.get(key);
        if (vs && vs.has(suffix)) {
          return [
            { type: 'text', val: stem },
            { type: 'num', val: parseInt(suffix, 16), isHex: true },
          ];
        }
      }
    }
  }

  // Try numeric suffix
  if (numericMap) {
    const m = lower.match(/^([a-z]{3,})(\d+)$/);
    if (m) {
      const stem = m[1], suffix = m[2];
      const key = contextKey([stem], 1);
      const vs = numericMap.get(key);
      if (vs && vs.has(suffix)) {
        return [
          { type: 'text', val: stem },
          { type: 'num', val: parseInt(suffix, 10) },
        ];
      }
    }
  }

  // Numeric map inverted check
  if (numericMap && DIGIT_RE.test(lower)) {
    const key = contextKey([], 0);
    const vs = numericMap.get(key);
    if (!(vs && vs.has(lower))) return [{ type: 'text', val: lower }];
  }

  return tokenizeWord(lower);
}

function tokenizeWord(w) {
  const ord = w.match(ORDINAL_RE);
  if (ord) return [{ type: 'num', val: parseInt(ord[1], 10) }];
  if (DIGIT_RE.test(w)) return [{ type: 'num', val: parseInt(w, 10) }];
  return [{ type: 'text', val: w }];
}

function tokenize(name, romanMap, hexMap, numericMap) {
  const lower = String(name).toLowerCase();
  const raw = lower.split(/([_\s-]+)/).filter(Boolean);
  const parts = raw.filter((_, i) => i % 2 === 0);
  const seps = raw.filter((_, i) => i % 2 === 1);

  if (parts.length === 1 && seps.length === 0) {
    return tokenizeConcat(parts[0], romanMap, hexMap, numericMap);
  }

  return parts.flatMap((w, i) => {
    const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
    const key = contextKey(context, i);

    // Roman check
    if (romanMap) {
      const vs = romanMap.get(key);
      if (vs && vs.has(w)) {
        return [{ type: 'num', val: romanToNumber(w), isRoman: true }, ...(i < seps.length ? [{ type: 'text', val: seps[i] }] : [])];
      }
    }

    // Hex check
    if (hexMap) {
      const vs = hexMap.get(key);
      if (vs && vs.has(w)) {
        return [{ type: 'num', val: parseInt(w, 16), isHex: true }, ...(i < seps.length ? [{ type: 'text', val: seps[i] }] : [])];
      }
    }

    // Numeric inverted check
    if (numericMap && DIGIT_RE.test(w)) {
      const vs = numericMap.get(key);
      if (!(vs && vs.has(w))) return [{ type: 'text', val: w }, ...(i < seps.length ? [{ type: 'text', val: seps[i] }] : [])];
    }

    const wordTokens = tokenizeWord(w);
    return [...wordTokens, ...(i < seps.length ? [{ type: 'text', val: seps[i] }] : [])];
  });
}

// --- Compare ---

export function createNaturalCompare(items) {
  const { romanMap, hexMap, numericMap } = detectAllSeries(items);
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

  const compare = (a, b) => {
    const pA = prepare(a);
    const pB = prepare(b);

    // All-numeric fast path (plain digits only, no Roman/hex)
    const aAllNum = pA.tokens.every(t => t.type === 'num');
    const bAllNum = pB.tokens.every(t => t.type === 'num');
    if (aAllNum && bAllNum) {
      const aT = pA.tokens, bT = pB.tokens;
      if (!aT.some(t => t.isRoman) && !bT.some(t => t.isRoman) &&
          !aT.some(t => t.isHex) && !bT.some(t => t.isHex)) {
        const aStr = aT.map(t => String(t.val)).join('').replace(/^0+/, '') || '0';
        const bStr = bT.map(t => String(t.val)).join('').replace(/^0+/, '') || '0';
        const lenDiff = aStr.length - bStr.length;
        if (lenDiff !== 0) return lenDiff;
        const strDiff = aStr.localeCompare(bStr);
        if (strDiff !== 0) return strDiff;
      }
    }

    // Compare text skeleton first
    const patDiff = pA.pattern.localeCompare(pB.pattern);
    if (patDiff !== 0) return patDiff;

    // Token-by-token
    const aT = pA.tokens, bT = pB.tokens;
    for (let i = 0; i < Math.max(aT.length, bT.length); i++) {
      if (aT[i] === undefined) return -1;
      if (bT[i] === undefined) return 1;
      if (aT[i].type === 'num' && bT[i].type === 'num') {
        const d = aT[i].val - bT[i].val;
        if (d !== 0) return d;
      } else if (aT[i].type === 'text' && bT[i].type === 'text') {
        const d = aT[i].val.localeCompare(bT[i].val);
        if (d !== 0) return d;
      } else {
        return aT[i].type === 'num' ? -1 : 1;
      }
    }
    return 0;
  };

  compare.getStem = (name) => {
    return prepare(name).tokens.filter(t => t.type === 'text').map(t => t.val).join('');
  };

  return compare;
}

export function naturalCompare(a, b) {
  return createNaturalCompare([a, b])(a, b);
}

/**
 * Classic natural sort — splits strings by digit boundaries and compares
 * numerically where possible, lexicographically elsewhere.
 */
export function classicNaturalCompare(a, b) {
  const split = (s) => (String(s).toLowerCase().match(/\d+|\D+/g) || []);
  const aParts = split(a), bParts = split(b);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    if (aParts[i] === undefined) return -1;
    if (bParts[i] === undefined) return 1;
    if (/\d/.test(aParts[i]) && /\d/.test(bParts[i])) {
      const d = parseInt(aParts[i], 10) - parseInt(bParts[i], 10);
      if (d !== 0) return d;
    } else {
      const d = aParts[i].localeCompare(bParts[i]);
      if (d !== 0) return d;
    }
  }
  return 0;
}