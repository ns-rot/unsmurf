<script>
  import { createEventDispatcher } from "svelte";
  import { settingsStore } from "./settingsStore.js";
  import LinkSelect from "./LinkSelect.svelte";
  import { fetchSheets } from "./sheetFetch.js";

  export let showConfig = false; // ✅ Prop to control visibility
  export let closeConfig; // ✅ Callback to close modal

  const dispatch = createEventDispatcher();

  function saveSettings() {
    dispatch("close"); // Notify parent to close modal
    closeConfig();
  }

  let clearing = false;
  let cleared = false;

  async function clearCache() {
    clearing = true;
    cleared = false;

    // Clear trade cache from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("unsmurf_cache_")) {
        localStorage.removeItem(key);
      }
    });

    try {
      // Force refresh sheet data
      await fetchSheets(true);
      cleared = true;
      setTimeout(() => {
        cleared = false;
      }, 3000);
    } catch (e) {
      console.error("Failed to clear cache:", e);
    } finally {
      clearing = false;
    }
  }
</script>

{#if showConfig}
  <div
    class="fixed inset-0 bg-gray-800 bg-opacity-50 dark:bg-black dark:bg-opacity-70 z-50 flex justify-center items-center backdrop-blur-sm transition-all"
  >
    <div
      class="settings-modal bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl p-6 max-w-2xl w-[90%] md:w-[60%] lg:w-[50%] relative max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700"
    >
      <h2
        class="text-2xl font-bold mb-4 pb-2 border-b border-gray-200 dark:border-gray-700"
      >
        Settings
      </h2>

      <!-- Section: Card Trades -->
      <div class="mb-10">
        <h3
          class="text-base font-bold text-gray-800 dark:text-gray-200 mb-4 ml-1 flex items-center gap-2"
        >
          <span class="w-1.5 h-6 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
          Card Trades
        </h3>
        <!-- Subheading: Grouping -->
        <p
          class="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 ml-4"
        >
          Grouping
        </p>
        <div
          class="space-y-2 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl mb-6"
        >
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="section"
              value="puppets"
              bind:group={$settingsStore.section}
              class="w-4 h-4 accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Group records by known puppets</span
            >
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="section"
              value="similar-name"
              bind:group={$settingsStore.section}
              class="w-4 h-4 accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Group records by similar name</span
            >
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="section"
              value="none"
              bind:group={$settingsStore.section}
              class="w-4 h-4 accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Do not group records</span
            >
          </label>
        </div>

        <!-- Subheading: Preferences -->
        <p
          class="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 ml-4"
        >
          Preferences
        </p>
        <div class="space-y-3 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.showPuppetmasters}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Append puppetmasters in detailed records</span
            >
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.showCTE}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Mark CTE nations</span
            >
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.showRelativeDate}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Show relative date by default</span
            >
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.showSource}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Show puppet identification source</span
            >
          </label>
        </div>
      </div>

      <!-- Section: Puppetmasters -->
      <div class="mb-10">
        <h3
          class="text-base font-bold text-gray-800 dark:text-gray-200 mb-4 ml-1 flex items-center gap-2"
        >
          <span class="w-1.5 h-6 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
          Puppetmasters
        </h3>
        <div class="space-y-3 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.showRarityBars}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Coloured puppet count bars</span
            >
          </label>
        </div>
      </div>

      <!-- Section: Visual Style -->
      <!-- Section: Visual Style -->
      <div class="mb-10">
        <h3
          class="text-base font-bold text-gray-800 dark:text-gray-200 mb-4 ml-1 flex items-center gap-2"
        >
          <span class="w-1.5 h-6 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
          Visual Style
        </h3>
        <div class="space-y-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
          <!-- Theme Tri-State Pill Toggle -->
          <div>
            <p
              class="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 ml-1"
            >
              Theme
            </p>
            <div
              class="flex items-center gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-full w-full"
            >
              {#each ["light", "system", "dark"] as option}
                <button
                  on:click={() =>
                    settingsStore.update((s) => ({ ...s, theme: option }))}
                  class="flex-1 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all {$settingsStore.theme ===
                  option
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
                >
                  {option === "light"
                    ? "Light"
                    : option === "system"
                      ? "System"
                      : "Dark"}
                </button>
              {/each}
            </div>
          </div>

          <!-- Midnight Mode (only relevant when dark is active) -->
          {#if $settingsStore.theme === "dark" || $settingsStore.theme === "system"}
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                bind:checked={$settingsStore.midnightMode}
                class="w-4 h-4 rounded accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
              />
              <span class="text-gray-700 dark:text-gray-200"
                >Midnight (OLED) mode</span
              >
            </label>
          {/if}

          <!-- Rarity Colours -->
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.redEpics}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium">Red epics</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.rainbowLegs}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Rainbow legendaries</span
            >
          </label>
        </div>
      </div>

      <!-- Section: Link Behavior -->
      <div class="mb-10">
        <h3
          class="text-base font-bold text-gray-800 dark:text-gray-200 mb-4 ml-1 flex items-center gap-2"
        >
          <span class="w-1.5 h-6 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
          Link Behavior
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <!-- Tally Section -->
          <div
            class="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl"
          >
            <h4
              class="font-bold text-xs uppercase text-gray-400 mb-3 border-b border-gray-200 dark:border-gray-600 pb-1"
            >
              Tally Tables
            </h4>
            <div class="space-y-3">
              <LinkSelect
                id="tally-sent"
                label="Sent / Sold"
                bind:value={$settingsStore.linkTypeTallySent}
              />
              <LinkSelect
                id="tally-received"
                label="Received / Purchased"
                bind:value={$settingsStore.linkTypeTallyReceived}
              />
            </div>
          </div>

          <!-- Detailed Section -->
          <div
            class="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl"
          >
            <h4
              class="font-bold text-xs uppercase text-gray-400 mb-3 border-b border-gray-200 dark:border-gray-600 pb-1"
            >
              Detailed Tables
            </h4>
            <div class="space-y-3">
              <LinkSelect
                id="detailed-sent"
                label="Sent / Sold"
                bind:value={$settingsStore.linkTypeDetailedSent}
              />
              <LinkSelect
                id="detailed-received"
                label="Received / Purchased"
                bind:value={$settingsStore.linkTypeDetailedReceived}
              />
            </div>
          </div>

          <!-- Puppet Popup Section -->
          <div
            class="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl"
          >
            <h4
              class="font-bold text-xs uppercase text-gray-400 mb-3 border-b border-gray-200 dark:border-gray-600 pb-1"
            >
              Puppet Popup
            </h4>
            <LinkSelect
              id="puppet-popup"
              label="Puppet Link"
              bind:value={$settingsStore.linkTypePuppet}
            />
          </div>
        </div>

        <div class="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl space-y-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.enableCTELink}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-gray-300 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300"
            />
            <span class="font-medium text-gray-700 dark:text-gray-200"
              >Override for CTE Nations</span
            >
          </label>

          {#if $settingsStore.enableCTELink}
            <div class="pl-7 border-l-2 border-gray-400/30 dark:border-gray-500/30">
              <LinkSelect
                id="cte-link"
                label="CTE Link Type"
                bind:value={$settingsStore.linkTypeCTE}
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                Applies to all links for nations that have Ceased To Exist.
              </p>
            </div>
          {/if}

          <!-- Custom URL Input -->
          {#if $settingsStore.linkTypeTallySent === "custom" || $settingsStore.linkTypeTallyReceived === "custom" || $settingsStore.linkTypeDetailedSent === "custom" || $settingsStore.linkTypeDetailedReceived === "custom" || $settingsStore.linkTypePuppet === "custom" || ($settingsStore.enableCTELink && $settingsStore.linkTypeCTE === "custom")}
            <div class="pt-2">
              <label
                for="custom-url-template"
                class="block text-xs font-bold uppercase text-gray-400 mb-1"
              >
                Custom URL Template
              </label>
              <input
                id="custom-url-template"
                type="text"
                bind:value={$settingsStore.customLinkTemplate}
                placeholder="https://example.com/?nation={'{nation}'}"
                class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-full px-4 py-2 w-full text-sm focus:ring-2 focus:ring-gray-500 outline-none transition-all"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Use <code>{"{nation}"}</code> as a placeholder for the nation name.
              </p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Section: Data Management -->
      <div class="mb-6">
        <h3
          class="text-base font-bold text-gray-800 dark:text-gray-200 mb-4 ml-1 flex items-center gap-2"
        >
          <span class="w-1.5 h-6 bg-red-500 rounded-full"></span>
          Data Management
        </h3>
        <div
          class="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800/30"
        >
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Clear cached trade data and force a fresh sync of puppet mappings
            from the source.
          </p>
          <div class="flex justify-end">
            <button
              on:click={clearCache}
              disabled={clearing}
              class="flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-red-300 dark:border-red-700/50 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white transition-all disabled:opacity-50 font-bold"
            >
              {#if clearing}
                Clearing...
              {:else if cleared}
                Cache Cleared
              {:else}
                Clear All Cached Data
              {/if}
            </button>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div
        class="flex justify-end mt-8 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <button
          on:click={saveSettings}
          class="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 font-bold py-3 px-8 rounded-full hover:bg-gray-900 dark:hover:bg-gray-100 focus:ring-4 focus:ring-gray-400 dark:focus:ring-gray-500 transition-all shadow-lg active:scale-95"
        >
          Confirm Changes
        </button>
      </div>
    </div>
  </div>
{/if}
