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
  import {
    isNationCurrent,
    findPuppetmaster,
    listPuppets,
    tallyPuppets,
  } from "./sheetFetch.js";

  import Sidebar from "./Sidebar.svelte";
  import Puppetmasters from "./Puppetmasters.svelte";
  import PuppetPopup from "./PuppetPopup.svelte";

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

  let mode = "cards";

  let currentView = "trades"; // 'trades' or 'masters'
  let selectedMaster = "";

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

  $: canonicalizedName = canonicalizeName(nationId);
  $: canonicalizedMasterName =
    canonicalizeName(findPuppetmaster(canonicalizedName)?.master) || "";
  $: isCTE = !isNationCurrent(canonicalizedName);
  $: isPuppet =
    canonicalizedMasterName && canonicalizedName !== canonicalizedMasterName;
  $: isMasterCte = !isNationCurrent(canonicalizedMasterName);

  // Reactive tallies that update when buys/sells change OR when settings change
  $: buyTallyTrades =
    $settingsStore && tallyCounts(buys, "seller", true, "tallyReceived");
  $: buyTallyGifts =
    $settingsStore && tallyCounts(buys, "seller", false, "tallyReceived");
  $: sellTallyTrades =
    $settingsStore && tallyCounts(sells, "buyer", true, "tallySent");
  $: sellTallyGifts =
    $settingsStore && tallyCounts(sells, "buyer", false, "tallySent");

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

  function openConfig() {
    showConfig = true;
  }

  function closeConfig() {
    showConfig = false;
  }

  onMount(async () => {
    const fromURL = getQueryParam("q");
    const viewFromURL = getQueryParam("v");
    const masterFromURL = getQueryParam("m");
    
    window.addEventListener('UNSMURF_AUX_DATA_READY', async () => {
      await fetchSheets();
      if (nationId) await loadTradeData();
    });
    
    await fetchSheets();

    if (viewFromURL === 'm' || masterFromURL) {
      currentView = 'masters';
    }

    if (masterFromURL) {
      selectedMaster = masterFromURL;
    }

    if (fromURL) {
      nationId = canonicalizeName(fromURL);
      await loadTradeData();
    }
  });

  function handleViewChange(event) {
    currentView = event.detail;
    selectedMaster = "";
    setQueryParam("v", currentView === 'trades' ? null : "m");
    setQueryParam("m", null);
    if (currentView === "masters") {
      setQueryParam("q", null);
    } else {
      setQueryParam("mq", null);
      setQueryParam("ma", null);
      setQueryParam("ms", null);
      setQueryParam("m", null);
    }
    if (currentView === "trades") {
      document.title = nationId ? `Unsmurf | ${uncanonicalizeName(nationId)}` : "Unsmurf";
    } else {
      document.title = "Unsmurf | Puppetmasters";
    }
  }

  function handleSelectMaster(masterName) {
    selectedMaster = masterName;
    setQueryParam("m", masterName);
    document.title = `Unsmurf | ${uncanonicalizeName(masterName)}'s Puppets`;
  }

  function handleBackToMasters() {
    selectedMaster = "";
    setQueryParam("m", null);
    if (currentView === 'masters') {
        document.title = "Unsmurf | Puppetmasters";
    }
  }

  $: selectedMasterPuppets = selectedMaster ? listPuppets(selectedMaster).map(p => uncanonicalizeName(p)) : [];
  $: selectedMasterCount = selectedMaster ? tallyPuppets(selectedMaster) : 0;

  // Dark Mode & Midnight Mode Toggle Effect
  $: if ($settingsStore) {
    if ($settingsStore.darkMode) {
      document.documentElement.classList.add("dark");
      if ($settingsStore.midnightMode) {
        document.documentElement.classList.add("midnight");
      } else {
        document.documentElement.classList.remove("midnight");
      }
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.remove("midnight");
    }
  }
</script>

<!-- Page Layout Wrapper -->
<Sidebar {currentView} on:viewChange={handleViewChange} />

<div class="pl-16 md:pl-20 lg:pl-24 px-1.5 sm:px-4 md:px-6 lg:px-8 xl:px-[6%] my-12 min-h-screen transition-all duration-500">
  <!-- Header -->
  <Header mode={currentView === 'masters' ? 'masters' : mode} />

  {#if currentView === 'trades'}
    <!-- UnsmurfTrades Input Component -->
    <UnsmurfTrades bind:nationId {loadTradeData} {showConfig} {openConfig} />

    {#if lastCacheTime && canonicalizedName === loadedNationId}
      <div class="text-left text-sm text-gray-500 dark:text-gray-400 mb-4">
        Cached data from {new Date(lastCacheTime).toLocaleString()}
        <button
          class="text-blue-500 hover:underline ml-2"
          on:click={() => loadTradeData(true)}>Refresh</button
        >
      </div>
    {/if}

    <!-- Config Overlay -->
    <Config {showConfig} {closeConfig} />

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
  {:else if currentView === 'masters'}
    <Puppetmasters onSelectMaster={handleSelectMaster} />

    {#if selectedMaster}
      <PuppetPopup
        nationName={uncanonicalizeName(selectedMaster)}
        puppetCount={selectedMasterCount}
        puppetList={selectedMasterPuppets}
        onClose={handleBackToMasters}
      />
    {/if}
  {/if}
</div>
