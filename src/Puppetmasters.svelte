<script>
  import {
    getTopMasters,
    findPuppetmaster,
    tallyPuppets,
    listPuppets,
    isNationCurrent,
  } from "./sheetFetch.js";
  import { uncanonicalizeName, canonicalizeName } from "./settingsUtils.js";
  import { getQueryParam, setQueryParam } from "./dataUtils.js";
  import { onMount } from "svelte";
  import { settingsStore } from "./settingsStore.js";

  export let onSelectMaster;

  let masters = [];
  let searchQuery = "";
  let searchAny = false;
  let sortMode = "active";
  let globalMaxVal = 1;
  let initialized = false;

  onMount(() => {
    // Initialize from URL
    const q = getQueryParam("mq");
    const a = getQueryParam("ma");
    const s = getQueryParam("ms");

    if (q) searchQuery = q;
    if (a === "1") searchAny = true;
    if (s === "t") sortMode = "total";

    updateMasters();
    initialized = true;
  });

  $: if (initialized) {
    // Sync state to URL
    setQueryParam("mq", searchQuery || null);
    setQueryParam("ma", searchAny ? "1" : null);
    setQueryParam("ms", sortMode === "total" ? "t" : null);
  }

  $: normalizedQuery = canonicalizeName(searchQuery);

  $: filteredMasters = masters
    .map((m) => {
      if (!searchQuery || searchQuery.length < 3) {
        return m.name.toLowerCase().includes(normalizedQuery)
          ? { ...m, match: null }
          : null;
      }

      const masterMatches = m.name.toLowerCase().includes(normalizedQuery);
      if (masterMatches) return { ...m, match: null };

      if (searchAny) {
        const puppets = listPuppets(m.name);
        const puppetMatch = puppets.find((p) =>
          p.toLowerCase().includes(normalizedQuery),
        );
        if (puppetMatch) return { ...m, match: puppetMatch };
      }

      return null;
    })
    .filter((m) => m !== null)
    .sort((a, b) => {
      if (sortMode === "active")
        return b.activeCount - a.activeCount || b.count - a.count;
      return b.count - a.count || b.activeCount - a.activeCount;
    });

  $: hasAnyMatch = filteredMasters.some((m) => m.match !== null);

  $: {
    const vals = masters.map((m) =>
      sortMode === "active" ? m.activeCount : m.count,
    );
    globalMaxVal = Math.max(...vals, 1);
  }

  // Pre-sort counts for percentile calculation
  $: sortedCounts = masters
    .map((m) => (sortMode === "active" ? m.activeCount : m.count))
    .sort((a, b) => a - b);

  function getRarityColor(master) {
    if (sortedCounts.length === 0) return "bg-gray-400";
    if (!$settingsStore.showRarityBars) return "bg-blue-500 dark:bg-blue-600";

    const count = sortMode === "active" ? master.activeCount : master.count;
    const idx = sortedCounts.indexOf(count);
    const percentile = (idx / sortedCounts.length) * 100;

    if (percentile >= 99.9) {
      return $settingsStore.rainbowLegs ? "" : "bg-yellow-400";
    }
    if (percentile >= 98.5) {
      return $settingsStore.redEpics ? "bg-red-600" : "bg-orange-500";
    }
    if (percentile >= 95.5) return "bg-purple-500";
    if (percentile >= 88.0) return "bg-blue-500";
    if (percentile >= 65.0) return "bg-green-500";
    return "bg-gray-400 dark:bg-gray-500";
  }

  function getRarityStyle(master) {
    if (sortedCounts.length === 0 || !$settingsStore.showRarityBars) return "";
    const count = sortMode === "active" ? master.activeCount : master.count;
    const idx = sortedCounts.indexOf(count);
    const percentile = (idx / sortedCounts.length) * 100;

    if (percentile >= 99.9 && $settingsStore.rainbowLegs) {
      return "background: linear-gradient(90deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444); background-size: 200% 100%; animation: rainbow-move 3s linear infinite;";
    }
    return "";
  }

  function updateMasters() {
    masters = getTopMasters(0);
  }

  function handleSelect(masterName) {
    onSelectMaster(masterName);
  }

  // Calculate log-scaled width
  function getLogWidth(master) {
    const count = sortMode === "active" ? master.activeCount : master.count;
    if (count <= 0) return 0;
    if (count <= 1) return 5;
    const val = (Math.log10(count) / Math.log10(globalMaxVal)) * 100;
    return Math.max(5, val);
  }
