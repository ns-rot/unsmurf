<script>
  import { createEventDispatcher } from "svelte";

  export let currentView = "trades";
  const dispatch = createEventDispatcher();

  function setView(view) {
    dispatch("viewChange", view);
  }

  function openSettings() {
    dispatch("showSettings");
  }
</script>

<!-- ═══════════════════════════════════════════════════
     DESKTOP: Fixed left sidebar (md and above)
     ═══════════════════════════════════════════════════ -->
<aside
  class="hidden md:flex fixed left-0 top-0 h-screen w-16 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col z-50 transition-all duration-300"
  aria-label="Main Navigation"
>
  <!-- Top Section: Navigation (Vertically Centered) -->
  <div class="flex-grow flex flex-col items-center justify-center gap-6">
    <!-- Trade Icon -->
    <button
      on:click={() => setView("trades")}
      class="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 {currentView ===
      'trades'
        ? 'bg-blue-500 text-white shadow-md'
        : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'}"
      aria-label="Trade Search"
      title="Trade Search"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.8">
        <circle cx="12" cy="12" r="8" stroke-dasharray="21 4.13" transform="rotate(-40 12 12)" />
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
  </div>

  <!-- Bottom Section: Settings -->
  <div class="p-4 flex flex-col items-center gap-2 mb-2">
    <button
      on:click={openSettings}
      class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-all duration-200"
      aria-label="Settings"
      title="Settings"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    </button>
  </div>
</aside>

<!-- ═══════════════════════════════════════════════════
     MOBILE: Fixed bottom bar (below md)
     ═══════════════════════════════════════════════════ -->
<nav
  class="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center px-4 z-50"
  aria-label="Mobile Navigation"
>
  <!-- Left: Nav items -->
  <div class="flex items-center gap-3">
    <!-- Trade icon -->
    <button
      on:click={() => setView("trades")}
      class="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 {currentView ===
      'trades'
        ? 'bg-blue-500 text-white shadow-md'
        : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'}"
      aria-label="Trade Search"
      title="Trade Search"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.8">
        <circle cx="12" cy="12" r="8" stroke-dasharray="21 4.13" transform="rotate(-40 12 12)" />
      </svg>
    </button>

    <!-- Puppetmaster icon -->
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
  </div>

  <!-- Right: Settings -->
  <div class="ml-auto">
    <button
      on:click={openSettings}
      class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-all duration-200"
      aria-label="Settings"
      title="Settings"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    </button>
  </div>
</nav>
