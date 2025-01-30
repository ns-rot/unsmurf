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
</script>

<div id="tally-row" class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 :gap-4">
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
      />
    {/if}
  </div>
{/each}
</div>