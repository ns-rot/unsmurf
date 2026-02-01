<script>
  export let nationId;
  export let openConfig;
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

  function toggleDarkMode() {
    settingsStore.update((s) => ({ ...s, darkMode: !s.darkMode }));
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
        class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full focus:outline-none transition shadow-md shrink-0"
      >
        Lookup
      </button>
    </div>

    <!-- Right: Action Buttons -->
    <div class="flex shrink-0 items-center justify-end gap-2 ml-auto">
      <button
        on:click={toggleDarkMode}
        class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 p-2 w-10 h-10 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none transition shadow-md flex items-center justify-center"
        aria-label="Toggle Dark Mode"
      >
        {#if $settingsStore.darkMode}
          <!-- Sun Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5 text-yellow-500"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
            />
          </svg>
        {:else}
          <!-- Moon Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5 text-gray-700 dark:text-gray-200"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21.752 15.002A9.75 9.75 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.75 9.75 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.75 9.75 0 0 0 9.002-5.998Z"
            />
          </svg>
        {/if}
      </button>
      <button
        on:click={openConfig}
        aria-label="Config"
        class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 p-2 w-10 h-10 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none transition shadow-md flex items-center justify-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-5 h-5 text-gray-700 dark:text-gray-200"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
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
