<script>
  import { onMount, tick } from "svelte";
  import { canonicalizeName, uncanonicalizeName } from "./settingsUtils.js";

  export let nationName = "";
  export let sellTallyTrades = [];
  export let sellTallyGifts = [];
  export let buyTallyTrades = [];
  export let buyTallyGifts = [];
  export let onClose = null;

  const FORM_ID = "1FAIpQLSeoXoau49jVAgHwKQsoyTvwakRmaOuf4hyRyPeWHwp6yiJ38w";
  const FIELD_SOURCE = "1300042132";
  const FIELD_FLAGGED_NATION = "780495499";
  const FIELD_CATEGORY = "1146691726";
  const FIELD_SUSPECTED = "2087979369";
  const FIELD_NOTE = "1347268059";

  $: nationRawName = canonicalizeName(nationName);

  $: merged = (() => {
    const map = new Map();

    function add(tally, key) {
      tally.forEach(([_displayHtml, count, rawName]) => {
        if (rawName === nationRawName) return;
        if (!map.has(rawName)) {
          map.set(rawName, { rawName, buyTrade: 0, buyGift: 0, sellTrade: 0, sellGift: 0 });
        }
        map.get(rawName)[key] += count;
      });
    }

    add(buyTallyTrades, "buyTrade");
    add(buyTallyGifts, "buyGift");
    add(sellTallyTrades, "sellTrade");
    add(sellTallyGifts, "sellGift");

    return Array.from(map.values())
      .map((e) => ({
        ...e,
        giftTotal: e.buyGift + e.sellGift,
        tradeTotal: e.buyTrade + e.sellTrade,
        sortKey: (e.buyGift + e.sellGift) * 10 + e.buyTrade + e.sellTrade,
        displayName: uncanonicalizeName(e.rawName),
      }))
      .sort((a, b) => b.sortKey - a.sortKey);
  })();

  $: rows = [
    { rawName: nationRawName, displayName: nationName, buyTrade: null, buyGift: null, sellTrade: null, sellGift: null, giftTotal: null, tradeTotal: null },
    ...merged,
  ];

  let selected = new Set([canonicalizeName(nationName)]);
  let mainNation = canonicalizeName(nationName);

  function toggle(rawName) {
    if (rawName === nationRawName) return;
    if (selected.has(rawName)) {
      selected.delete(rawName);
      if (mainNation === rawName) mainNation = nationRawName;
    } else {
      selected.add(rawName);
    }
    selected = selected;
  }

  function setMain(rawName) {
    mainNation = rawName;
  }

  let submitting = false;
  let submitted = false;
  let disableToast = false;
  let disableToastTimer = null;

  function showDisableToast() {
    disableToast = true;
    clearTimeout(disableToastTimer);
    disableToastTimer = setTimeout(() => { disableToast = false; }, 3000);
  }

  function handleSubmitClick() {
    if (selected.size <= 1) {
      showDisableToast();
      return;
    }
    submit();
  }

  function submit() {
    if (selected.size === 0) return;
    submitting = true;

    const others = Array.from(selected).filter(n => n !== mainNation);
    const suspectedList = others.join("\n");
    const mainName = uncanonicalizeName(mainNation);

    const formUrl = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;
    const body = new URLSearchParams({
      [`entry.${FIELD_SOURCE}`]: "unsmurf",
      [`entry.${FIELD_FLAGGED_NATION}`]: mainName,
      [`entry.${FIELD_CATEGORY}`]: "Card Farming",
      [`entry.${FIELD_SUSPECTED}`]: suspectedList,
      [`entry.${FIELD_NOTE}`]: "Submitted via Unsmurf",
    });

    fetch(formUrl, { method: "POST", body }).catch(() => {});
    submitting = false;
    submitted = true;

    setTimeout(() => onClose?.(), 1500);
  }

  function close() {
    if (submitted) return;
    onClose?.();
  }

  function handleKeydown(e) {
    if (e.key === "Escape") close();
  }

  let scrollContainer;
  let hasContentBelow = false;

  function updateScrollIndicator() {
    if (!scrollContainer) {
      hasContentBelow = false;
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    hasContentBelow = scrollTop + clientHeight < scrollHeight - 2;
  }

  onMount(() => {
    const ro = new ResizeObserver(updateScrollIndicator);
    if (scrollContainer) ro.observe(scrollContainer);
    return () => ro.disconnect();
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm"
  on:click={close}
>
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="w-full max-w-2xl flex flex-col items-center gap-2 px-4 sm:px-0"
    on:click|stopPropagation
  >
    <div
      class="puppet-modal w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl relative flex flex-col overflow-clip border border-gray-200 dark:border-gray-700 max-h-[75dvh]"
    >
      {#if submitted}
        <div class="flex-1 flex items-center justify-center py-16">
          <div class="text-center">
            <p class="text-lg font-medium text-green-600 dark:text-green-400 mb-2">Thank you!</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Your report has been submitted.</p>
          </div>
        </div>
      {:else}
        <!-- Scrollable pane (heading scrolls with content) -->
        <div
          bind:this={scrollContainer}
          on:scroll={updateScrollIndicator}
          class="flex-1 overflow-y-auto min-h-0"
        >
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold font-sans text-gray-900 dark:text-gray-100">Report suspected puppets</h2>
          </div>
          <div class="px-5 py-4">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Check all nations you suspect are operated by the same player. Use radio buttons to indicate the suspected puppetmaster.
          </p>

          {#if merged.length === 0}
            <p class="text-sm text-gray-400 dark:text-gray-500 italic py-8 text-center">
              No trade data available for this nation.
            </p>
          {:else}
            <div class="divide-y divide-gray-100 dark:divide-gray-700/50">
              {#each rows as entry (entry.rawName)}
                <div
                  class="px-3 py-2.5 transition text-sm {selected.has(entry.rawName) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} {entry.rawName === nationRawName ? 'bg-gray-50 dark:bg-gray-700/30' : ''}"
                >
                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={entry.rawName === nationRawName || selected.has(entry.rawName)}
                      disabled={entry.rawName === nationRawName}
                      on:change={() => toggle(entry.rawName)}
                      class="shrink-0 accent-gray-600 dark:accent-indigo-400 {entry.rawName === nationRawName ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}"
                    />
                    <input
                      type="radio"
                      name="mainNation"
                      value={entry.rawName}
                      checked={mainNation === entry.rawName}
                      disabled={entry.rawName !== nationRawName && !selected.has(entry.rawName)}
                      on:change={() => setMain(entry.rawName)}
                      class="shrink-0 accent-gray-600 dark:accent-indigo-400 {entry.rawName !== nationRawName && !selected.has(entry.rawName) ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}"
                    />
                    <span class="flex-1 min-w-0 truncate {entry.rawName === nationRawName ? 'text-gray-900 dark:text-gray-100 font-bold' : 'text-gray-900 dark:text-gray-100 font-medium'}">
                      {entry.displayName}
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 ml-9 text-xs text-gray-500 dark:text-gray-400">
                    {#if entry.buyGift != null && entry.buyGift > 0}
                      <span class="text-gray-700 dark:text-gray-300"><strong class="text-gray-800 dark:text-gray-200">Received</strong> {entry.buyGift}</span>
                    {/if}
                    {#if entry.sellGift != null && entry.sellGift > 0}
                      <span class="text-gray-700 dark:text-gray-300"><strong class="text-gray-800 dark:text-gray-200">Sent</strong> {entry.sellGift}</span>
                    {/if}
                    {#if entry.buyTrade != null && entry.buyTrade > 0}
                      <span class="text-gray-300 dark:text-gray-600"><strong class="text-gray-400 dark:text-gray-500">Bought</strong> {entry.buyTrade}</span>
                    {/if}
                    {#if entry.sellTrade != null && entry.sellTrade > 0}
                      <span class="text-gray-300 dark:text-gray-600"><strong class="text-gray-400 dark:text-gray-500">Sold</strong> {entry.sellTrade}</span>
                    {/if}
                    <span class="flex-1"></span>
                    {#if entry.giftTotal != null && entry.giftTotal > 0}
                      <span class="font-bold text-gray-800 dark:text-gray-200">· Gifts {entry.giftTotal}</span>
                    {/if}
                    {#if entry.tradeTotal != null && entry.tradeTotal > 0}
                      <span class="font-bold text-gray-300 dark:text-gray-600">· Trades {entry.tradeTotal}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        </div>

        <!-- Bottom fade when content is scrollable -->
        <div
          aria-hidden="true"
          class="settings-scroll-fade pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-2xl bg-gradient-to-t from-white via-white/80 to-transparent transition-opacity duration-200 ease-out dark:from-gray-800 dark:via-gray-800/80 {hasContentBelow ? 'opacity-100' : 'opacity-0'}"
        ></div>
      {/if}
    </div>

    <!-- Footer (outside scrollable pane) -->
    {#if !submitted}
      <div class="flex items-center justify-between gap-2 w-full">
        <button
          on:click={close}
          class="font-bold py-3 px-8 rounded-full transition focus:outline-none bg-white dark:bg-gray-800 midnight:!bg-black midnight:!border midnight:!border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Cancel
        </button>
        <div class="relative">
          <button
            on:click={handleSubmitClick}
            disabled={submitting}
            class="font-bold py-3 px-8 rounded-full transition focus:outline-none shadow-md shrink-0 {submitting || selected.size <= 1
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed opacity-50'
              : 'bg-gray-800 hover:bg-gray-900 dark:bg-gray-200 dark:hover:bg-gray-100 text-white dark:text-gray-900'}"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    {/if}
  </div>

  {#if disableToast}
    <div class="fixed left-1/2 bottom-8 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium shadow-xl transition-all">
      Please select at least one trade partner
    </div>
  {/if}
</div>
