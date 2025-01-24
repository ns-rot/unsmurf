<script>  
    export let title = '';
    export let columns = [];
    export let rows = [];
    export let defaultRows = 25;
    export let increment = 25;
  
    // how many rows are currently visible
    let visibleCount = defaultRows;
  
    // Ensure visibleCount does not exceed rows.length
    $: visibleCount = Math.min(visibleCount, rows.length);
  
    function showMore() {
      visibleCount = Math.min(visibleCount + increment, rows.length);
    }
  
    function collapse() {
      visibleCount = defaultRows;
    }
  </script>
  
  <!-- Optional Title -->
  {#if title}
    <h2 class="text-xl font-semibold font-inter mt-2 mb-2">
      {title}
    </h2>
  {/if}
  
<!-- Table -->
<table class="w-full border-separate mb-3 text-left tabular-nums border-spacing-0">
<!-- Table Header -->
<thead>
  <tr>
    {#each columns as col, index}
    <th
      class={`px-1.5 py-2 bg-black text-white font-medium align-top ${index === 0 ? 'rounded-tl-md rounded-bl-md' : ''} 
      ${index === columns.length - 1 ? 'rounded-tr-md rounded-br-md' : ''} text-${col.alignment || 'left'}`}
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
              ${columns[cellIndex]?.alignment === 'left' ? 'text-left' : ''} 
              ${columns[cellIndex]?.alignment === 'center' ? 'text-center' : ''} 
              ${columns[cellIndex]?.alignment === 'right' ? 'text-right' : ''} 
              ${columns[cellIndex]?.styles?.join(' ') || ''} 
              ${typeof cell === 'object' ? cell.class : ''}`}
            on:click={(e) => cell.onClick(e)}
          >
            {@html typeof cell === 'object' ? cell.value : cell}
          </td>
        {:else}
          <!-- Render <td> without on:click -->
          <td
            class={`px-1.5 py-1 align-top border-b border-gray-300 
              ${columns[cellIndex]?.alignment === 'left' ? 'text-left' : ''} 
              ${columns[cellIndex]?.alignment === 'center' ? 'text-center' : ''} 
              ${columns[cellIndex]?.alignment === 'right' ? 'text-right' : ''} 
              ${columns[cellIndex]?.styles?.join(' ') || ''} 
              ${typeof cell === 'object' ? cell.class : ''}`}
          >
            {@html typeof cell === 'object' ? cell.value : cell}
          </td>
        {/if}
      {/each}
    </tr>
  {/each}
</tbody>

  </table>
  
  
  <!-- Toggle Buttons -->
  <div class="flex justify-end items-center gap-2 mb-2">
    <!-- Always show the row count -->
    <span class="text-sm text-gray-600">
      showing {visibleCount}/{rows.length} rows
    </span>
  
    <!-- Conditionally show More/Collapse -->
    {#if rows.length > defaultRows}
      {#if visibleCount < rows.length}
        <button
          on:click={showMore}
          aria-label="Show More"
          class="bg-blue-500 text-white font-bold p-2 size-10
                 rounded-full hover:bg-blue-600 focus:outline-none
                 focus:ring focus:ring-blue-300 transition"
        >
          ▼
        </button>
      {/if}
  
      {#if visibleCount > defaultRows}
        <button
          on:click={collapse}
          aria-label="Collapse"
          class="bg-blue-500 text-white font-bold p-2 size-10
                 rounded-full hover:bg-blue-600 focus:outline-none
                 focus:ring focus:ring-blue-300 transition"
        >
          ▲
        </button>
      {/if}
    {/if}
  </div>
