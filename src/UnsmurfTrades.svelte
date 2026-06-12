<script>
  export let nationId;
  export let loadTradeData;
  export let loading = false;

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
    <input
      type="text"
      bind:value={nationId}
      on:keydown={handleEnter}
      placeholder="Testlandia"
      class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 rounded-full px-4 py-2 focus:outline-none w-full min-w-0 text-left transition-colors shadow-sm"
    />
    <button
      on:click={lookupNation}
      disabled={loading}
      class="bg-gray-800 hover:bg-gray-900 dark:bg-gray-200 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold py-2 px-6 rounded-full focus:outline-none transition shadow-md shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Searching..." : "Lookup"}
    </button>
  </div>
</div>
