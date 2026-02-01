<script>
  import CollapsibleTable from './CollapsibleTable.svelte';
  import LoadingTable from './LoadingTable.svelte';

  export let loading;
  export let sellTallyGifts = [];
  export let buyTallyGifts = [];
  export let sellTallyTrades = [];
  export let buyTallyTrades = [];
  export let makeTallyColumns;
  export let makeTallyRows;

  function copyToClipboard(data) {
    if (!data || data.length === 0) return;
    const names = data.map((item) => item[2]).join("\n");
    navigator.clipboard.writeText(names);
  }
</script>

<div id="tally-row" class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-4 mt-6">
{#each [
  { title: 'Gifts Sent', data: sellTallyGifts },
  { title: 'Gifts Received', data: buyTallyGifts },
  { title: 'Cards Sold', data: sellTallyTrades },
  { title: 'Cards Purchased', data: buyTallyTrades }
] as { title, data }}
  <div>
    {#if loading}
      <LoadingTable {title} content="Loading data..." />
    {:else}
      <CollapsibleTable
        {title}
        defaultRows={10}
        increment={10}
        columns={makeTallyColumns(data)}
        rows={makeTallyRows(data)}
        onCopy={() => copyToClipboard(data)}
      />
    {/if}
  </div>
{/each}
</div>