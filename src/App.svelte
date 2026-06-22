<script>
  import { onMount, onDestroy } from "svelte";
  import Header from "./Header.svelte";
  import UnsmurfTrades from "./UnsmurfTrades.svelte";
  import { settingsStore, useSettings } from "./settingsStore.js";
  import Config from "./Config.svelte";
  import { fetchSheets } from "./sheetFetch";
  import { getQueryParam, setQueryParam, getAllNationLinks } from "./dataUtils";

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
  import NationAlert from "./NationAlert.svelte";
  import Puppetmasters from "./Puppetmasters.svelte";
  import PuppetPopup from "./PuppetPopup.svelte";
  import ReportPuppetPopup from "./ReportPuppetPopup.svelte";
  import QnA from "./QnA.svelte";
  import NationLinkPopup from "./NationLinkPopup.svelte";

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
  let hasSearched = false;
  let keyboardOpen = false;
  let cleanupViewportListener = null;
  let showReportPopup = false;
  let reportNationName = "";
  let showNationPopup = false;
  let popupNations = [];
  let popupX = 0;
  let popupY = 0;

  let longPressTimer = null;
  let longPressTarget = null;
  let popupCloseHandler = null;

  $: canonicalizedName = canonicalizeName(nationId);
  $: canonicalizedMasterName =
    canonicalizeName(findPuppetmaster(canonicalizedName)?.master) || "";
  $: isCTE = !isNationCurrent(canonicalizedName);
  $: isPuppet =
    canonicalizedMasterName && canonicalizedName !== canonicalizedMasterName;
  $: isMasterCte = !isNationCurrent(canonicalizedMasterName);

  $: defaultSearchView = currentView === 'trades' && !hasSearched;
  $: centerContent = defaultSearchView && !keyboardOpen;
  $: compactSearchContent = defaultSearchView && keyboardOpen;

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

    hasSearched = true;
    loading = true;
    const safeNation = nationId.trim();
    setQueryParam("q", safeNation);
    document.title = `Unsmurf | ${uncanonicalizeName(safeNation)}`;

    // Fetch Data
    const [fetchedBuys, fetchedSells] = await Promise.all([
      fetchData("buyer", safeNation, forceRefresh),
      fetchData("seller", safeNation, forceRefresh),
      fetchSheets(forceRefresh)
    ]);

    // Assign fetched values
    buys = fetchedBuys.trades;
    sells = fetchedSells.trades;
    lastCacheTime = fetchedBuys.cacheTime || fetchedSells.cacheTime || Date.now();
    loadedNationId = canonicalizeName(safeNation);

    loading = false;
  }

  function openConfig() {
    showConfig = true;
  }

  function closeConfig() {
    showConfig = false;
  }

  function closeNationPopup() {
    showNationPopup = false;
    if (popupCloseHandler) {
      window.removeEventListener("scroll", popupCloseHandler, true);
      window.removeEventListener("resize", popupCloseHandler);
      window.removeEventListener("click", popupCloseHandler);
      popupCloseHandler = null;
    }
  }

  function showPopupForNation(names, el) {
    popupNations = Array.isArray(names) ? names : [names];
    const rect = el.getBoundingClientRect();
    popupX = rect.left;
    popupY = rect.bottom;
    showNationPopup = true;
    popupCloseHandler = () => { closeNationPopup(); };
    window.addEventListener("scroll", popupCloseHandler, true);
    window.addEventListener("resize", popupCloseHandler);
    setTimeout(() => {
      window.addEventListener("click", popupCloseHandler);
    }, 0);
  }

  function getPopupNations(el) {
    const cell = el.closest("td, li, [data-nation-container]");
    if (cell) {
      const links = cell.querySelectorAll("[data-nation-name]");
      const names = [...new Set(Array.from(links).map(l => l.getAttribute("data-nation-name")).filter(Boolean))];
      return names.length > 0 ? names : [el.getAttribute("data-nation-name")];
    }
    return [el.getAttribute("data-nation-name")];
  }

  function handleContextMenu(e) {
    if (!useSettings().enableRightClickPopup) return;
    const link = e.target.closest("[data-nation]");
    if (link) {
      e.preventDefault();
      const names = getPopupNations(link);
      if (names.length > 0) {
        showPopupForNation(names, link);
      }
    }
  }

  function handleTouchStart(e) {
    if (!useSettings().enableRightClickPopup) return;
    const link = e.target.closest("[data-nation]");
    if (link) {
      longPressTarget = link;
      longPressTimer = setTimeout(() => {
        if (longPressTarget) {
          const names = getPopupNations(longPressTarget);
          if (names.length > 0) {
            showPopupForNation(names, longPressTarget);
          }
        }
        longPressTimer = null;
        longPressTarget = null;
      }, 500);
    }
  }

  function handleTouchMove() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressTarget = null;
    }
  }

  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressTarget = null;
    }
  }

  // Keep Escape to close popup
  function handleKeyDown(e) {
    if (e.key === "Escape" && showNationPopup) {
      closeNationPopup();
    }
  }

  onMount(async () => {
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("keydown", handleKeyDown);
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      systemDark = e.matches;
      applyTheme($settingsStore.theme, $settingsStore.midnightMode);
    });

    const fromURL = getQueryParam("q");
    const viewFromURL = getQueryParam("v");
    const masterFromURL = getQueryParam("m");
    
    if (window.visualViewport) {
      const updateViewport = () => {
        const viewport = window.visualViewport;
        keyboardOpen = viewport.height < window.innerHeight * 0.85;
        document.documentElement.style.setProperty('--app-height', `${viewport.height}px`);
        document.documentElement.style.setProperty('--visual-viewport-height', `${viewport.height}px`);
        document.documentElement.style.setProperty('--visual-viewport-offset-top', `${viewport.offsetTop}px`);
        document.documentElement.dataset.keyboardOpen = keyboardOpen;
      };
      window.visualViewport.addEventListener('resize', updateViewport);
      window.visualViewport.addEventListener('scroll', updateViewport);
      cleanupViewportListener = () => {
        window.visualViewport.removeEventListener('resize', updateViewport);
        window.visualViewport.removeEventListener('scroll', updateViewport);
      };
      updateViewport();
    }

    window.addEventListener('UNSMURF_AUX_DATA_READY', async () => {
      await fetchSheets();
      if (nationId) await loadTradeData();
    });
    
    await fetchSheets();

    if (viewFromURL === 'q') {
      currentView = 'qna';
    } else if (viewFromURL === 'm' || masterFromURL) {
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
    if (currentView === "trades") {
      setQueryParam("v", null);
    } else if (currentView === "masters") {
      setQueryParam("v", "m");
    } else if (currentView === "qna") {
      setQueryParam("v", "q");
    }
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
    } else if (currentView === "masters") {
      document.title = "Unsmurf | Puppetmasters";
    } else if (currentView === "qna") {
      document.title = "Unsmurf | Q&A";
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

  // Theme: handle light / system / dark
  let systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let mediaQuery;

  function applyTheme(theme, midnight) {
    const isDark = theme === 'dark' || (theme === 'system' && systemDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
      if (midnight) {
        document.documentElement.classList.add("midnight");
      } else {
        document.documentElement.classList.remove("midnight");
      }
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.remove("midnight");
    }
  }

  $: if ($settingsStore) {
    applyTheme($settingsStore.theme, $settingsStore.midnightMode);
  }

  onDestroy(() => {
    document.removeEventListener("contextmenu", handleContextMenu);
    document.removeEventListener("touchstart", handleTouchStart);
    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
    document.removeEventListener("keydown", handleKeyDown);
    if (cleanupViewportListener) cleanupViewportListener();
  });
</script>

<!-- Page Layout Wrapper -->
<Sidebar {currentView} on:viewChange={handleViewChange} on:showSettings={openConfig} />

<!-- Main Content Wrapper -->
<div
  class="md:ml-16 px-3 sm:px-6 md:px-8 lg:px-[5%] min-h-dvh pb-20 transition-all duration-500 md:pb-0"
  class:mt-10={!centerContent}
  class:pt-4={compactSearchContent}
  class:md:py-12={!centerContent}
  class:pt-[28vh]={centerContent}
  class:sm:pt-[35vh]={centerContent}
>
  <!-- Header -->
  <Header mode={currentView === 'masters' ? 'masters' : currentView === 'qna' ? 'qna' : mode} />

  {#if currentView === 'trades'}
    <div class="w-full max-w-xl">
      <UnsmurfTrades bind:nationId {loadTradeData} {loading} />

      {#if nationId.trim().length > 2 && canonicalizedName !== loadedNationId}
        <div class="bg-white dark:bg-gray-800 midnight:!bg-black border border-gray-300 dark:border-gray-600 midnight:!border-gray-600 rounded-xl shadow-lg mt-2">
          <NationAlert {nationId} preview onSelect={(name) => { nationId = name; loadTradeData(); }} />
        </div>
      {/if}
    </div>

    <!-- Results header (CSS-collapsed during loading so the preview is alone) -->
    {#if !lastCacheTime}
      <p class="text-gray-500 dark:text-gray-400 text-sm mt-6">
        Puppets missing? Add them <a href="https://forms.gle/DW4CMWAVQ3TDpj25A" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">here</a>.
      </p>
    {/if}

    {#if lastCacheTime && loadedNationId}
      <div
        class="transition-all duration-300 ease-out overflow-hidden"
        style="max-height: {loading ? '0' : '500'}px; opacity: {loading ? '0' : '1'}; margin-top: {loading ? '0' : '1.5rem'}; margin-bottom: {loading ? '0' : '1.5rem'};"
      >
        <NationAlert
          nationId={loadedNationId}
          cacheTime={lastCacheTime}
          onRefresh={() => loadTradeData(true)}
          onReport={() => { reportNationName = uncanonicalizeName(loadedNationId); showReportPopup = true; }}
          hasRecords={buys.length > 0 || sells.length > 0}
        />
      </div>
    {/if}

    <!-- Tables (stay visible until lookup is clicked) -->
    {#if lastCacheTime}
      {#if buys.length > 0 || sells.length > 0}
        <TallyTables
          {loading}
          {sellTallyGifts}
          {buyTallyGifts}
          {sellTallyTrades}
          {buyTallyTrades}
          {makeTallyColumns}
          {makeTallyRows}
        />

        <DetailedTables
          {loading}
          {buys}
          {sells}
          {makeTradeColumns}
          {makeTradeRows}
          {makeGiftColumns}
          {makeGiftRows}
        />
      {:else if !loading}
        <p class="text-gray-500 dark:text-gray-400 mt-6 text-sm">
          No trades found for {uncanonicalizeName(canonicalizedName)}.
        </p>
      {/if}
    {/if}
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
  {:else if currentView === 'qna'}
    <QnA />
  {/if}

  <!-- Global Config Overlay -->
  <Config {showConfig} {closeConfig} />
</div>

{#if showReportPopup}
  <ReportPuppetPopup
    nationName={reportNationName}
    {sellTallyTrades}
    {sellTallyGifts}
    {buyTallyTrades}
    {buyTallyGifts}
    onClose={() => { showReportPopup = false; }}
  />
{/if}

{#if showNationPopup}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div id="nation-popup" class="fixed z-[9999] bg-white dark:bg-gray-800 midnight:!bg-black border border-gray-200 dark:border-gray-700 midnight:!border-gray-800 rounded-md shadow-xl py-1 text-xs overflow-hidden" style="left: {popupX}px; top: {popupY}px;" on:click|stopPropagation>
    <div class="flex flex-row">
      {#each popupNations as nation, i}
        <div class="w-32" class:border-l={i > 0} class:border-gray-200={i > 0} class:dark:border-gray-700={i > 0} class:midnight:!border-gray-800={i > 0}>
          {#if popupNations.length > 1}
            <div class="px-2 py-0.5 font-bold text-gray-400 uppercase tracking-wider text-[10px] truncate">{nation}</div>
          {/if}
          {#each getAllNationLinks(nation) as link}
            <button
              on:click={() => { if (link.url) window.open(link.url, "_blank"); closeNationPopup(); }}
              class="w-full text-left px-2 py-0.5 text-gray-700 dark:text-gray-200 midnight:!text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 midnight:hover:!bg-[#0f1115] transition-colors truncate"
              disabled={!link.url}
              title={link.url || "No custom URL configured"}
            >
              {link.label}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}
