<script>
  import { getAllNationLinks } from "./dataUtils";

  export let nationName = "";
  export let x = 0;
  export let y = 0;
  export let onClose = () => {};
  export let onPick = () => {};

  let links = getAllNationLinks(nationName);

  function openLink(url) {
    if (url) {
      window.open(url, "_blank");
    }
    onPick();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed z-[9999] bg-white dark:bg-gray-800 midnight:!bg-black border border-gray-200 dark:border-gray-700 midnight:!border-gray-800 rounded-md shadow-xl py-0.5 w-28 text-xs overflow-hidden"
  style="left: {x}px; top: {y}px;"
  on:mouseleave={onClose}
>
  {#each links as link}
    <button
      on:click={() => openLink(link.url)}
      class="w-full text-left px-1.5 py-0.5 text-gray-700 dark:text-gray-200 midnight:!text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 midnight:hover:!bg-[#0f1115] transition-colors disabled:opacity-40 disabled:cursor-not-allowed truncate"
      disabled={!link.url}
      title={link.url || "No custom URL configured"}
    >
      {link.label}
    </button>
  {/each}
</div>
