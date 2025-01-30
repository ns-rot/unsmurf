<script>
  export let nationId;
  export let handleEnter;
  export let redirectToPage;
  export let openConfig;
</script>

<div class="relative text-center mb-4">
  <h1 class="text-2xl font-bold font-inter">Unsmurf thru Card Trades</h1>
  <p class="text-gray-600">
    An alternative UI for
    <a href="https://bazaar.kractero.com/" class="text-blue-500 hover:underline">Kractero's Bazaar</a>
    to make identifying puppets easier.
  </p>

  <div class="flex items-center justify-between mt-4 w-full">
    <div class="flex-1"></div>
    <div class="flex-3 flex items-center justify-center gap-2">
      <input
        type="text"
        bind:value={nationId}
        on:keypress={handleEnter}
        placeholder="Testlandia"
        class="border border-gray-300 rounded-full px-3 py-2 focus:ring focus:ring-blue-300 focus:outline-none"
      />
      <button
        on:click={redirectToPage}
        class="bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-600 focus:ring focus:ring-blue-300 transition"
      >
        Lookup
      </button>
    </div>
    <div class="flex-1 flex justify-end">
      <button
        on:click={openConfig}
        aria-label="Config"
        class="bg-black text-white font-bold p-2 size-10 rounded-full hover:bg-gray-600 focus:outline-none focus:ring focus:ring-gray-300 transition"
      >
        <img src="https://ns-rot.github.io/unsmurf/icons/config.svg" alt="Config" class="w-6 h-6" />
      </button>
    </div>
  </div>
</div>