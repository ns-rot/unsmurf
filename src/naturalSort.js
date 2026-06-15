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
  return JSON.stringify(contextParts) + '|' + index;
}

// --- Two-pass context map builder ---

/**
 * Build a Map of contextKey → Set{rawToken} for tokens matching a numeric type.
 *
 * First pass: find "confirmed" series (same context+position with >=2 distinct numeric values).
 * Second pass: at confirmed positions, add any token from any item that would fit the type.
 *
 * @param {string[]} items - all names being sorted
 * @param {object} opts
 * @param {(w:string)=>boolean} opts.matches    - first-pass filter (stringent)
 * @param {(w:string)=>boolean} opts.catches    - second-pass filter (permissive)
 * @param {(w:string)=>number}  opts.toValue    - convert token to its numeric value
 * @param {(w:string, key:string)=>boolean} [opts.stemCheck] - optional, for concat names
 */
function detectSeries(items, opts) {
  const { matches, catches, toValue, matchConcat, catchConcat } = opts;
  const seriesMap = new Map();

  // --- First pass: find confirmed series ---
  for (const item of items) {
    const s = String(item).toLowerCase();
    const parts = s.split(SEP).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const w = parts[i];
      if (!matches(w)) continue;
      const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
      if (alphaChars(context) < 3) continue;
      const key = contextKey(context, i);
      if (!seriesMap.has(key)) seriesMap.set(key, new Map());
      const valMap = seriesMap.get(key);
      const val = toValue(w);
      if (!valMap.has(val)) valMap.set(val, new Set());
      valMap.get(val).add(w);
    }
    // Concat names
    if (matchConcat && parts.length === 1) {
      const r = matchConcat(s);
      if (r) {
        if (alphaChars([r.stem]) < 3) continue;
        const key = contextKey([r.stem], 1);
        if (!seriesMap.has(key)) seriesMap.set(key, new Map());
        const valMap = seriesMap.get(key);
        const val = toValue(r.suffix);
        if (!valMap.has(val)) valMap.set(val, new Set());
        valMap.get(val).add(r.suffix);
      }
    }
  }

  // Keep only groups with >=2 distinct numeric values
  const result = new Map();
  for (const [key, valMap] of seriesMap) {
    if (valMap.size >= 2) {
      const tokens = new Set();
      for (const ts of valMap.values()) for (const t of ts) tokens.add(t);
      result.set(key, tokens);
    }
  }

  // --- Second pass: add permissive matches at confirmed positions ---
  for (const item of items) {
    const s = String(item).toLowerCase();
    const parts = s.split(SEP).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const w = parts[i];
      if (!catches(w)) continue;
      const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
      if (alphaChars(context) < 3) continue;
      const key = contextKey(context, i);
      if (result.has(key)) result.get(key).add(w);
    }
    // Concat names (second pass)
    if (catchConcat && parts.length === 1) {
      const r = catchConcat(s);
      if (r) {
        if (alphaChars([r.stem]) < 3) continue;
        const key = contextKey([r.stem], 1);
        if (result.has(key)) result.get(key).add(r.suffix);
      }
    }
  }

  return result;
}

// --- Detection configs ---

const romanOpts = {
  matches:  (w) => w.length >= 2 && isValidRoman(w),
  catches:  (w) => ROMAN_WORD_RE.test(w),
  toValue:  (w) => romanToNumber(w),
  matchConcat: (s) => { const m = s.match(/^([a-z]+)([ivxlcdm]{2,})$/); return m && isValidRoman(m[2]) ? { stem: m[1], suffix: m[2] } : null; },
  catchConcat: (s) => { const m = s.match(CONCAT_ROMAN_RE); return m ? { stem: m[1], suffix: m[2] } : null; },
};
const hexOpts = {
  matches:  (w) => w.length >= 2 && HEX_WORD_RE.test(w) && HEX_HAS_LETTER.test(w),
  catches:  (w) => (HEX_WORD_RE.test(w) && HEX_HAS_LETTER.test(w)) || DIGIT_RE.test(w),
  toValue:  (w) => parseInt(w, 16),
  matchConcat: (s) => { const m = s.match(/^([a-z]+)([0-9a-f]{2,})$/); return m && HEX_HAS_LETTER.test(m[2]) ? { stem: m[1], suffix: m[2] } : null; },
  catchConcat: (s) => {
    const dm = s.match(/^([a-z]+)(\d{2,})$/);
    if (dm) return { stem: dm[1], suffix: dm[2] };
    const hm = s.match(CONCAT_HEX_RE);
    if (hm && HEX_HAS_LETTER.test(hm[2])) return { stem: hm[1], suffix: hm[2] };
    return null;
  },
};
const numericOpts = {
  matches:  (w) => DIGIT_RE.test(w),
  catches:  (w) => DIGIT_RE.test(w),
  toValue:  (w) => parseInt(w, 10),
};

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
  const parts = lower.split(SEP).filter(Boolean);

  if (parts.length === 1 && !SEP.test(lower)) {
    return tokenizeConcat(parts[0], romanMap, hexMap, numericMap);
  }

  return parts.flatMap((w, i) => {
    const context = [...parts.slice(0, i), ...parts.slice(i + 1)];
    const key = contextKey(context, i);

    // Roman check
    if (romanMap) {
      const vs = romanMap.get(key);
      if (vs && vs.has(w)) {
        return [{ type: 'num', val: romanToNumber(w), isRoman: true }];
      }
    }

    // Hex check
    if (hexMap) {
      const vs = hexMap.get(key);
      if (vs && vs.has(w)) {
        return [{ type: 'num', val: parseInt(w, 16), isHex: true }];
      }
    }

    // Numeric inverted check
    if (numericMap && DIGIT_RE.test(w)) {
      const vs = numericMap.get(key);
      if (!(vs && vs.has(w))) return [{ type: 'text', val: w }];
    }

    return tokenizeWord(w);
  });
}

// --- Compare ---

export function createNaturalCompare(items) {
  const romanMap   = detectSeries(items, romanOpts);
  const hexMap     = detectSeries(items, hexOpts);
  const numericMap = detectSeries(items, numericOpts);
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