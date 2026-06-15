import { get, writable } from 'svelte/store';

const defaultSettings = {
  section: "puppets",
  showPuppetmasters: true,
  showCTE: true,
  showRelativeDate: false,
  redEpics: true,
  rainbowLegs: true,
  linkTypeTallySent: "unsmurf",
  linkTypeTallyReceived: "unsmurf",
  linkTypeDetailedSent: "buys",
  linkTypeDetailedReceived: "sells",
  linkTypePuppet: "nation",
  linkTypeCTE: "boneyard",
  enableCTELink: true,
  customLinkTemplate: "https://www.nationstates.net/nation={nation}",
  theme: "system", // 'light' | 'system' | 'dark'
  midnightMode: false,
  showRarityBars: false,
  showSource: false,
  useNaturalSort: true,
};

const validOptions = {
  section: ["puppets", "similar-name", "none"],
  theme: ["light", "system", "dark"],
  linkTypeTallySent: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"],
  linkTypeTallyReceived: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"],
  linkTypeDetailedSent: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"],
  linkTypeDetailedReceived: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"],
  linkTypePuppet: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"],
  linkTypeCTE: ["nation", "trades", "buys", "sells", "unsmurf", "boneyard", "custom"],
};

function repairSettings(stored) {
  if (!stored || typeof stored !== "object") return { ...defaultSettings };

  const repaired = { ...defaultSettings };

  for (const key of Object.keys(defaultSettings)) {
    if (Object.prototype.hasOwnProperty.call(stored, key)) {
      const value = stored[key];

      // Type check
      if (typeof value !== typeof defaultSettings[key]) {
        continue;
      }

      // Enum check
      if (validOptions[key] && !validOptions[key].includes(value)) {
        continue;
      }

      repaired[key] = value;
    }
  }

  return repaired;
}

let plainSettings = { ...defaultSettings };
try {
  const stored = JSON.parse(localStorage.getItem("unsmurfSettings"));
  // Migrate legacy darkMode boolean to new theme tri-state
  if (stored && typeof stored.darkMode === 'boolean' && !stored.theme) {
    stored.theme = stored.darkMode ? 'dark' : 'light';
    delete stored.darkMode;
  }
  plainSettings = repairSettings(stored);
} catch (e) {
  console.warn("Failed to parse settings, using defaults", e);
}

// Ensure dataFetched is always false on initialization (runtime state)
plainSettings.dataFetched = false;

export const settingsStore = writable(plainSettings);

settingsStore.subscribe((value) => {
  try {
    // Exclude runtime state from persistence
    const { dataFetched, ...settingsToSave } = value;
    localStorage.setItem("unsmurfSettings", JSON.stringify(settingsToSave));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
});

export function useSettings() {
  const settings = get(settingsStore); // Retrieve the entire settings object
  return settings;    // Return the specific property
}