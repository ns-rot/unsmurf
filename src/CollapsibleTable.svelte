<script>
  export let title = "";
  export let columns = [];
  export let rows = [];
  export let defaultRows = 25;
  export let increment = 25;
  export let onCopy = null;

  // how many rows are currently visible
  let visibleCount = defaultRows;

  // Ensure visibleCount does not exceed rows.length
  $: visibleCount = Math.min(visibleCount, rows.length);

  function showMore() {
    visibleCount = Math.min(visibleCount + increment, rows.length);
  }

  function showAll() {
    visibleCount = rows.length;
  }

  function collapse() {
    visibleCount = defaultRows;
  }
</script>

<div class="w-full overflow-hidden">
  <!-- Optional Title -->
  {#if title}
    <h2
      class="text-xl font-semibold font-inter mt-2 mb-2 text-gray-800 dark:text-gray-200"
    >
      {title}
    </h2>
  {/if}

  <!-- Table -->
  <table
    class="w-full border-separate mb-3 text-left tabular-nums border-spacing-0"
  >
    <!-- Table Header -->
    <thead>
      <tr>
        {#each columns as col, index}
          <th
            class={`px-3 py-3 bg-gray-300 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-bold align-top 
            border-b-4 border-gray-50 dark:border-gray-900 
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
      <!-- Spacer row to create gap between header and body -->
      <tr
        class="table-spacer-row bg-transparent border-none"
        aria-hidden="true"
      >
        <td colspan={columns.length} class="p-0 border-none">&nbsp;</td>
      </tr>
      {#each rows.slice(0, visibleCount) as row, rowIndex}
        <tr class="group transition">
          {#each row as cell, cellIndex}
            <!-- Common classes for background, border, and rounding -->
            {#if cell.onClick}
              <td
                class={`px-3 py-1.5 align-top transition
                  ${
                    typeof cell === "object" &&
                    cell.class?.includes("bg-rarity")
                      ? "group-hover:brightness-95 dark:group-hover:brightness-110"
                      : "bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700"
                  } 
                  ${rowIndex === visibleCount - 1 ? "" : "border-b border-gray-100 dark:border-gray-700"}
                  ${columns[cellIndex]?.alignment === "left" ? "text-left" : ""} 
                  ${columns[cellIndex]?.alignment === "center" ? "text-center" : ""} 
                  ${columns[cellIndex]?.alignment === "right" ? "text-right" : ""} 
                  ${rowIndex === 0 && cellIndex === 0 ? "rounded-tl-lg" : ""}
                  ${rowIndex === 0 && cellIndex === row.length - 1 ? "rounded-tr-lg" : ""}
                  ${rowIndex === visibleCount - 1 && cellIndex === 0 ? "rounded-bl-lg" : ""}
                  ${rowIndex === visibleCount - 1 && cellIndex === row.length - 1 ? "rounded-br-lg" : ""}
                  ${columns[cellIndex]?.styles?.join(" ") || ""} 
                  ${typeof cell === "object" ? cell.class : ""}`}
                on:click={(e) => cell.onClick(e)}
              >
                {@html typeof cell === "object" ? cell.value : cell}
              </td>
            {:else}
              <td
                class={`px-3 py-1.5 align-top transition
                  ${
                    typeof cell === "object" &&
                    cell.class?.includes("bg-rarity")
                      ? "group-hover:brightness-95 dark:group-hover:brightness-110"
                      : "bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700"
                  } 
                  ${rowIndex === visibleCount - 1 ? "" : "border-b border-gray-100 dark:border-gray-700"}
                  ${columns[cellIndex]?.alignment === "left" ? "text-left" : ""} 
                  ${columns[cellIndex]?.alignment === "center" ? "text-center" : ""} 
                  ${columns[cellIndex]?.alignment === "right" ? "text-right" : ""} 
                  ${rowIndex === 0 && cellIndex === 0 ? "rounded-tl-lg" : ""}
                  ${rowIndex === 0 && cellIndex === row.length - 1 ? "rounded-tr-lg" : ""}
                  ${rowIndex === visibleCount - 1 && cellIndex === 0 ? "rounded-bl-lg" : ""}
                  ${rowIndex === visibleCount - 1 && cellIndex === row.length - 1 ? "rounded-br-lg" : ""}
                  ${columns[cellIndex]?.styles?.join(" ") || ""} 
                  ${typeof cell === "object" ? cell.class : ""}`}
              >
                {@html typeof cell === "object" ? cell.value : cell}
              </td>
            {/if}
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>

  <!-- Toggle Buttons -->
  <div class="flex justify-end items-center gap-1">
    <!-- Always show the row count -->
    <span class="text-sm text-gray-600 dark:text-gray-400">
      showing {visibleCount}/{rows.length} rows
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
