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

export const settingsStore = writable(storedSettings);

settingsStore.subscribe((value) => {
  try {
    localStorage.setItem("unsmurfSettings", JSON.stringify(value));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
});

export function useSettings() {
  const settings = get(settingsStore); // Retrieve the entire settings object
  return settings;    // Return the specific property
}