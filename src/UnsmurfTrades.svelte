<script>
  export let nationId;
  export let loadTradeData;
  import { canonicalizeName } from "./settingsUtils.js";
  import NationAlert from "./NationAlert.svelte";
  import { settingsStore } from "./settingsStore.js";

  function lookupNation() {
    if (!nationId.trim()) {
      alert("Please enter a nation name.");
      return;
    }

    loadTradeData();
  }

  export function handleEnter(e) {
    if (e.key === "Enter") {
      lookupNation();
    }
  }
</script>

<div class="relative mb-4 w-full">
  <div class="flex flex-wrap items-center gap-4 mt-4 w-full pl-1 sm:px-0">
    <!-- Left: Input & Lookup -->
    <div class="flex items-center justify-start gap-2 w-full sm:w-auto">
      <input
        type="text"
        bind:value={nationId}
        on:keydown={handleEnter}
        placeholder="Testlandia"
        class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 rounded-full px-4 py-2 focus:outline-none w-full sm:w-64 flex-1 min-w-0 text-left transition-colors shadow-sm"
      />
      <button
        on:click={lookupNation}
        class="bg-gray-800 hover:bg-gray-900 dark:bg-gray-200 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold py-2 px-6 rounded-full focus:outline-none transition shadow-md shrink-0"
      >
        Lookup
      </button>
    </div>
  </div>

  <!-- Nation Alert Row -->
  <div class="flex justify-start w-full mt-4">
    {#if nationId.trim().length > 2}
      <NationAlert {nationId} />
    {/if}
  </div>
</div>
