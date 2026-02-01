<script>
  import { createEventDispatcher } from "svelte";
  import { settingsStore } from "./settingsStore.js";

  export let showConfig = false; // ✅ Prop to control visibility
  export let closeConfig; // ✅ Callback to close modal

  const dispatch = createEventDispatcher();

  function saveSettings() {
    dispatch("close"); // Notify parent to close modal
    closeConfig();
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

      <!-- Tally Record Options -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Tally Record Options
        </h3>
        <label class="flex items-center gap-2 mb-1 cursor-pointer">
          <input
            type="radio"
            name="section"
            value="puppets"
            bind:group={$settingsStore.section}
            class="text-blue-500 focus:ring-blue-500"
          />
          <span>Group records by known puppets</span>
        </label>
        <label class="flex items-center gap-2 mb-1 cursor-pointer">
          <input
            type="radio"
            name="section"
            value="similar-name"
            bind:group={$settingsStore.section}
            class="text-blue-500 focus:ring-blue-500"
          />
          <span>Group records by similar name</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="section"
            value="none"
            bind:group={$settingsStore.section}
            class="text-blue-500 focus:ring-blue-500"
          />
          <span>Do not group records</span>
        </label>
      </div>

      <!-- Nation Display Options -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Nation Display Options
        </h3>
        <label class="flex items-center gap-2 mb-1 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={$settingsStore.showPuppetmasters}
            class="rounded text-blue-500 focus:ring-blue-500"
          />
          <span>Append puppetmasters in detailed records</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={$settingsStore.showCTE}
            class="rounded text-blue-500 focus:ring-blue-500"
          />
          <span>Mark CTE nations</span>
        </label>
      </div>

      <!-- Date Options -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Date Options
        </h3>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={$settingsStore.showRelativeDate}
            class="rounded text-blue-500 focus:ring-blue-500"
          />
          <span>Show relative date by default</span>
        </label>
      </div>

      <!-- UI Options -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Colour Options
        </h3>
        <label class="flex items-center gap-2 mb-1 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={$settingsStore.redEpics}
            class="rounded text-blue-500 focus:ring-blue-500"
          />
          <span>Red epics</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={$settingsStore.rainbowLegs}
            class="rounded text-blue-500 focus:ring-blue-500"
          />
          <span>Rainbow legendaries</span>
        </label>
      </div>

      <!-- Link Options -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Link Options
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Tally Section -->
          <div class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
            <h4
              class="font-medium text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-600 pb-1"
            >
              Tally Tables
            </h4>

            <div class="mb-3">
              <label
                for="tally-sent"
                class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1"
                >Sent / Sold</label
              >
              <select
                id="tally-sent"
                bind:value={$settingsStore.linkTypeTallySent}
                class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-2 py-1.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>

            <div class="mb-1">
              <label
                for="tally-received"
                class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1"
                >Received / Purchased</label
              >
              <select
                id="tally-received"
                bind:value={$settingsStore.linkTypeTallyReceived}
                class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-2 py-1.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>
          </div>

          <!-- Detailed Section -->
          <div class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
            <h4
              class="font-medium text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-600 pb-1"
            >
              Detailed Tables
            </h4>

            <div class="mb-3">
              <label
                for="detailed-sent"
                class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1"
                >Sent / Sold</label
              >
              <select
                id="detailed-sent"
                bind:value={$settingsStore.linkTypeDetailedSent}
                class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-2 py-1.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>

            <div class="mb-1">
              <label
                for="detailed-received"
                class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1"
                >Received / Purchased</label
              >
              <select
                id="detailed-received"
                bind:value={$settingsStore.linkTypeDetailedReceived}
                class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-2 py-1.5 w-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>
          </div>
        </div>

        <div class="pt-4">
          <label class="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={$settingsStore.enableCTELink}
              class="rounded text-blue-500 focus:ring-blue-500"
            />
            <span class="font-medium">Override for CTE Nations</span>
          </label>

          {#if $settingsStore.enableCTELink}
            <div class="ml-6">
              <select
                bind:value={$settingsStore.linkTypeCTE}
                class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-2 py-1.5 w-full text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Applies to all links for nations that have Ceased To Exist.
              </p>
            </div>
          {/if}
        </div>

        <!-- Custom URL Input -->
        {#if $settingsStore.linkTypeTallySent === "custom" || $settingsStore.linkTypeTallyReceived === "custom" || $settingsStore.linkTypeDetailedSent === "custom" || $settingsStore.linkTypeDetailedReceived === "custom" || ($settingsStore.enableCTELink && $settingsStore.linkTypeCTE === "custom")}
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
            <label
              for="custom-url-template"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >Custom URL Template</label
            >
            <input
              id="custom-url-template"
              type="text"
              bind:value={$settingsStore.customLinkTemplate}
              placeholder="https://example.com/?nation={'{nation}'}"
              class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-3 py-2 w-full text-sm focus:border-blue-500 outline-none"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use <code>{"{nation}"}</code> as a placeholder for the nation name.
            </p>
          </div>
        {/if}
      </div>

      <!-- Buttons -->
      <div
        class="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <button
          on:click={saveSettings}
          class="bg-blue-500 text-white font-bold py-2.5 px-6 rounded-full hover:bg-blue-600 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900 transition shadow-lg"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}
