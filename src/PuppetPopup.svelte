<script>
  import { isNationCurrent, countActivePuppets } from "./sheetFetch.js";
  import { canonicalizeName } from "./settingsUtils.js";
  import { getNationLink } from "./dataUtils.js";

  // Props
  export let nationName = "";
  export let puppetCount = 0;
  export let puppetList = [];
  export let onClose = () => {};

  // Sort state: 0 = Alphabetical, 1 = Active First, 2 = CTE First
  let sortMode = 0;

  function toggleSort() {
    sortMode = (sortMode + 1) % 3;
  }

  // Sort puppets
  $: sortedPuppetList = [...puppetList].sort((a, b) => {
    if (sortMode === 1) {
      // Active First
      const aActive = isNationCurrent(a);
      const bActive = isNationCurrent(b);
      if (aActive !== bActive) {
        return aActive ? -1 : 1;
      }
    } else if (sortMode === 2) {
      // CTE First
      const aActive = isNationCurrent(a);
      const bActive = isNationCurrent(b);
      if (aActive !== bActive) {
        return aActive ? 1 : -1;
      }
    }
    // Default / Tie-breaker: Alphabetical
    return a.localeCompare(b);
  });

  // Count active (non-CTE) puppets
  $: activePuppetCount = countActivePuppets(puppetList);

  function getSortTitle(mode) {
    if (mode === 1) return "Sorting by Status (Active First)";
    if (mode === 2) return "Sorting by Status (CTE First)";
    return "Sorting Alphabetically";
  }
</script>

<!-- Overlay that covers the entire screen -->
<div
  class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm transition-all"
>
  <!-- Popup container -->
  <div
    class="puppet-modal h-3/4 w-[95%] sm:w-3/4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
  >
    <!-- Header with title and close button -->
    <div
      class="flex justify-between items-center px-3 py-4 sm:p-4 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex flex-col">
        <h2 class="text-xl font-semibold font-inter">
          {nationName}
        </h2>
        <h3 class="text-gray-600 dark:text-gray-400">
          {#if puppetCount !== activePuppetCount}{activePuppetCount}
            active,
          {/if}
          {puppetCount} known puppets
        </h3>
      </div>

      <div class="flex items-center space-x-2">
        <button
          on:click={toggleSort}
          class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none font-inter"
          title={getSortTitle(sortMode)}
        >
          {#if sortMode === 1}
            <!-- Active First -->
            <span>&#xe000;</span>
          {:else if sortMode === 2}
            <!-- CTE First -->
            <span class="text-red-600 dark:text-red-400">&#xe000;</span>
          {:else}
            <!-- Alphabetical -->
            <span class="text-xs font-bold">A-Z</span>
          {/if}
        </button>

        <button
          on:click={onClose}
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
          aria-label="Close popup"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Content area with scrollable flex container -->
    <div class="flex-grow px-3 py-4 sm:p-4 overflow-auto">
      <div class="flex flex-wrap rounded-lg">
        {#each sortedPuppetList as puppet}
          <div
            class="w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6 pb-2 pr-2 text-left transition-colors whitespace-normal break-words overflow-hidden"
          >
            <span class="block w-full">
              {#if !isNationCurrent(canonicalizeName(puppet))}
                <span
                  class="font-inter select-none text-red-600 dark:text-red-400"
                  >&#xe000;&#x2009;</span
                >
              {/if}
              <a
                href={getNationLink(
                  puppet.replace(/cte/i, "").trim(),
                  "puppetPopup",
                )}
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-900 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-400 no-underline"
              >
                {puppet}
              </a>
            </span>
          </div>
        {/each}
      </div>

      <!-- Disclaimer at bottom of list -->
      <div
        class="mt-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2"
      >
        <p>
          This list may be incomplete. Data is sourced from community sheets.
        </p>
        <p>
          Contribute to <a
            href="https://docs.google.com/spreadsheets/d/1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4/edit?gid=733627866#gid=733627866"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-gray-800 dark:hover:text-gray-200"
            >9003's sheet</a
          >
          through
          <a
            href="https://docs.google.com/forms/d/16t4mlYuSU5p0U9hVkvzKMqP1GRnpdDV7nLNLA9WdFTs/viewform?chromeless=1&edit_requested=trues"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-gray-800 dark:hover:text-gray-200"
            >this form</a
          >, or to
          <a
            href="https://docs.google.com/spreadsheets/d/1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-gray-800 dark:hover:text-gray-200"
            >Rot's sheet</a
          > by contacting @rotenaple on Discord.
        </p>
        <p>For any inaccuracies, please contact the respective sheet owner.</p>
      </div>
    </div>
  </div>
</div>
