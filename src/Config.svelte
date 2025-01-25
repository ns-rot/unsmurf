<script>
  import { createEventDispatcher } from 'svelte';
  import { settingsStore } from './settingsStore.js';

  const dispatch = createEventDispatcher();
  let settings;

  // Subscribe to settingsStore
  settingsStore.subscribe((value) => {
    settings = value;
  });

  function saveSettings() {
    console.log('[Config] Saving Settings:', settings);
    settingsStore.set(settings); // Save changes to the store
    dispatch('close'); // Notify parent to close the modal
  }
</script>

<div class="settings-modal bg-white rounded-lg shadow-lg p-6 max-w-2xl w-[80%] md:w-[50%] relative">
  <h2 class="text-xl font-bold mb-2.5">Settings</h2>

  <!-- Tally Record Options -->
  <div class="mb-4">
    <h3 class="text-lg font-semibold">Tally Record Options</h3>
    <label class="flex items-center gap-2">
      <input type="radio" name="section" value="puppets" bind:group={settings.section} />
      Tally record by known puppets
    </label>
    <label
    class="flex items-center gap-2 pl-6 transition-opacity duration-300 ease-in-out"
  >
  
    <input
      type="checkbox"
      bind:checked={settings.showPuppetmasters}
      disabled={settings.section !== 'puppets'}
      class:opacity-50={settings.section !== 'puppets'}
      class:cursor-not-allowed={settings.section !== 'puppets'}
    />
    Append puppetmasters in detailed records
  </label>
    <label
      class="flex items-center gap-2 transition-opacity duration-300 ease-in-out"
    >
    <label class="flex items-center gap-2">
      <input type="radio" name="section" value="similar-name" bind:group={settings.section} />
      Tally record by similar name
    </label>
  </div>

  <!-- Date Options -->
  <div class="mb-4">
    <h3 class="text-lg font-semibold">Date Options</h3>
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={settings.showRelativeDate} />
      Show relative date by default
    </label>
  </div>

  <!-- UI Options-->
  <div class="mb-4">
    <h3 class="text-lg font-semibold">UI Options</h3>
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={settings.redEpics} />
      Red epics
    </label>
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={settings.rainbowLegs} />
      Rainbow legendaries
    </label>
  </div>

  <!-- Confirm Button -->
  <div class="flex justify-end mt-4">
    <button
      on:click={saveSettings}
      class="bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-600 focus:ring focus:ring-blue-300 transition"
    >
      Confirm
    </button>
  </div>
</div>
