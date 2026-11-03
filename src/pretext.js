// Shared pretext helpers for table measurement.
//
// Pretext handles live in a module-level cache, never in Svelte state: the
// handles are opaque objects with typed arrays inside, and putting them under
// Svelte's reactive proxies would be expensive and unsafe.
import {
  prepare,
  layout,
  measureNaturalWidth,
  clearCache as clearPretextEngineCache,
} from "@chenglou/pretext";

export const TABLE_FONT = '16px "Vend Sans", "UnsmurfIcons", sans-serif';
export const TABLE_FONT_SMALL = '13px "Vend Sans", "UnsmurfIcons", sans-serif';
export const TABLE_LINE_HEIGHT = 24;
export const TABLE_PAD_Y = 12; // td py-1.5: 6px top + 6px bottom
export const TABLE_BORDER = 1; // td border-b

const preparedCache = new Map();

function cacheKey(text, font) {
  return font + "\u0000" + text;
}

export function getPrepared(text, font = TABLE_FONT) {
  const value = text ?? "";
  const key = cacheKey(value, font);
  let prepared = preparedCache.get(key);
  if (prepared === undefined) {
    prepared = prepare(value, font);
    preparedCache.set(key, prepared);
  }
  return prepared;
}

export function lineCount(text, font, width, lineHeight = TABLE_LINE_HEIGHT) {
  const prepared = getPrepared(text, font);
  return layout(prepared, width, lineHeight).lineCount;
}

export function naturalWidth(text, font = TABLE_FONT) {
  return measureNaturalWidth(getPrepared(text, font));
}

export function clearPretextCache() {
  preparedCache.clear();
  clearPretextEngineCache();
}

/**
 * Make sure the table fonts are measured only after Vend Sans is available.
 * Firefox rejects `rem` font strings in pretext, so these are px on purpose.
 */
export async function loadTableFonts(sampleText = "Aa0") {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(TABLE_FONT, sampleText),
      document.fonts.load(TABLE_FONT_SMALL, sampleText),
      // The CTE marker is a private-use glyph from the icon font; load it
      // explicitly so canvas measurement does not use a fallback box.
      document.fonts.load(TABLE_FONT, "\uE000"),
      document.fonts.load(TABLE_FONT_SMALL, "\uE000"),
    ]);
    await document.fonts.ready;
  } catch {
    // Canvas measurement still works with the fallback font.
  }
}

let tableFontsPromise = null;

/** Share one font-loading promise across all tables on the page. */
export function ensureTableFonts(sampleText = "Aa0") {
  if (!tableFontsPromise) tableFontsPromise = loadTableFonts(sampleText);
  return tableFontsPromise;
}
