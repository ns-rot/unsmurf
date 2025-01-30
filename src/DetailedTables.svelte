<script>
  import CollapsibleTable from './CollapsibleTable.svelte';
  import LoadingTable from './LoadingTable.svelte';

  export let loading;
  export let buys = [];
  export let sells = [];
  export let makeTradeColumns;
  export let makeTradeRows;
  export let makeGiftColumns;
  export let makeGiftRows;
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-2.5 md:gap-4 mt-6">
  {#each [
    { title: 'Detailed Gifts Sent', columns: makeGiftColumns('buyer'), rows: makeGiftRows(sells, 'buyer') },
    { title: 'Detailed Gifts Received', columns: makeGiftColumns('seller'), rows: makeGiftRows(buys, 'seller') },
    { title: 'Detailed Cards Sold', columns: makeTradeColumns('buyer'), rows: makeTradeRows(sells, 'buyer') },
    { title: 'Detailed Cards Purchased', columns: makeTradeColumns('seller'), rows: makeTradeRows(buys, 'seller') }
  ] as { title, columns, rows }}
    <div>
      {#if loading}
        <LoadingTable {title} content="Loading data..." />
      {:else}
        <CollapsibleTable {title} {columns} {rows} defaultRows={25} increment={25} />
      {/if}
    </div>
  {/each}
</div>