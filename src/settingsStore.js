import { get, writable } from 'svelte/store';

const defaultSettings = {
  section: "puppets",
  showPuppetmasters: true,
  showCTE: true,
  showRelativeDate: false,
  redEpics: true,
  rainbowLegs: true,
};

const storedSettings = JSON.parse(localStorage.getItem("unsmurfSettings")) || defaultSettings;
// Ensure dataFetched is always false on initialization (runtime state)
storedSettings.dataFetched = false;

export const settingsStore = writable(storedSettings);

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