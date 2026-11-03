<script>
  import { onMount } from "svelte";
  import { settingsStore } from "./settingsStore";
  import {
    TABLE_FONT,
    TABLE_FONT_SMALL,
    TABLE_LINE_HEIGHT,
    TABLE_PAD_Y,
    TABLE_BORDER,
    lineCount,
    naturalWidth,
    ensureTableFonts,
  } from "./pretext";

  export let title = "";
  export let columns = [];
  export let rows = [];
  export let defaultRows = 25;
  export let increment = 25;
  export let onCopy = null;

  const OVERSCAN = 6;
  const HEADER_GAP = 8;
  const PAD_X = 24; // px-3 left + right

  let visibleCount = defaultRows;
  let containerWidth = 0;
  let tableWidth = 0;
  let colWidths = [];
  let totalHeight = 0;
  let topSpacer = 0;
  let bottomSpacer = 0;
  let visibleStart = 0;
  let visibleEnd = 0;
  let effectiveCount = 0;
  let visibleRows = [];
  let tableEl;
  let rootEl;
  let relativeDates = false;
  let fontsLoaded = false;
  let windowTimer = 0;

  $: relativeDates = $settingsStore?.dateFormat === "relative";
  $: if (containerWidth > 0 && fontsLoaded) {
    rebuild(containerWidth, rows, columns, visibleCount);
  }

  // Metrics live outside Svelte's reactive graph. Pretext handles are opaque
  // objects and row arrays can be large; keeping them in component state would
  // make Svelte proxy/probe them unnecessarily.
  const metricsToken = {};
  const metricsStore = new WeakMap();

  function getMetrics() {
    let m = metricsStore.get(metricsToken);
    if (!m) {
      m = {
        rowsRef: null,
        columnsRef: null,
        blocks: [],
        natural: [],
        heights: new Int32Array(0),
        offsets: new Float64Array(1),
        widths: [],
        count: 0,
      };
      metricsStore.set(metricsToken, m);
    }
    return m;
  }

  const NAMED_ENTITIES = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00A0",
    shy: "\u00AD",
  };

  function decodeEntities(text) {
    return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity) => {
      if (entity[0] === "#") {
        const hex = entity[1]?.toLowerCase() === "x";
        const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    });
  }

  function extractText(value) {
    let html = String(value ?? "");
    // Hidden blocks and the inactive date format never contribute to layout.
    html = html.replace(
      /<(span|div)[^>]*class="[^"]*(?:hidden|date-relative)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi,
      ""
    );
    html = html.replace(/<br\s*\/?>/gi, " ");
    html = html.replace(/<[^>]*>/g, "");
    html = decodeEntities(html);
    // Browsers collapse ASCII whitespace in normal white-space mode; keep
    // non-ASCII spaces such as the icon font's thin space.
    return html.replace(/[ \t\r\n]+/g, " ").trim();
  }

  function buildCell(cell, column) {
    const value = typeof cell === "object" && cell !== null ? cell.value : cell;
    const nowrap = !!column?.nowrap;
    if (nowrap) {
      // Date cells hold both formats; measure the wider one so toggling the
      // date format cannot overflow a nowrap column.
      const blocks = [];
      const html = String(value ?? "");
      const datePattern =
        /<span[^>]*class="[^"]*date-(formatted|relative)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
      let match;
      while ((match = datePattern.exec(html))) {
        blocks.push({ text: extractText(match[2]), font: TABLE_FONT });
      }
      if (!blocks.length) blocks.push({ text: extractText(html), font: TABLE_FONT });
      return { nowrap, blocks };
    }
    const parts = String(value ?? "").split(/<br\s*\/?>/i);
    return {
      nowrap,
      blocks: parts.map((part) => ({
        text: extractText(part),
        font: /text-sm|text-\[13px\]/i.test(part) ? TABLE_FONT_SMALL : TABLE_FONT,
      })),
    };
  }

  function getMinWidth(column) {
    const styles = column?.styles ?? [];
    let ch = 0;
    for (const style of styles) {
      const match = /min-w-\[(\d+(?:\.\d+)?)ch\]/.exec(style);
      if (match) ch = Math.max(ch, parseFloat(match[1]));
    }
    const chWidth = Math.max(8, naturalWidth("0", TABLE_FONT));
    return ch > 0 ? ch * chWidth + PAD_X : 48;
  }

  function measureCellNatural(cell) {
    let width = 0;
    for (const block of cell.blocks) {
      width = Math.max(width, naturalWidth(block.text, block.font));
    }
    if (cell.nowrap) {
      // Pretext cannot express tabular-nums; price/date columns use it for
      // alignment, so reserve the measured width plus a small digit margin.
      width = width * 1.08 + 2;
    }
    return width + PAD_X;
  }

  function ensureTypedArray(current, length, Ctor) {
    return current.length === length ? current : new Ctor(length);
  }

  function computeWidths(count, m) {
    const available = Math.max(containerWidth, 1);
    m.natural.fill(0);

    for (let i = 0; i < count; i++) {
      const cells = m.blocks[i];
      for (let ci = 0; ci < cells.length; ci++) {
        if (!columns[ci]?.nowrap) continue;
        const width = measureCellNatural(cells[ci]);
        if (width > m.natural[ci]) m.natural[ci] = width;
      }
    }

    const nowrapBase = columns.map((column, ci) =>
      column?.nowrap ? Math.max(m.natural[ci] || 0, 64) : 0
    );
    const nowrapTotal = nowrapBase.reduce((sum, w) => sum + w, 0);
    const wrappingCount = columns.filter((column) => !column?.nowrap).length;
    const remaining = Math.max(0, available - nowrapTotal);
    const perWrapping = wrappingCount > 0 ? remaining / wrappingCount : 0;

    const base = columns.map((column, ci) => {
      if (column?.nowrap) return nowrapBase[ci];
      // Prefer the 6ch minimum, but shrink it when the container is narrow so
      // the table fits instead of always forcing a horizontal scrollbar. Keep
      // at least 48px of content so narrow layouts stay readable.
      return Math.max(72, Math.min(getMinWidth(column), perWrapping || 72));
    });
    const baseTotal = base.reduce((sum, w) => sum + w, 0);
    const extra = available - baseTotal;
    const flex = columns.map((column) => (column?.nowrap ? 0 : (column?.weight ?? 1)));
    const flexTotal = flex.reduce((sum, w) => sum + w, 0);

    const widths = base.slice();
    if (extra > 0) {
      if (flexTotal > 0) {
        for (let i = 0; i < widths.length; i++) widths[i] += (extra * flex[i]) / flexTotal;
      } else {
        const share = extra / Math.max(1, widths.length);
        for (let i = 0; i < widths.length; i++) widths[i] += share;
      }
    }

    let rounded = widths.map((w) => Math.max(24, Math.round(w * 4) / 4));
    let total = rounded.reduce((sum, w) => sum + w, 0);
    // Quarter-pixel rounding can leave a sub-pixel horizontal scrollbar, or a
    // sub-pixel gap that the browser would silently distribute.
    if (total > available && total - available < 1) {
      const idx = columns.findIndex((column) => !column?.nowrap);
      if (idx >= 0) {
        rounded[idx] = Math.max(24, rounded[idx] - (total - available));
        total = rounded.reduce((sum, w) => sum + w, 0);
      }
    } else if (total < available && total > 0) {
      const idx = columns.findIndex((column) => !column?.nowrap);
      const target = idx >= 0 ? idx : rounded.length - 1;
      rounded[target] += available - total;
    }
    return rounded;
  }

  function rebuild(width, nextRows, nextColumns, nextVisibleCount) {
    if (!width || width <= 0) return;

    const m = getMetrics();
    const count = Math.min(Math.max(0, nextVisibleCount | 0), nextRows.length);

    if (m.rowsRef !== nextRows || m.columnsRef !== nextColumns) {
      m.rowsRef = nextRows;
      m.columnsRef = nextColumns;
      m.blocks = [];
      m.natural = nextColumns.map(() => 0);
      m.heights = new Int32Array(0);
      m.offsets = new Float64Array(1);
      m.widths = [];
      m.count = 0;
    }

    for (let i = m.blocks.length; i < count; i++) {
      const row = nextRows[i] ?? [];
      m.blocks[i] = row.map((cell, ci) => buildCell(cell, nextColumns[ci]));
    }

    const widths = computeWidths(count, m);
    m.widths = widths;
    m.count = count;
    m.heights = ensureTypedArray(m.heights, count, Int32Array);
    m.offsets = ensureTypedArray(m.offsets, count + 1, Float64Array);
    m.offsets[0] = 0;
    let offset = 0;
    for (let i = 0; i < count; i++) {
      let maxLines = 1;
      const cells = m.blocks[i];
      for (let ci = 0; ci < cells.length; ci++) {
        if (columns[ci]?.nowrap) continue;
        const contentWidth = Math.max(1, widths[ci] - PAD_X);
        let lines = 0;
        for (const block of cells[ci].blocks) {
          lines += lineCount(block.text, block.font, contentWidth, TABLE_LINE_HEIGHT);
        }
        if (lines > maxLines) maxLines = lines;
      }
      const height = maxLines * TABLE_LINE_HEIGHT + TABLE_PAD_Y + TABLE_BORDER;
      m.heights[i] = height;
      offset += height;
      m.offsets[i + 1] = offset;
    }

    effectiveCount = count;
    colWidths = widths;
    tableWidth = Math.max(
      width,
      widths.reduce((sum, w) => sum + w, 0)
    );
    totalHeight = offset;
    updateWindow(true);
  }

  function lowerBound(value, count, offsets) {
    let lo = 0;
    let hi = count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] < value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function updateWindow(force = false) {
    if (!tableEl) return;
    const m = getMetrics();
    const count = effectiveCount;
    if (count === 0) {
      if (force || visibleRows.length) {
        visibleStart = 0;
        visibleEnd = 0;
        visibleRows = [];
        topSpacer = 0;
        bottomSpacer = 0;
      }
      return;
    }

    const tableRect = tableEl.getBoundingClientRect();
    const headerHeight = tableEl.tHead?.getBoundingClientRect().height ?? 0;
    const bodyTop = tableRect.top + headerHeight + HEADER_GAP;
    const viewTop = Math.max(0, -bodyTop);
    const viewBottom = Math.min(totalHeight, window.innerHeight - bodyTop);

    let start;
    let end;

    if (viewBottom <= 0 || viewTop >= totalHeight) {
      if (tableRect.bottom < 0) {
        end = count;
        start = Math.max(0, count - OVERSCAN);
      } else {
        start = 0;
        end = Math.min(count, OVERSCAN);
      }
    } else {
      start = lowerBound(viewTop, count, m.offsets);
      if (start > 0 && m.offsets[start] > viewTop) start--;
      end = lowerBound(viewBottom, count, m.offsets);
      if (end < count) end++;
      start = Math.max(0, start - OVERSCAN);
      end = Math.min(count, end + OVERSCAN);
    }

    if (!force && start === visibleStart && end === visibleEnd) return;

    visibleStart = start;
    visibleEnd = end;
    topSpacer = m.offsets[start];
    bottomSpacer = m.offsets[count] - m.offsets[end];
    visibleRows = rows.slice(start, end).map((row, i) => ({
      row,
      index: start + i,
      height: m.heights[start + i],
    }));
  }

  function scheduleWindow() {
    if (windowTimer) return;
    windowTimer = setTimeout(() => {
      windowTimer = 0;
      updateWindow(false);
    }, 0);
  }

  function showMore() {
    visibleCount = Math.min(visibleCount + increment, rows.length);
  }

  function showAll() {
    visibleCount = rows.length;
  }

  function collapse() {
    visibleCount = defaultRows;
  }

  function onToggleDateFormat() {
    relativeDates = !relativeDates;
  }

  function handleCopy(event) {
    if (typeof window === "undefined" || !event.clipboardData) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const toElement = (node) =>
      node?.nodeType === 1 ? node : node?.parentElement ?? null;
    const start = toElement(range.startContainer);
    const end = toElement(range.endContainer);

    // Selecting a nation link itself copies just that nation's canonical name.
    const directLink = start?.closest?.("[data-nation-name]");
    if (
      directLink &&
      directLink.contains(range.startContainer) &&
      directLink.contains(range.endContainer)
    ) {
      const source = directLink.getAttribute("data-nation-name");
      if (source) {
        event.clipboardData.setData("text/plain", source);
        event.preventDefault();
        return;
      }
    }

    // A single-cell selection can use the canonical value attached by the row
    // builder, independently of the display formatting and break markers.
    const startCell = start?.closest?.("td");
    const endCell = end?.closest?.("td");
    if (startCell && startCell === endCell) {
      const copy = startCell.getAttribute("data-copy");
      if (copy != null) {
        event.clipboardData.setData("text/plain", copy);
        event.preventDefault();
        return;
      }
    }

    let link = null;
    // A whole-cell selection starts at the <td>, not inside the <a>. If the
    // cell holds exactly one nation link (possibly with select-none decoration
    // such as the CTE icon or a tally count), copy the canonical nation name.
    if (!link) {
      const cell = startCell ?? endCell;
      if (
        cell &&
        cell.contains(range.startContainer) &&
        cell.contains(range.endContainer)
      ) {
        const links = [...cell.querySelectorAll("[data-nation-name]")];
        if (links.length === 1) link = links[0];
      }
    }

    if (!link) return;
    const source = link.getAttribute("data-nation-name");
    if (!source) return;
    event.clipboardData.setData("text/plain", source);
    event.preventDefault();
  }

  onMount(() => {
    containerWidth = rootEl?.clientWidth || rootEl?.getBoundingClientRect().width || 0;
    const sample = (rows ?? [])
      .slice(0, 30)
      .map((row) => row.map((cell) => (typeof cell === "object" ? cell.value : cell)).join(" "))
      .join(" ")
      .replace(/<[^>]*>/g, " ")
      .slice(0, 4000);
    let cancelled = false;

    ensureTableFonts(sample)
      .then(() => {
        if (cancelled) return;
        fontsLoaded = true;
        // The reactive rebuild runs when fontsLoaded flips.
      })
      .catch(() => {
        if (!cancelled) fontsLoaded = true;
      });

    const onWindowEvent = () => scheduleWindow();
    let lastWidth = containerWidth;
    const onResize = () => {
      const width = rootEl?.clientWidth || 0;
      if (width > 0 && width !== containerWidth) {
        containerWidth = width;
        lastWidth = width;
      }
      scheduleWindow();
    };
    window.addEventListener("scroll", onWindowEvent, { passive: true });
    window.addEventListener("resize", onResize);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? rootEl?.clientWidth ?? 0;
      if (width <= 0 || Math.abs(width - lastWidth) < 0.5) return;
      lastWidth = width;
      containerWidth = width;
    });
    if (rootEl) observer.observe(rootEl);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("scroll", onWindowEvent);
      window.removeEventListener("resize", onResize);
      if (windowTimer) clearTimeout(windowTimer);
    };
  });
