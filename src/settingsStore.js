import { get, writable } from 'svelte/store';
import { createVersionedStorage } from './storageUtils';

const SETTINGS_KEY = "unsmurfSettings";
const SETTINGS_VERSION = 1;

// Settings schema v1
const settingsSchema = {
  section:            { type: "enum", values: ["puppets", "similar-name", "none"], default: "puppets" },
  showPuppetmasters:  { type: "boolean", default: true },
  showCTE:            { type: "boolean", default: true },
  dateFormat:         { type: "enum", values: ["absolute", "relative"], default: "absolute" },
  redEpics:           { type: "boolean", default: true },
  rainbowLegs:        { type: "boolean", default: true },
  linkTypeTallySent:      { type: "enum", values: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"], default: "unsmurf" },
  linkTypeTallyReceived:  { type: "enum", values: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"], default: "unsmurf" },
  linkTypeDetailedSent:   { type: "enum", values: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"], default: "buys" },
  linkTypeDetailedReceived: { type: "enum", values: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"], default: "sells" },
  linkTypePuppet:     { type: "enum", values: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"], default: "nation" },
  linkTypeCTE:        { type: "enum", values: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"], default: "boneyard" },
  enableCTELink:      { type: "boolean", default: true },
  customLinkTemplate: { type: "string", default: "https://www.nationstates.net/nation={nation}" },
  customLinkLabel:    { type: "string", default: "Custom URL" },
  theme:              { type: "enum", values: ["light", "system", "dark"], default: "system" },
  midnightMode:       { type: "boolean", default: false },
  showRarityBars:     { type: "boolean", default: false },
  showSource:         { type: "boolean", default: false },
  sortMode:           { type: "enum", values: ["classic", "natural", "context"], default: "context" },
  enableRightClickPopup: { type: "boolean", default: true },
};

const defaultSettings = Object.fromEntries(
  Object.entries(settingsSchema).map(([k, v]) => [k, v.default])
);

const settingsMigrations = {
  1: (s) => {
    if (typeof s.darkMode === 'boolean' && !s.theme) {
      s.theme = s.darkMode ? 'dark' : 'light';
      delete s.darkMode;
    }
    if (typeof s.useNaturalSort === 'boolean') {
      s.sortMode = s.useNaturalSort ? 'context' : 'classic';
      delete s.useNaturalSort;
    }
    if (typeof s.showRelativeDate === 'boolean') {
      s.dateFormat = s.showRelativeDate ? 'relative' : 'absolute';
      delete s.showRelativeDate;
    }
    s.version = 1;
    return s;
  },
};

function repairSettings(stored) {
  const repaired = { ...defaultSettings };
  for (const [key, schema] of Object.entries(settingsSchema)) {
    if (!Object.prototype.hasOwnProperty.call(stored, key)) continue;
    const value = stored[key];
    if (schema.type === "boolean" && typeof value !== "boolean") continue;
    if (schema.type === "string" && typeof value !== "string") continue;
    if (schema.type === "enum" && !schema.values.includes(value)) continue;
    repaired[key] = value;
  }
  return repaired;
}

const settingsStorage = createVersionedStorage(SETTINGS_KEY, {
  defaults: defaultSettings,
  migrations: settingsMigrations,
  currentVersion: SETTINGS_VERSION,
  repair: repairSettings,
});

let plainSettings = settingsStorage.read();
plainSettings.dataFetched = false;

export const settingsStore = writable(plainSettings);

settingsStore.subscribe((value) => {
  try {
    const { dataFetched, ...settingsToSave } = value;
    settingsStorage.save(settingsToSave);
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
});

export function useSettings() {
  const settings = get(settingsStore);
  return settings;
}

export function resetSettings() {
  settingsStore.set({ ...defaultSettings, dataFetched: false });
}