<script>
  import { createEventDispatcher } from "svelte";

  export let currentView = "trades";
  const dispatch = createEventDispatcher();

  function setView(view) {
    dispatch("viewChange", view);
  }
</script>

<aside
  class="fixed left-0 top-0 h-screen w-16 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-6 z-50 transition-all duration-300"
  aria-label="Main Navigation"
>
  <!-- Abstract Trade Icon -->
  <button
    on:click={() => setView("trades")}
    class="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 {currentView ===
    'trades'
      ? 'bg-blue-500 text-white shadow-md'
      : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'}"
    aria-label="Trade Search"
    title="Trade Search"
  >
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      stroke-width="2.8"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke-dasharray="21 4.13"
        transform="rotate(-40 12 12)"
      />
    </svg>
  </button>

  <!-- Puppetmaster Icon -->
  <button
    on:click={() => setView("masters")}
    class="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 {currentView ===
    'masters'
      ? 'bg-blue-500 text-white shadow-md'
      : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'}"
    aria-label="Puppetmasters"
    title="Puppetmasters"
  >
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <circle cx="12" cy="4" r="2.2" />
      <circle cx="17.6" cy="6.4" r="2.2" />
      <circle cx="20" cy="12" r="2.2" />
      <circle cx="17.6" cy="17.6" r="2.2" />
      <circle cx="12" cy="20" r="2.2" />
      <circle cx="6.4" cy="17.6" r="2.2" />
      <circle cx="4" cy="12" r="2.2" />
      <circle cx="6.4" cy="6.4" r="2.2" />
    </svg>
  </button>
</aside>