</script>

<div class="w-full overflow-hidden" bind:this={rootEl} on:copy={handleCopy}>
  <!-- Optional Title -->
  {#if title}
    <h2
      class="text-xl font-semibold font-sans mt-2 mb-2 text-gray-800 dark:text-gray-200"
    >
      {title}
    </h2>
  {/if}

  <!-- Table / horizontal scroll for very narrow containers -->
  <div class="overflow-x-auto">
    <table
      bind:this={tableEl}
      class="data-table border-separate mb-3 text-left border-spacing-0"
      class:show-relative={relativeDates}
      style={tableWidth ? `width:${tableWidth}px;table-layout:fixed` : "width:100%"}
      on:toggle-date-format={onToggleDateFormat}
    >
      <colgroup>
        {#each colWidths as width}
          <col style={`width:${width}px`} />
        {/each}
      </colgroup>

      <!-- Table Header -->
      <thead>
        <tr>
          {#each columns as col, index}
            <th
              class={`px-3 py-3 bg-gray-300 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-bold align-top 
              ${index === 0 ? "rounded-tl-lg rounded-bl-lg" : ""} 
              ${index === columns.length - 1 ? "rounded-tr-lg rounded-br-lg" : ""} text-${col.alignment || "left"}`}
            >
              {col.label}
            </th>
          {/each}
        </tr>
      </thead>

      <!-- Table Body -->
      <tbody>
        <!-- Gap between header and the virtualized body -->
        <tr class="table-spacer-row bg-transparent border-none" aria-hidden="true">
          <td colspan={columns.length} style={`height:${HEADER_GAP}px`}></td>
        </tr>

        <!-- Rows above the visible window -->
        <tr class="table-spacer-row bg-transparent border-none" aria-hidden="true">
          <td colspan={columns.length} style={`height:${topSpacer}px`}></td>
        </tr>

        {#each visibleRows as { row, index, height } (index)}
          <tr class="group transition" style={`height:${height}px`}>
            {#each row as cell, cellIndex}
              <!-- Common classes for background, border, and rounding -->
              {#if cell.onClick}
                <td
                  data-copy={typeof cell === "object" ? cell.copy : undefined}
                  class={`px-3 py-1.5 align-top transition
                    ${
                      typeof cell === "object" &&
                      cell.class?.includes("bg-rarity")
                        ? "group-hover:brightness-95 dark:group-hover:brightness-110"
                        : "bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700"
                    } 
                    ${index === effectiveCount - 1 ? "" : "border-b border-gray-100 dark:border-gray-700"}
                    ${columns[cellIndex]?.alignment === "left" ? "text-left" : ""} 
                    ${columns[cellIndex]?.alignment === "center" ? "text-center" : ""} 
                    ${columns[cellIndex]?.alignment === "right" ? "text-right" : ""} 
                    ${index === 0 && cellIndex === 0 ? "rounded-tl-lg" : ""}
                    ${index === 0 && cellIndex === row.length - 1 ? "rounded-tr-lg" : ""}
                    ${index === effectiveCount - 1 && cellIndex === 0 ? "rounded-bl-lg" : ""}
                    ${index === effectiveCount - 1 && cellIndex === row.length - 1 ? "rounded-br-lg" : ""}
                    ${columns[cellIndex]?.nowrap ? "tabular-nums whitespace-nowrap" : ""}
                    ${columns[cellIndex]?.styles?.join(" ") || ""} 
                    ${typeof cell === "object" ? cell.class : ""}`}
                  on:click={(e) => cell.onClick(e)}
                >
                  {@html typeof cell === "object" ? cell.value : cell}
                </td>
              {:else}
                <td
                  data-copy={typeof cell === "object" ? cell.copy : undefined}
                  class={`px-3 py-1.5 align-top transition
                    ${
                      typeof cell === "object" &&
                      cell.class?.includes("bg-rarity")
                        ? "group-hover:brightness-95 dark:group-hover:brightness-110"
                        : "bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700"
                    } 
                    ${index === effectiveCount - 1 ? "" : "border-b border-gray-100 dark:border-gray-700"}
                    ${columns[cellIndex]?.alignment === "left" ? "text-left" : ""} 
                    ${columns[cellIndex]?.alignment === "center" ? "text-center" : ""} 
                    ${columns[cellIndex]?.alignment === "right" ? "text-right" : ""} 
                    ${index === 0 && cellIndex === 0 ? "rounded-tl-lg" : ""}
                    ${index === 0 && cellIndex === row.length - 1 ? "rounded-tr-lg" : ""}
                    ${index === effectiveCount - 1 && cellIndex === 0 ? "rounded-bl-lg" : ""}
                    ${index === effectiveCount - 1 && cellIndex === row.length - 1 ? "rounded-br-lg" : ""}
                    ${columns[cellIndex]?.nowrap ? "tabular-nums whitespace-nowrap" : ""}
                    ${columns[cellIndex]?.styles?.join(" ") || ""} 
                    ${typeof cell === "object" ? cell.class : ""}`}
                >
                  {@html typeof cell === "object" ? cell.value : cell}
                </td>
              {/if}
            {/each}
          </tr>
        {/each}

        <!-- Rows below the visible window -->
        <tr class="table-spacer-row bg-transparent border-none" aria-hidden="true">
          <td colspan={columns.length} style={`height:${bottomSpacer}px`}></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Toggle Buttons -->
  <div class="flex justify-end items-center gap-1">
    <!-- Always show the row count -->
    <span class="text-sm text-gray-600 dark:text-gray-400">
      showing {Math.min(visibleCount, rows.length)}/{rows.length} rows
    </span>

    <!-- Conditionally show More/Collapse -->
    {#if rows.length > defaultRows}
      <!-- Show More Button -->
      {#if visibleCount < rows.length}
        <button
          on:click={showMore}
          aria-label="Show More"
          class="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 size-6
            rounded-full hover:bg-gray-900 dark:hover:bg-gray-100 focus:outline-none
            transition flex items-center justify-center"
        >
          <img src="./icons/arrow_down.svg" alt="Show More" class="size-5 dark:invert" />
        </button>
      {/if}
      <!-- Show All Button -->
      {#if visibleCount + defaultRows < rows.length}
        <button
          on:click={showAll}
          aria-label="Show All"
          class="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 size-6
            rounded-full hover:bg-gray-900 dark:hover:bg-gray-100 focus:outline-none
            transition flex items-center justify-center"
        >
          <img src="./icons/arrows_down.svg" alt="Show More" class="size-5 dark:invert" />
        </button>
      {/if}
      <!-- Collapse Button -->
      {#if visibleCount > defaultRows}
        <button
          on:click={collapse}
          aria-label="Collapse"
          class="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 size-6
            rounded-full hover:bg-gray-900 dark:hover:bg-gray-100 focus:outline-none
            transition flex items-center justify-center"
        >
          <img
            src="./icons/arrows_down.svg"
            alt="Collapse"
            class="size-5 transform rotate-180 dark:invert"
          />
        </button>
      {/if}
    {/if}

    {#if onCopy}
      <button
        on:click={onCopy}
        aria-label="Copy List"
        title="Copy List"
        class="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 size-6
          rounded-full hover:bg-gray-900 dark:hover:bg-gray-100 focus:outline-none
          transition flex items-center justify-center ml-1"
      >
        <img src="./icons/copy.svg" alt="Copy List" class="size-4 dark:invert" />
      </button>
    {/if}
  </div>
</div>
