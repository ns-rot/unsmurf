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
    <h2 class="text-xl font-semibold font-inter mt-2 mb-2">
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
            class={`px-1.5 py-2 bg-black text-white font-medium align-top ${index === 0 ? "rounded-tl-md rounded-bl-md" : ""} 
      ${index === columns.length - 1 ? "rounded-tr-md rounded-br-md" : ""} text-${col.alignment || "left"}`}
          >
            {col.label}
          </th>
        {/each}
      </tr>
    </thead>

    <!-- Table Body -->
    <tbody>
      {#each rows.slice(0, visibleCount) as row}
        <tr class="bg-white hover:bg-gray-100 transition">
          {#each row as cell, cellIndex}
            {#if cell.onClick}
              <!-- Render <td> with on:click -->
              <td
                class={`px-1.5 py-1 align-top border-b border-gray-300 
              ${columns[cellIndex]?.alignment === "left" ? "text-left" : ""} 
              ${columns[cellIndex]?.alignment === "center" ? "text-center" : ""} 
              ${columns[cellIndex]?.alignment === "right" ? "text-right" : ""} 
              ${columns[cellIndex]?.styles?.join(" ") || ""} 
              ${typeof cell === "object" ? cell.class : ""}`}
                on:click={(e) => cell.onClick(e)}
              >
                {@html typeof cell === "object" ? cell.value : cell}
              </td>
            {:else}
              <!-- Render <td> without on:click -->
              <td
                class={`px-1.5 py-1 align-top border-b border-gray-300 
              ${columns[cellIndex]?.alignment === "left" ? "text-left" : ""} 
              ${columns[cellIndex]?.alignment === "center" ? "text-center" : ""} 
              ${columns[cellIndex]?.alignment === "right" ? "text-right" : ""} 
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
    <span class="text-sm text-gray-600">
      showing {visibleCount}/{rows.length} rows
    </span>

    <!-- Conditionally show More/Collapse -->
    {#if rows.length > defaultRows}
      <!-- Show More Button -->
      {#if visibleCount < rows.length}
        <button
          on:click={showMore}
          aria-label="Show More"
          class="bg-blue-500 text-white size-6
            rounded-full hover:bg-blue-600 focus:outline-none
            focus:ring focus:ring-blue-300 transition flex items-center justify-center"
        >
          <img src="./icons/arrow_down.svg" alt="Show More" class="size-5" />
        </button>
      {/if}
      <!-- Show All Button -->
      {#if visibleCount + defaultRows < rows.length}
        <button
          on:click={showAll}
          aria-label="Show All"
          class="bg-blue-500 text-white size-6
            rounded-full hover:bg-blue-600 focus:outline-none
            focus:ring focus:ring-blue-300 transition flex items-center justify-center"
        >
          <img src="./icons/arrows_down.svg" alt="Show More" class="size-5" />
        </button>
      {/if}
      <!-- Collapse Button -->
      {#if visibleCount > defaultRows}
        <button
          on:click={collapse}
          aria-label="Collapse"
          class="bg-blue-500 text-white size-6
            rounded-full hover:bg-blue-600 focus:outline-none
            focus:ring focus:ring-blue-300 transition flex items-center justify-center"
        >
          <img
            src="./icons/arrows_down.svg"
            alt="Collapse"
            class="size-5 transform rotate-180"
          />
        </button>
      {/if}
    {/if}


    {#if onCopy}
      <button
        on:click={onCopy}
        aria-label="Copy List"
        title="Copy List"
        class="bg-blue-500 text-white size-6
          rounded-full hover:bg-blue-600 focus:outline-none
          focus:ring focus:ring-blue-300 transition flex items-center justify-center ml-1"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="size-4"
        >
          <path
            d="M7.5 7.5A2.25 2.25 0 0 1 9.75 5.25h8.5a2.25 2.25 0 0 1 2.25 2.25v8.5a2.25 2.25 0 0 1-2.25 2.25h-8.5a2.25 2.25 0 0 1-2.25-2.25v-8.5Z"
          />
          <path
            d="M3.75 9.75a2.25 2.25 0 0 1 2.25-2.25H6.75v8.5a3.75 3.75 0 0 0 3.75 3.75h8.5v.75a2.25 2.25 0 0 1-2.25 2.25h-8.5a2.25 2.25 0 0 1-2.25-2.25v-8.5Z"
          />
        </svg>
      </button>
    {/if}
  </div>
</div>
