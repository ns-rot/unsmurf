<script>
  import { createEventDispatcher } from 'svelte';
  import { settingsStore } from './settingsStore.js';

  export let showConfig = false; // ✅ Prop to control visibility
  export let closeConfig; // ✅ Callback to close modal

  const dispatch = createEventDispatcher();

  function saveSettings() {
    dispatch('close'); // Notify parent to close modal
    closeConfig();
  }
</script>

{#if showConfig}
  <div class="fixed inset-0 bg-gray-800 bg-opacity-50 z-50 flex justify-center items-center">
    <div class="settings-modal bg-white rounded-lg shadow-lg p-6 max-w-2xl w-[80%] md:w-[50%] relative">
      <h2 class="text-xl font-bold mb-2.5">Settings</h2>

      <!-- Tally Record Options -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold">Tally Record Options</h3>
        <label class="flex items-center gap-2">
          <input type="radio" name="section" value="puppets" bind:group={$settingsStore.section} />
          Group records by known puppets
        </label>
        <label class="flex items-center gap-2">
          <input type="radio" name="section" value="similar-name" bind:group={$settingsStore.section} />
          Group records by similar name
        </label>
        <label class="flex items-center gap-2">
          <input type="radio" name="section" value="none" bind:group={$settingsStore.section} />
          Do not group records
        </label>
      </div>

      <!-- Nation Display Options -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold">Nation Display Options</h3>
        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={$settingsStore.showPuppetmasters} />
          Append puppetmasters in detailed records
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={$settingsStore.showCTE} />
          Mark CTE nations
        </label>
      </div>

      <!-- Date Options -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold">Date Options</h3>
        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={$settingsStore.showRelativeDate} />
          Show relative date by default
        </label>
      </div>

      <!-- UI Options -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold">Colour Options</h3>
        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={$settingsStore.redEpics} />
          Red epics
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={$settingsStore.rainbowLegs} />
          Rainbow legendaries
        </label>
      </div>

      <!-- Buttons -->
      <div class="flex justify-end mt-4">
        <button
          on:click={saveSettings}
          class="bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-600 focus:ring focus:ring-blue-300 transition"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}