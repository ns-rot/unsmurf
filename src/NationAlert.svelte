<script>
  import { fly } from "svelte/transition";
  import { canonicalizeName, uncanonicalizeName } from "./settingsUtils.js";
  import {
    isNationCurrent,
    findPuppetmaster,
    listPuppets,
    tallyPuppets,
    countActivePuppets,
    searchNations,
  } from "./sheetFetch.js";
  import PuppetPopup from "./PuppetPopup.svelte";

  import { settingsStore } from "./settingsStore.js";

  export let nationId = "";
  export let cacheTime = null;
  export let onRefresh = null;
  export let preview = false;
  export let onSelect = null;

  $: dataReady = $settingsStore.dataFetched;
  $: canonicalizedName = canonicalizeName(nationId);
  $: canonicalizedMasterName = (() => {
    if (!dataReady) return "";
    const info = findPuppetmaster(canonicalizedName).master;
    return canonicalizeName(info) === canonicalizedName ? "" : info;
  })();
  $: isCTE = dataReady ? !isNationCurrent(canonicalizedName) : false;
  $: isPuppet = canonicalizedMasterName != "";
  $: isMasterCte = dataReady
    ? !isNationCurrent(canonicalizedMasterName)
    : false;

  $: puppetCountSelf = dataReady ? tallyPuppets(canonicalizedName) : 0;
  $: puppetCountMaster = dataReady ? tallyPuppets(canonicalizedMasterName) : 0;
  $: puppetTally = isPuppet ? puppetCountMaster : puppetCountSelf;

  $: activePuppetTally = dataReady
    ? countActivePuppets(
        listPuppets(isPuppet ? canonicalizedMasterName : canonicalizedName),
      )
    : 0;

  let isPopupVisible = false;

  function togglePopup() {
    isPopupVisible = !isPopupVisible;
  }

  function closePopup() {
    isPopupVisible = false;
  }

  $: popupNationName = isPuppet
    ? uncanonicalizeName(canonicalizedMasterName)
    : uncanonicalizeName(canonicalizedName);

  $: puppetList = (() => {
    const nameToCheck = isPuppet ? canonicalizedMasterName : canonicalizedName;
    return listPuppets(nameToCheck).map((p) => uncanonicalizeName(p));
  })();

  $: matchingNations = preview && dataReady && canonicalizedName.length > 2
    ? searchNations(canonicalizedName).filter(n => n !== canonicalizedName)
    : [];
</script>

<div
  class="transition-all duration-300 ease-out"
  class:border-2={preview}
  class:border-dashed={preview}
  class:border-gray-300={preview}
  class:dark:border-gray-600={preview}
  class:rounded-2xl={preview}
  class:p-4={preview}
  class:pb-4={!preview}
  class:border-b={cacheTime}
  class:border-gray-200={cacheTime}
  class:dark:border-gray-700={cacheTime}
  class:mb-6={cacheTime}
>
  <div class="font-bold leading-tight transition-all duration-300 ease-out" class:text-2xl={!preview} class:text-lg={preview}>
    {#if isCTE}<span class="select-none text-red-600 dark:text-red-400">&#xe000;&#x2009;</span>{/if}
    {uncanonicalizeName(canonicalizedName)}
  </div>
  {#if isPuppet}
    <div class="mt-0.5 text-gray-500 dark:text-gray-400 transition-all duration-300 ease-out" class:text-base={!preview} class:text-sm={preview}>
      Puppet of
      {#if isMasterCte}<span class="select-none text-red-600 dark:text-red-400">&#xe000;&#x2009;</span>{/if}
      <strong class="text-gray-900 dark:text-gray-100">{uncanonicalizeName(canonicalizedMasterName)}</strong>
    </div>
  {/if}

  <div class="flex items-center justify-between gap-4 mt-1.5">
    <div class="flex items-center gap-3">
      {#if puppetTally > 0}
        <span class="text-gray-500 dark:text-gray-400 transition-all duration-300 ease-out" class:text-base={!preview} class:text-sm={preview}>
          {puppetTally !== activePuppetTally
            ? `${activePuppetTally} active, ${puppetTally} known puppets`
            : `${puppetTally} known puppets`}
        </span>
        <button
          on:click={togglePopup}
          aria-label="View puppets"
          class="text-sm font-medium px-3 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition shrink-0 focus:outline-none"
        >
          View All
        </button>
      {/if}
    </div>
    {#if cacheTime}
      <div
        class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"
        in:fly={{ x: 10, duration: 300, delay: 100 }}
      >
        Cached {new Date(cacheTime).toLocaleString()}
        {#if onRefresh}
          <button
            on:click={onRefresh}
            class="text-gray-600 dark:text-gray-400 hover:underline ml-1"
          >
            Refresh
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if preview && matchingNations.length > 0}
    <div class="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-600">
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Matching:</div>
      <div class="flex flex-wrap gap-1.5">
        {#each matchingNations as name}
          <button
            on:click={() => onSelect?.(name)}
            class="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            {uncanonicalizeName(name)}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

{#if isPopupVisible && puppetTally > 0}
  <PuppetPopup
    nationName={popupNationName}
    puppetCount={puppetTally}
    {puppetList}
    onClose={closePopup}
  />
{/if}
