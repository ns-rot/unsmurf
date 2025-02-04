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

  $: canonicalizedName = canonicalizeName(nationId);
  $: canonicalizedMasterName = canonicalizeName(findPuppetmaster(canonicalizedName)?.master) || "";
  $: isCTE = !isNationCurrent(canonicalizedName);
  $: isPuppet = canonicalizedMasterName && canonicalizedName !== canonicalizedMasterName;
  $: isMasterCte = !isNationCurrent(canonicalizedMasterName);

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
