<script>
	import './output.css'; // Tailwind CSS
	import { onMount } from 'svelte';
	import { settingsStore, useSettings } from './settingsStore.js';
	import Config from './Config.svelte';
  
	
	import {
	normalizeName,      // Handles normalization of names
	formatNationName,   // Formats nation names
	formatPrice,        // Formats prices
	formatLargeNumber,  // Formats large numbers
	formatDate          // Formats dates
	} from './settingsUtils';

	import {
	fetchData,          // Fetch data from API
	tallyCounts,        // Tally counts from trades/gifts
	makeTallyColumns,   // Generate columns for tally tables
	makeTallyRows,      // Generate rows for tally tables
	makeTradeColumns,   // Generate columns for trade tables
	makeGiftColumns,    // Generate columns for gift tables
	makeTradeRows,      // Generate rows for trade tables
	makeGiftRows,        // Generate rows for gift tables
	getQueryParam,
	setQueryParam,
	} from './dataUtils';


	import {
		fetchPuppets,       // Fetch puppet mappings from Google Sheets
	} from './puppetsFetch';
  
	import CollapsibleTable from './CollapsibleTable.svelte';
	import LoadingTable from './LoadingTable.svelte';
  
	let nationId = '';
	let loading = false;
	let buys = [];
	let sells = [];
	let buyTallyTrades = [];
	let buyTallyGifts = [];
	let sellTallyTrades = [];
	let sellTallyGifts = [];
	let showConfig = false;
  
	// Reactive settings from the store
	import { get } from 'svelte/store';
	$: settings = get(settingsStore);
  
	async function loadTradeData() {
	  if (!nationId.trim()) {
		alert('Please enter a nation name.');
		return;
	  }
  
	  loading = true;
	  const safeNation = nationId.trim().replace(/\s+/g, '_');
	  setQueryParam('q', safeNation);
  
	  buys = [];
	  sells = [];
	  buyTallyTrades = [];
	  buyTallyGifts = [];
	  sellTallyTrades = [];
	  sellTallyGifts = [];
  
	  const [fetchedBuys, fetchedSells] = await Promise.all([
		fetchData('buyer', safeNation),
		fetchData('seller', safeNation),
	  ]);
  
	  buys = fetchedBuys;
	  sells = fetchedSells;
  
	  buyTallyTrades = await tallyCounts(buys, 'seller', true);
	  buyTallyGifts = await tallyCounts(buys, 'seller', false);
	  sellTallyTrades = await tallyCounts(sells, 'buyer', true);
	  sellTallyGifts = await tallyCounts(sells, 'buyer', false);
  
	  loading = false;
	}
  
	onMount(async () => {
  console.log("onMount triggered.");
  console.log("Current settings before fetch:", useSettings());
  console.log("Fetching puppets on initialization...");
  await fetchPuppets();
  console.log("Puppets fetched.");

  const fromURL = getQueryParam('q');
  if (fromURL) {
    console.log("Loading trade data for:", fromURL);
    nationId = fromURL;
    loadTradeData();
  }
});

  
	function handleEnter(e) {
	  if (e.key === 'Enter') {
		loadTradeData();
	  }
	}
  
	function openConfig() {
	  showConfig = true;
	}
  
	function closeConfig() {
	  showConfig = false;
	}
  </script>

