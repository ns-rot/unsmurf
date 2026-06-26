<script>
  import { listPuppets, isNationCurrent, countActivePuppets } from './sheetFetch.js';
  import { uncanonicalizeName, canonicalizeName, createNaturalCompare, classicNaturalCompare } from './settingsUtils.js';
  import { settingsStore } from './settingsStore.js';
  import { getNationLink } from './dataUtils.js';

  export let masterName = "";
  export let onBack;

  let puppets = [];
  let searchQuery = "";
  let activeOnly = false;

  $: puppets = listPuppets(masterName);
  $: activeCount = countActivePuppets(puppets);

  $: filteredBase = puppets
    .filter(p => p.toLowerCase().includes(searchQuery.toLowerCase().replace(/\s+/g, '_')))
    .filter(p => !activeOnly || isNationCurrent(p));

  $: filteredPuppets = (() => {
    const mode = $settingsStore.sortMode;
    if (mode === 'context') return [...filteredBase].sort(createNaturalCompare(filteredBase));
    if (mode === 'natural') return [...filteredBase].sort(classicNaturalCompare);
    return [...filteredBase].sort((a, b) => a.localeCompare(b));
  })();
</script>

<div class="space-y-6">
  <!-- Small Header (similar to app's subheaders) -->
  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
    <div class="space-y-2">
      <button 
        on:click={onBack} 
        class="text-gray-600 dark:text-gray-400 hover:underline font-bold text-xs uppercase tracking-widest flex items-center transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Masters
      </button>
      <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
        {uncanonicalizeName(masterName)}
      </h2>
      <div class="text-gray-600 dark:text-gray-400 font-sans text-sm">
        {#if puppets.length !== activeCount}
          {activeCount} active,
        {/if}
        {puppets.length} known puppets
      </div>
    </div>

    <!-- Filters (pill-style) -->
    <div class="flex flex-col sm:flex-row gap-2">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Filter puppets..."
        class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 rounded-full px-4 py-1.5 focus:outline-none w-full sm:w-64 text-sm shadow-sm"
      />
      <label class="flex items-center gap-2 px-4 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition shadow-sm shrink-0">
        <input type="checkbox" bind:checked={activeOnly} class="rounded border-2 border-gray-500 dark:border-gray-300 shrink-0 accent-gray-600 dark:accent-indigo-400 focus:ring-gray-500 bg-gray-100" />
        <span class="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-tight">Active Only</span>
      </label>
    </div>
  </div>

  <!-- Reusing the flex-wrap list layout from PuppetPopup -->
  <div class="w-full flex flex-wrap pb-20">
    {#each filteredPuppets as puppet (puppet)}
      {@const active = isNationCurrent(puppet)}
      <div class="w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6 py-1 text-left whitespace-normal break-words overflow-hidden flex items-start pr-2">
        <span class="block w-full leading-tight text-sm font-sans">
          {#if !active}
            <span class="select-none text-red-600 dark:text-red-400 mr-1 float-left">&#xe000;</span>
          {/if}
          <a
            href={getNationLink(puppet, "puppetPopup")}
            target="_blank"
            rel="noopener noreferrer"
            data-nation="true"
            data-nation-name={puppet}
            class="text-gray-900 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-400 no-underline hover:underline"
          >
            {uncanonicalizeName(puppet)}
          </a>
        </span>
      </div>
    {/each}
  </div>

  {#if filteredPuppets.length === 0}
    <div class="text-center py-10 text-gray-500 text-sm">
      No puppets found matching filters.
    </div>
  {/if}
</div>