</script>

<style>
  @keyframes rainbow-move {
    0% { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  }
</style>

<div class="space-y-6 pt-4 pb-20">
  <!-- Top Command Bar -->
  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
    <!-- Search Bar -->
    <div class="flex items-center gap-2 flex-grow max-w-sm">
      <div class="relative flex-grow">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder={searchAny
            ? "Enter any nation name..."
            : "Filter puppetmasters list..."}
          class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 rounded-full px-4 py-2 focus:outline-none w-full text-left transition-colors shadow-sm text-base h-[42px]"
        />
      </div>
    </div>

    <!-- Mode & Sort Toggles -->
    <div class="flex flex-wrap items-center gap-4 shrink-0">
      <div
        class="toggle-track flex items-center gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-full h-[42px]"
      >
        <button
          on:click={() => (searchAny = false)}
          class="px-5 py-1.5 h-full rounded-full text-[11px] font-bold uppercase transition-all {!searchAny
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
        >
          Puppetmasters Only
        </button>
        <button
          on:click={() => (searchAny = true)}
          class="px-5 py-1.5 h-full rounded-full text-[11px] font-bold uppercase transition-all {searchAny
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
        >
          All Nations
        </button>
      </div>

      <div
        class="toggle-track flex items-center gap-1 p-1 bg-gray-200 dark:bg-gray-800 rounded-full h-[42px]"
      >
        <button
          on:click={() => (sortMode = "active")}
          class="px-5 py-1.5 h-full rounded-full text-[11px] font-bold uppercase transition-all {sortMode ===
          'active'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
        >
          Sort Active
        </button>
        <button
          on:click={() => (sortMode = "total")}
          class="px-5 py-1.5 h-full rounded-full text-[11px] font-bold uppercase transition-all {sortMode ===
          'total'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
        >
          Sort Total
        </button>
      </div>
    </div>
  </div>

  <!-- Cards Grid -->
  <div
    class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 pb-8"
  >
    {#each filteredMasters as master (master.name)}
      {@const active = isNationCurrent(master.name)}
      <button
        class="group p-4 rounded-xl transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 active:scale-[0.98] focus:outline-none text-left flex flex-col justify-center puppet-card {hasAnyMatch
          ? 'min-h-[115px]'
          : 'min-h-[95px]'}"
        on:click={() => handleSelect(master.name)}
      >
        <div class="text-lg font-bold truncate w-full mb-0.5">
          {#if !active}
            <span
              class="select-none text-red-600 dark:text-red-400 mr-1 font-normal"
              >&#xe000;</span
            >
          {/if}
          {uncanonicalizeName(master.name)}
        </div>

        <div class="w-full flex flex-col gap-1.5">
          <div
            class="text-[13px] font-medium uppercase text-gray-500 dark:text-gray-500 leading-none"
          >
            {#if master.activeCount !== master.count}
              {master.activeCount}/
            {/if}
            {master.count} puppets
          </div>

          <!-- Matching nation line (Omitted if no card in grid has a match) -->
          {#if hasAnyMatch}
            <div
              class="text-[13px] font-medium uppercase text-gray-500 dark:text-gray-500 truncate h-[13px] leading-[13px]"
            >
              {#if master.match}
                {uncanonicalizeName(master.match)}
              {/if}
            </div>
          {/if}

          <div
            class="w-full h-1.5 bg-gray-100 dark:bg-gray-950 rounded-full overflow-hidden shadow-inner mt-1"
          >
            <div
              class="h-full {getRarityColor(master)} transition-all duration-700"
              style="width: {getLogWidth(master)}%; {getRarityStyle(master)}"
            ></div>
          </div>
        </div>
      </button>
    {/each}
  </div>

  {#if filteredMasters.length === 0}
    <div class="text-center py-20 text-gray-400 font-sans text-xs italic">
      No puppetmasters found.
    </div>
  {/if}
</div>
