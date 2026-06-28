<script>
  export let nationId;
  export let loadTradeData;
  export let onRandom;
  export let loading = false;
  export let randomLoading = false;

  function lookupNation() {
    if (!nationId.trim()) {
      alert("Please enter a nation name.");
      return;
    }

    loadTradeData();
  }

  export function handleEnter(e) {
    if (e.key === "Enter") {
      lookupNation();
    }
  }
</script>

<div class="w-full">
  <div class="flex items-center gap-2 w-full max-w-xl">
    <div class="relative w-full min-w-0">
      <input
        type="text"
        bind:value={nationId}
        on:keydown={handleEnter}
        placeholder="Testlandia"
        class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 rounded-full px-4 py-2 pr-12 focus:outline-none w-full text-left transition-colors shadow-sm"
      />
      <button
        on:click={onRandom}
        disabled={loading || randomLoading}
        title="Random nation"
        class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>
    <button
      on:click={lookupNation}
      disabled={loading}
      class="bg-gray-800 hover:bg-gray-900 dark:bg-gray-200 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold py-2 px-6 rounded-full focus:outline-none transition shadow-md shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Searching..." : "Lookup"}
    </button>
  </div>
</div>
