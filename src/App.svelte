<script>
  import { onMount } from "svelte";
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

  $: canonicalizedName = canonicalizeName(nationId);
  $: canonicalizedMasterName = canonicalizeName(findPuppetmaster(canonicalizedName)?.master) || "";
  $: isCTE = !isNationCurrent(canonicalizedName);
  $: isPuppet = canonicalizedMasterName && canonicalizedName !== canonicalizedMasterName;

  function lookupNation() {
    if (!nationId.trim()) {
      alert("Please enter a nation name.");
      return;
    }

    const safeNation = canonicalizeName(nationId.trim());
    window.location.href = `./?q=${encodeURIComponent(safeNation)}`;
  }

  function handleEnter(e) {
    if (e.key === "Enter") {
      lookupNation();
    }
  }

  function openConfig() {
    showConfig = true;
  }

  function closeConfig() {
    showConfig = false;
  }

  async function loadTradeData() {
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
      fetchData("buyer", safeNation),
      fetchData("seller", safeNation),
    ]);

    // Assign fetched values
    buys = fetchedBuys;
    sells = fetchedSells;

    // Calculate tallies
    buyTallyTrades = tallyCounts(buys, "seller", true);
    buyTallyGifts = tallyCounts(buys, "seller", false);
    sellTallyTrades = tallyCounts(sells, "buyer", true);
    sellTallyGifts = tallyCounts(sells, "buyer", false);

    loading = false;
  }

  onMount(async () => {
    const fromURL = getQueryParam("q");
    await fetchSheets();
    if (fromURL) {
      nationId = uncanonicalizeName(fromURL);
      await loadTradeData();
    }
  });
</script>

<!-- Page Layout Wrapper -->
<div class="px-1.5 sm:px-4 md:px-6 lg:px-8 xl:px-[6%] my-16">
  <!-- Header / Input Section -->
  <div class="relative text-center mb-4">
    <h1 class="text-2xl font-bold font-inter">Unsmurf thru Card Trades</h1>
    <p class="text-gray-600">
      An alternative UI for
      <a
        href="https://bazaar.kractero.com/"
        class="text-blue-500 hover:underline">Kractero's Bazaar</a
      >
      to make identifying puppets easier.
    </p>

    <div class="flex items-center justify-between mt-4 w-full">
      <div class="flex-1"></div>
      <div class="flex-3 flex items-center justify-center gap-2">
        <input
          id="nationId"
          type="text"
          bind:value={nationId}
          on:keypress={handleEnter}
          placeholder="Testlandia"
          class="border border-gray-300 rounded-full px-3 py-2 focus:ring focus:ring-blue-300 focus:outline-none"
        />
        <button
          on:click={lookupNation}
          class="bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-600 focus:ring focus:ring-blue-300 transition"
        >
          Lookup
        </button>
      </div>
      <div class="flex-1 flex justify-end">
        <button
          on:click={openConfig}
          aria-label="Config"
          class="bg-black text-white font-bold p-2 size-10 rounded-full hover:bg-gray-600 focus:outline-none focus:ring focus:ring-gray-300 transition"
        >
          <img
            src="https://ns-rot.github.io/unsmurf/icons/config.svg"
            alt="Config"
            class="w-6 h-6"
          />
        </button>
      </div>
    </div>
  </div>

  <!-- Config Overlay -->
  <Config {showConfig} {closeConfig} />

  <!-- Alert Banner -->
  <NationAlert {canonicalizedName} canonicalizedMasterName={canonicalizedMasterName} {isCTE} {isPuppet} />

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
