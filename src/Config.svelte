<script>
  import { createEventDispatcher, onMount, tick } from "svelte";
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
  let settingsScrollContainer;
  let observedSettingsScrollContainer;
  let settingsResizeObserver;
  let hasSettingsContentBelow = false;

  function updateSettingsScrollIndicator() {
    if (!settingsScrollContainer) {
      hasSettingsContentBelow = false;
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = settingsScrollContainer;
    hasSettingsContentBelow = scrollTop + clientHeight < scrollHeight - 2;
  }

  $: if (showConfig && $settingsStore) {
    tick().then(updateSettingsScrollIndicator);
  }

  $: if (settingsResizeObserver && settingsScrollContainer !== observedSettingsScrollContainer) {
    if (observedSettingsScrollContainer) {
      settingsResizeObserver.unobserve(observedSettingsScrollContainer);
    }

    if (settingsScrollContainer) {
      settingsResizeObserver.observe(settingsScrollContainer);
    }

    observedSettingsScrollContainer = settingsScrollContainer;
  }

  onMount(() => {
    const handleResize = () => updateSettingsScrollIndicator();

    window.addEventListener("resize", handleResize);

    if (typeof ResizeObserver !== "undefined") {
      settingsResizeObserver = new ResizeObserver(updateSettingsScrollIndicator);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      settingsResizeObserver?.disconnect();
    };
  });

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
      <div class="w-full max-w-2xl flex flex-col items-center gap-2 px-4 sm:px-0">
      <div
        class="settings-modal w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl relative max-h-[80dvh] flex flex-col overflow-clip border border-gray-200 dark:border-gray-700"
      >
      <div
        bind:this={settingsScrollContainer}
        on:scroll={updateSettingsScrollIndicator}
        class="flex-1 overflow-y-auto min-h-0"
      >
      <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Settings
        </h2>
      </div>

      <div class="px-5 py-4">
          <!-- Section: Card Trades -->
      <div class="mb-10 break-inside-avoid">
        <h3
          class="text-base font-bold text-gray-800 dark:text-gray-200 mb-4 ml-1 flex items-center gap-2"
        >
          <span class="w-1.5 h-6 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
          Card Trades
        </h3>
        <div class="space-y-3 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
          <div class="flex flex-col gap-1.5">
          <p
            class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1"
          >
            Group tally table nations
          </p>
        <div
          class="toggle-track flex items-center gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-full w-full"
        >
          {#each ["puppets", "similar-name", "none"] as option}
            <button
              on:click={() =>
                settingsStore.update((s) => ({ ...s, section: option }))}
              class="flex-1 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all {$settingsStore.section ===
              option
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
            >
              {option === "puppets"
                ? "Puppets"
                : option === "similar-name"
                  ? "Similar Name"
                  : "None"}
            </button>
          {/each}
        </div>
        </div>
          <div class="flex flex-col gap-1.5">
            <p
              class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1"
            >
              Default date display
            </p>
            <div
              class="toggle-track flex items-center gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-full w-full"
            >
              {#each ["absolute", "relative"] as option}
                <button
                  on:click={() =>
                    settingsStore.update((s) => ({ ...s, dateFormat: option }))}
                  class="flex-1 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all {$settingsStore.dateFormat ===
                  option
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
                >
                  {option === "absolute" ? "Absolute" : "Relative"}
                </button>
              {/each}
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <p
              class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1"
            >
              Name sorting
            </p>
            <div
              class="toggle-track flex items-center gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-full w-full"
            >
              {#each ["classic", "natural", "context"] as option}
                <button
                  on:click={() =>
                    settingsStore.update((s) => ({ ...s, sortMode: option }))}
                  class="flex-1 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all {$settingsStore.sortMode ===
                  option
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
                >
                  {option === "classic"
                    ? "Classic"
                    : option === "natural"
                      ? "Natural"
                      : "Contextual"}
                </button>
              {/each}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 italic">
              {$settingsStore.sortMode === "classic"
                ? "Standard alphabetic sort"
                : $settingsStore.sortMode === "natural"
                  ? "Digit-aware natural sorting (Puppet 2 before Puppet 10)"
                  : "More advanced sorting that also handles Roman, hex and ordinal numbers"}
            </p>
          </div>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.showPuppetmasters}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-indigo-400 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300 shrink-0"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Append puppetmasters in detailed records</span
            >
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.showCTE}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-indigo-400 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300 shrink-0"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Mark CTE nations</span
            >
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.showSource}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-indigo-400 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300 shrink-0"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Show puppet identification source</span
            >
          </label>
        </div>
      </div>

      <!-- Section: Puppetmasters -->
      <div class="mb-10 break-inside-avoid">
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
              class="w-4 h-4 rounded accent-gray-600 dark:accent-indigo-400 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300 shrink-0"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Coloured puppet count bars</span
            >
          </label>
        </div>
      </div>

      <!-- Section: Visual Style -->
      <!-- Section: Visual Style -->
      <div class="mb-10 break-inside-avoid">
        <h3
          class="text-base font-bold text-gray-800 dark:text-gray-200 mb-4 ml-1 flex items-center gap-2"
        >
          <span class="w-1.5 h-6 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
          Visual Style
        </h3>
        <div class="space-y-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
          <!-- Theme Tri-State Pill Toggle -->
          <div class="flex flex-col gap-1.5">
            <p
              class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1"
            >
              Theme
            </p>
            <div
              class="toggle-track flex items-center gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-full w-full"
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
                class="w-4 h-4 rounded accent-gray-600 dark:accent-indigo-400 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300 shrink-0"
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
              class="w-4 h-4 rounded accent-gray-600 dark:accent-indigo-400 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300 shrink-0"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium">Red epics</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.rainbowLegs}
              class="w-4 h-4 rounded accent-gray-600 dark:accent-indigo-400 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300 shrink-0"
            />
            <span class="text-gray-700 dark:text-gray-200 font-medium"
              >Rainbow legendaries</span
            >
          </label>
        </div>
      </div>

      <!-- Section: Link Behavior -->
      <div class="mb-10 break-inside-avoid">
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
              class="w-4 h-4 rounded accent-gray-600 dark:accent-indigo-400 focus:ring-gray-500 bg-white dark:bg-gray-800 border-2 border-gray-500 dark:border-gray-300 shrink-0"
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
            <div class="pt-2 space-y-3">
              <div>
                <label
                  for="custom-url-label"
                  class="block text-xs font-bold uppercase text-gray-400 mb-1"
                >
                  Custom URL Label
                </label>
                <input
                  id="custom-url-label"
                  type="text"
                  bind:value={$settingsStore.customLinkLabel}
                  placeholder="Custom URL"
                  class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-full px-4 py-2 w-full text-sm focus:ring-2 focus:ring-gray-500 outline-none transition-all"
                />
              </div>
              <div>
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
            </div>
          {/if}
        </div>
      </div>

      <!-- Section: Data Management -->
      <div class="mb-3 break-inside-avoid">
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
      </div>
      </div>

      <div
        aria-hidden="true"
        class="settings-scroll-fade pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-2xl bg-gradient-to-t from-white via-white/80 to-transparent transition-opacity duration-200 ease-out dark:from-gray-800 dark:via-gray-800/80 {hasSettingsContentBelow ? 'opacity-100' : 'opacity-0'}"
      ></div>
    </div>

      <button
        on:click={saveSettings}
        class="self-end bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 font-bold py-3 px-8 rounded-full hover:bg-gray-900 dark:hover:bg-gray-100 focus:ring-4 focus:ring-gray-400 dark:focus:ring-gray-500 transition-all shadow-xl active:scale-95"
      >
        Confirm Changes
      </button>
    </div>
  </div>
{/if}
