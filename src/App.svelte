<script>
  import { onMount } from "svelte";
  import Header from "./Header.svelte";
  import UnsmurfTrades from "./UnsmurfTrades.svelte";
  import { settingsStore } from "./settingsStore.js";
  import Config from "./Config.svelte";
  import { fetchSheets } from "./sheetFetch";
  import { getQueryParam, setQueryParam } from "./dataUtils";

  import TallyTables from "./TallyTables.svelte";
  import DetailedTables from "./DetailedTables.svelte";

  import { canonicalizeName, uncanonicalizeName } from "./settingsUtils.js";
  import { isNationCurrent, findPuppetmaster } from "./sheetFetch.js";

  import {
    fetchData,
    tallyCounts,
    makeTallyColumns,
    makeTallyRows,
    makeTradeColumns,
    makeGiftColumns,
    makeTradeRows,
    makeGiftRows,
  } from "./dataUtils";

  import NationAlert from "./NationAlert.svelte";

  let mode = "cards";

  let nationId = "";
  let loading = false;
  let buys = [];
  let sells = [];
  let buyTallyTrades = [];
  let buyTallyGifts = [];
  let sellTallyTrades = [];
  let sellTallyGifts = [];
  let showConfig = false;

  let canonicalizedName = "";
  let canonicalizedMasterName = "";
  let isCTE = false;
  let isPuppet = false;
  let isMasterCte = false;
  let lastCacheTime = null;
  let loadedNationId = "";

  $: dataReady = $settingsStore.dataFetched;

  $: canonicalizedName = canonicalizeName(nationId);
  $: canonicalizedMasterName = dataReady ? (canonicalizeName(findPuppetmaster(canonicalizedName)?.master) || "") : "";
  $: isCTE = dataReady ? !isNationCurrent(canonicalizedName) : false;
  $: isPuppet = dataReady ? (canonicalizedMasterName && canonicalizedName !== canonicalizedMasterName) : false;
  $: isMasterCte = dataReady ? !isNationCurrent(canonicalizedMasterName) : false;

  async function loadTradeData(forceRefresh = false) {
    if (!nationId.trim()) {
      alert("Please enter a nation name.");
      return;
    }

    loading = true;
    const safeNation = nationId.trim();
    setQueryParam("q", safeNation);
    document.title = `Unsmurf | ${uncanonicalizeName(safeNation)}`;

    // Fetch Data
    const [fetchedBuys, fetchedSells] = await Promise.all([
      fetchData("buyer", safeNation, forceRefresh),
      fetchData("seller", safeNation, forceRefresh),
    ]);

    // Assign fetched values
    buys = fetchedBuys.trades;
    sells = fetchedSells.trades;
    lastCacheTime = fetchedBuys.cacheTime || fetchedSells.cacheTime;
    loadedNationId = canonicalizeName(safeNation);

    loading = false;
  }

  $: buyTallyTrades = $settingsStore && tallyCounts(buys, "seller", true);
  $: buyTallyGifts = $settingsStore && tallyCounts(buys, "seller", false);
  $: sellTallyTrades = $settingsStore && tallyCounts(sells, "buyer", true);
  $: sellTallyGifts = $settingsStore && tallyCounts(sells, "buyer", false);

  function openConfig() {
    showConfig = true;
  }

  function closeConfig() {
    showConfig = false;
  }

  onMount(async () => {
    const fromURL = getQueryParam("q");
    await fetchSheets();
    if (fromURL) {
      nationId = canonicalizeName(fromURL);
      await loadTradeData();
    }
  });


</script>

<!-- Page Layout Wrapper -->
<div class="px-1.5 sm:px-4 md:px-6 lg:px-8 xl:px-[6%] my-16">
  <!-- Header -->
  <Header {mode} />

  <!-- UnsmurfTrades Input Component -->
  <UnsmurfTrades bind:nationId {loadTradeData} {showConfig} {openConfig} />

  {#if lastCacheTime && canonicalizedName === loadedNationId}
    <div class="text-center text-sm text-gray-500 mb-4">
      cached data from {new Date(lastCacheTime).toLocaleString()}
      <button
        class="text-blue-500 hover:underline ml-2"
        on:click={() => loadTradeData(true)}>refresh</button
      >
    </div>
  {/if}

  <!-- Config Overlay -->
  <Config {showConfig} {closeConfig} />

  <!-- Alert Banner -->
  <NationAlert {nationId} />

  <!-- TALLY TABLES COMPONENT -->
  <TallyTables
    {loading}
    {sellTallyGifts}
    {buyTallyGifts}
    {sellTallyTrades}
    {buyTallyTrades}
    {makeTallyColumns}
    {makeTallyRows}
  />

  <!-- DETAILED TABLES COMPONENT -->
  <DetailedTables
    {loading}
    {buys}
    {sells}
    {makeTradeColumns}
    {makeTradeRows}
    {makeGiftColumns}
    {makeGiftRows}
  />
</div>
