<script>
  import { onMount, tick } from "svelte";
  import { isNationCurrent, countActivePuppets, findPuppetmaster, puppetMasterCache } from "./sheetFetch.js";
  import { canonicalizeName, createNaturalCompare, classicNaturalCompare } from "./settingsUtils.js";
  import { getNationLink } from "./dataUtils.js";
  import { settingsStore } from "./settingsStore.js";

  // Props
  export let nationName = "";
  export let puppetCount = 0;
  export let puppetList = [];
  export let onClose = () => {};

  // Sort state: 0 = Alphabetical, 1 = Active First, 2 = CTE First
  let sortMode = 0;

  const palette = [
    "bg-[rgb(0,114,178)]",   // Blue
    "bg-[rgb(213,94,0)]",    // Orange
    "bg-[rgb(0,158,115)]",   // Green
    "bg-[rgb(204,121,167)]", // Purple/Pink
    "bg-[rgb(230,159,0)]",   // Yellow
    "bg-[rgb(86,180,233)]",  // Light Blue
    "bg-[rgb(240,228,66)]",  // Light Yellow
    "bg-[rgb(0,0,0)]",       // Black
  ];

  // Dynamically build color mapping from actual sheet names in cache
  function buildSourceColors() {
    if (!puppetMasterCache) return { default: "bg-gray-500" };
    const sheets = new Set();
    for (const e of Object.values(puppetMasterCache)) {
      (e?.sheets || [e?.sheet]).filter(Boolean).forEach(s => sheets.add(s.toLowerCase()));
    }
    const colors = {};
    [...sheets].forEach((sheet, i) => {
      colors[sheet] = palette[i % palette.length];
    });
    colors.default = "bg-gray-500";
    return colors;
  }

  // Reactive source colors - updates when cache is loaded
  $: sourceColors = buildSourceColors();

  function getSourceSheets(puppet) {
    if (!$settingsStore.showSource) return [];
    const entry = findPuppetmaster(canonicalizeName(puppet));
    if (!entry || entry.sheets.length === 0) return [];
    return [...new Set(entry.sheets.map(s => s?.toLowerCase()).filter(Boolean))];
  }

  function toggleSort() {
    sortMode = (sortMode + 1) % 3;
  }

  let sortCmp = null;
  $: sortCmp = $settingsStore.sortMode === 'context' ? createNaturalCompare(puppetList)
    : $settingsStore.sortMode === 'natural' ? classicNaturalCompare
    : null;

  // Sort puppets
  $: sortedPuppetList = (() => {
    const cmp = sortCmp;
    return [...puppetList].sort((a, b) => {
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
      // Default / Tie-breaker
      return cmp ? cmp(a, b) : a.localeCompare(b);
    });
  })();

  // Count active (non-CTE) puppets
  $: activePuppetCount = countActivePuppets(puppetList);

  // Unique sources in current puppet list for dynamic legend
  $: usedSources = [...new Set(sortedPuppetList.flatMap(p => getSourceSheets(p)).filter(Boolean))];

  function getSortTitle(mode) {
    if (mode === 1) return "Sorting by Status (Active First)";
    if (mode === 2) return "Sorting by Status (CTE First)";
    return "Sorting Alphabetically";
  }

  let scrollContainer;
  let containerHeight = 0;
  let windowWidth = 0;

  const ROW_HEIGHT = 40;

  $: numColumns = (() => {
    if (windowWidth >= 1280) return 6; // xl
    if (windowWidth >= 1024) return 5; // lg
    if (windowWidth >= 768) return 4; // md
    if (windowWidth >= 640) return 3; // sm
    return 2; // default
  })();

  $: seekSections = (() => {
    if (sortedPuppetList.length === 0 || !containerHeight) return [];

    function ch1(s) {
      if ($settingsStore.sortMode === 'context' && sortCmp) {
        const stem = sortCmp.getStem(s);
        return stem ? stem.charAt(0).toUpperCase() : s.charAt(0).toUpperCase();
      }
      return s.charAt(0).toUpperCase();
    }

    function ch2(s) {
      if ($settingsStore.sortMode === 'context' && sortCmp) {
        const stem = sortCmp.getStem(s);
        return stem.length > 1 ? stem.charAt(1).toUpperCase() : "";
      }
      return s.length > 1 ? s.charAt(1).toUpperCase() : "";
    }

    const availableHeight = containerHeight - 40;
    const LABEL_HEIGHT = 14;
    const maxTicks = Math.floor(availableHeight / LABEL_HEIGHT);

    if (maxTicks < 3) return [];

    const totalItems = sortedPuppetList.length;

    function getGroup(p, mode) {
      if (mode === 0) return "All";
      const active = isNationCurrent(p);
      if (mode === 1) return active ? "Active" : "CTE";
      return active ? "CTE" : "Active";
    }

    const headerCounts = new Map();
    for (let j = 0; j < totalItems; j++) {
      const item = sortedPuppetList[j];
      if (!item) continue;
      const g = getGroup(item, sortMode);
      const c = ch1(item);
      const key = g + "|" + c;
      headerCounts.set(key, (headerCounts.get(key) || 0) + 1);
    }

    const THRESHOLD = Math.ceil(totalItems * 0.02);

    function isSignificant(g, c) {
      return (headerCounts.get(g + "|" + c) || 0) >= THRESHOLD;
    }

    let targetSize = Math.max(1, Math.floor(totalItems / maxTicks));

    let iterations = 0;
    while (iterations < 8) {
      let estimatedTicks = 0;
      headerCounts.forEach((count) => {
        estimatedTicks += count / targetSize;
      });
      estimatedTicks = Math.ceil(estimatedTicks * 1.1);
      if (estimatedTicks <= maxTicks) break;
      targetSize = Math.ceil(targetSize * 1.15);
      iterations++;
    }

    const collapsed = [];
    let sectionStart = 0;
    let sectionStartItem = sortedPuppetList[0];
    let sectionStartGroup = getGroup(sectionStartItem, sortMode);
    let lastChar1 = null;

    for (let i = 1; i < totalItems; i++) {
      const p = sortedPuppetList[i];
      const prevP = sortedPuppetList[i - 1];

      const currentGroup = getGroup(p, sortMode);
      const prevGroup = getGroup(prevP, sortMode);

      const currentChar1 = ch1(p);
      const prevChar1 = ch1(sortedPuppetList[sectionStart]);

      const currentChar2 = ch2(p);
      const prevChar2 = ch2(prevP);

      const currentCount = i - sectionStart;
      let shouldBreak = false;

      if (currentGroup !== prevGroup) {
        shouldBreak = true;
      } else if (currentChar1 !== prevChar1) {
        if (currentCount >= targetSize) {
          shouldBreak = true;
        } else if (isSignificant(currentGroup, currentChar1)) {
          shouldBreak = true;
        }
      } else if (currentChar2 !== prevChar2) {
        if (currentCount >= targetSize) {
          const orphanThreshold = Math.max(1, Math.floor(targetSize * 0.15));
          let subdivisionCount = 0;
          for (let k = i; k < totalItems; k++) {
            const nextP = sortedPuppetList[k];
            const nextGroup = getGroup(nextP, sortMode);
            const nextChar1 = ch1(nextP);
            const nextChar2 = ch2(nextP);

            if (nextGroup !== currentGroup || nextChar1 !== currentChar1) break;
            if (nextChar2 !== currentChar2) break;

            subdivisionCount++;
          }

          if (subdivisionCount > orphanThreshold) {
            shouldBreak = true;
          }
        }
      }

      if (shouldBreak) {
        const startP = sortedPuppetList[sectionStart];
        const startChar1 = ch1(startP);
        let label = startChar1;

        if (lastChar1 === startChar1) {
          const startChar2 = ch2(startP);
          label = startChar1 + startChar2;
        }

        collapsed.push({
          group: sectionStartGroup,
          label: label,
          startIndex: sectionStart,
          count: currentCount,
        });

        sectionStart = i;
        sectionStartItem = p;
        sectionStartGroup = currentGroup;
        lastChar1 = startChar1;
      }
    }

    const startP = sortedPuppetList[sectionStart];
    const startChar1 = ch1(startP);
    let label = startChar1;
    if (lastChar1 === startChar1) {
      const startChar2 = ch2(startP);
      label = startChar1 + startChar2;
    }

    collapsed.push({
      group: sectionStartGroup,
      label: label,
      startIndex: sectionStart,
      count: totalItems - sectionStart,
    });

    return collapsed;
  })();

  function scrollToSection(index) {
    if (index === undefined) return;
    const el = document.getElementById(`puppet-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }
</script>

<svelte:window bind:innerWidth={windowWidth} />

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
        <h2 class="text-xl font-semibold font-sans">
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
          class="sort-toggle w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none font-sans"
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

    <!-- Content area with scrollable flex container and sidebar -->
    <div class="flex-grow relative overflow-hidden flex">
      <div
        class="flex-grow pl-3 pr-14 py-4 sm:pl-4 sm:py-4 sm:pr-14 overflow-auto scroll-smooth"
        bind:this={scrollContainer}
        bind:clientHeight={containerHeight}
      >
        <!-- Full list rendering without virtualization -->
        <div class="w-full flex flex-wrap">
          {#each sortedPuppetList as puppet, i (puppet)}
            <div
              id="puppet-{i}"
              class="w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6 pb-2 text-left transition-colors whitespace-normal break-words overflow-hidden flex items-start pr-2"
              style="min-height: {ROW_HEIGHT}px;"
            >
              <span class="block w-full leading-tight flex items-start gap-1.5 min-w-0">
                {#if !isNationCurrent(canonicalizeName(puppet))}
                  <span
                    class="font-sans select-none text-red-600 dark:text-red-400 flex-shrink-0"
                    >&#xe000;</span
                  >
                {/if}
                {#if $settingsStore.showSource}
                  {@const srcs = getSourceSheets(puppet)}
                  {#if srcs.length > 0}
                    <span class="flex flex-shrink-0 gap-0.5 mt-1">
                      {#each srcs as s (s)}
                        <span class="w-2 h-2 rounded-full {sourceColors[s] || 'bg-gray-500'}" title="Data source: {s.charAt(0).toUpperCase() + s.slice(1)}"></span>
                      {/each}
                    </span>
                  {/if}
                {/if}
                <a
                  href={getNationLink(
                    puppet.replace(/cte/i, "").trim(),
                    "puppetPopup",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-nation="true"
                  data-nation-name={puppet.replace(/cte/i, "").trim()}
                  class="text-gray-900 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-400 no-underline hover:underline min-w-0 break-words"
                  style="overflow-wrap: anywhere; word-break: break-word;"
                >
                  {puppet}
                </a>
              </span>
            </div>
          {/each}
        </div>

        {#if $settingsStore.showSource && usedSources.length > 0}
          <!-- Legend for source colors -->
          <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 mr-12">
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Data Source Legend</p>
            <div class="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
              {#each usedSources as source}
                <span class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full {sourceColors[source] || 'bg-gray-500'}"></span>
                  {source.charAt(0).toUpperCase() + source.slice(1)}
                </span>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Disclaimer at bottom of list -->
        <div
          class="mt-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2 mr-12"
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
              href="https://raw.githubusercontent.com/ns-rot/unsmurf/refs/heads/data/static/puppetData.tsv"
              target="_blank"
              rel="noopener noreferrer"
              class="underline hover:text-gray-800 dark:hover:text-gray-200"
              >our sheet</a
            > by using <a href="https://forms.gle/DW4CMWAVQ3TDpj25A" target="_blank" rel="noopener noreferrer" class="underline hover:text-gray-800 dark:hover:text-gray-200">this form</a>.
          </p>
          <p>
            For any inaccuracies, please contact the respective sheet owner.
          </p>
        </div>
      </div>

      <!-- Enhanced Sidebar -->
      {#if seekSections.length > 0}
        <!-- Positioned right-3 to clear scrollbar but keep tight -->
        <div
          class="absolute right-3 top-2 bottom-2 w-9 flex flex-col items-center justify-center py-2 z-10 pointer-events-none"
        >
          <div
            class="pointer-events-auto bg-black/20 dark:bg-black/40 backdrop-blur-sm rounded-full py-1 px-1 flex flex-col items-center shadow-sm max-h-full overflow-hidden border border-transparent dark:border-gray-600"
          >
            {#each seekSections as section, i}
              <!-- Group Separator -->
              {#if i > 0 && section.group !== seekSections[i - 1].group}
                <div class="w-2 h-px bg-gray-400/50 my-1"></div>
              {/if}

              <div
                on:click|stopPropagation={() =>
                  scrollToSection(section.startIndex)}
                on:keydown={(e) =>
                  e.key === "Enter" && scrollToSection(section.startIndex)}
                tabindex="0"
                class="w-full text-center cursor-pointer hover:text-white text-gray-800 dark:text-gray-200 font-medium hover:font-bold transition-all select-none py-[1px] {section
                  .label.length > 1
                  ? 'text-[10px]'
                  : 'text-[11px]'}"
                role="button"
                aria-label="Scroll to {section.label}"
                style="font-family: 'Noto Sans Mono', sans-serif; font-variation-settings: 'wdth' {section
                  .label.length > 1
                  ? 70
                  : 100}; line-height: 1.1;"
              >
                {section.label.length > 5
                  ? section.label.substring(0, 4) + ".."
                  : section.label}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