<!-- Page Layout Wrapper -->
<div class="px-1.5 sm:px-4 md:px-6 lg:px-8 xl:px-[6%] my-16">
	<!-- Header / Input Section -->
	<div class="relative text-center mb-4">
		<!-- Header Title -->
		<h1 class="text-2xl font-bold font-inter">Unsmurf thru Card Trades</h1>
		<p class="text-gray-600">
			An alternative UI for
			<a href="https://bazaar.kractero.com/" class="text-blue-500 hover:underline">Kractero's Bazaar</a>
			to make identifying puppets easier.
		</p>

		<!-- Input Section -->
		<div class="flex items-center justify-between mt-4 w-full">
			<div class="flex-1"></div>
			<div class="flex-3 flex items-center justify-center gap-2">
				<input
					id="nationId"
					type="text"
					bind:value={nationId}
					on:keypress={handleEnter}
					placeholder="Testlandia"
					class="border border-gray-300 rounded-full px-3 py-2 focus:ring focus:ring-blue-300 focus:outline-none"
				/>
				<button
					on:click={loadTradeData}
					class="bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-600 focus:ring focus:ring-blue-300 transition"
				>
					Lookup
				</button>
			</div>
			<div class="flex-1 flex justify-end">
				<button
					on:click={openConfig}
					class="bg-black text-white font-bold p-2 size-10 rounded-full hover:bg-gray-600 focus:ring focus:ring-gray-300 transition"
				>
					≣
				</button>
			</div>
		</div>
	</div>

  <!-- Config Overlay -->
  {#if showConfig}
    <div class="fixed inset-0 bg-gray-800 bg-opacity-50 z-50 flex justify-center items-center">
      <Config {settingsStore} on:close={closeConfig} />
    </div>
  {/if}

	<!-- TALLY ROWS -->
	<div id="tally-row" class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 :gap-4"> <!-- Cards Sold -->
	  <!-- Gifts Sent -->
	  <div>
			{#if loading}
			  <LoadingTable title="Gifts Sent" content="Loading data..." />
			{:else}
			  <CollapsibleTable
				title="Gifts Sent"
				defaultRows={10}
				increment={10}
				columns={makeTallyColumns(sellTallyGifts)}
				rows={makeTallyRows(sellTallyGifts)}
			  />
			{/if}
	  </div>
	  <!-- Gifts Received -->
	  <div>
			{#if loading}
			  <LoadingTable title="Gifts Received" content="Loading data..." />
			{:else}
			  <CollapsibleTable
				title="Gifts Received"
				defaultRows={10}
				increment={10}
				columns={makeTallyColumns(buyTallyGifts)}
				rows={makeTallyRows(buyTallyGifts)}
			  />
			{/if}
	  </div>
	  <!-- Cards Sold -->
	  <div>
		{#if loading}
		  <LoadingTable title="Cards Sold" content="Loading data..." />
		{:else}
		  <CollapsibleTable
			title="Cards Sold"
			defaultRows={10}
			increment={10}
			columns={makeTallyColumns(sellTallyTrades)}
			rows={makeTallyRows(sellTallyTrades)}
		  />
		{/if}
	  </div>
	  <!-- Cards Purchased -->
	  <div>
			{#if loading}
			  <LoadingTable title="Cards Purchased" content="Loading data..." />
			{:else}
			  <CollapsibleTable
				title="Cards Purchased"
				defaultRows={10}
				increment={10}
				columns={makeTallyColumns(buyTallyTrades)}
				rows={makeTallyRows(buyTallyTrades)}
			  />
			{/if}
	  </div>
	</div>

	<!-- DETAILED GRIDS -->
	<div class="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-2.5 md:gap-4 mt-6">
	   <!-- Detailed Gifts Sent -->
		<div>
				{#if loading}
				  <LoadingTable title="Detailed Gifts Sent" content="Loading data..." />
				{:else}
				  <CollapsibleTable
					title="Detailed Gifts Sent"
					columns={makeGiftColumns('buyer')}
					rows={makeGiftRows(sells, 'buyer')}
					defaultRows={25}
					increment={25}
				  />
				{/if}
		</div>
		  <!-- Detailed Gifts Received -->
		 <div>
				{#if loading}
				  <LoadingTable title="Detailed Gifts Received" content="Loading data..." />
				{:else}
				  <CollapsibleTable
					title="Detailed Gifts Received"
					columns={makeGiftColumns('seller')}
					rows={makeGiftRows(buys, 'seller')}
					defaultRows={25}
					increment={25}
				  />
				{/if}
		</div>
		<!-- Detailed Cards Sold -->
	  <div>
		{#if loading}
		  <LoadingTable title="Detailed Cards Sold" content="Loading data..." />
		{:else}
		  <CollapsibleTable
			title="Detailed Cards Sold"
			columns={makeTradeColumns('buyer')}
			rows={makeTradeRows(sells, 'buyer')}
			defaultRows={25}
			increment={25}
		  />
		{/if}
	  </div>
	  <!-- Detailed Cards Purchased -->
	  <div>
		{#if loading}
		  <LoadingTable title="Detailed Cards Purchased" content="Loading data..." />
		{:else}
		  <CollapsibleTable
			title="Detailed Cards Purchased"
			columns={makeTradeColumns('seller')}
			rows={makeTradeRows(buys, 'seller')}
			defaultRows={25}
			increment={25}
		  />
		{/if}
	  </div>
	</div>
  </div>
