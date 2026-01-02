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
    <div class="settings-modal bg-white rounded-lg shadow-lg p-6 max-w-2xl w-[80%] md:w-[50%] relative max-h-[90vh] overflow-y-auto">
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

      <!-- Link Options -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold mb-2">Link Options</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Tally Section -->
          <div class="bg-gray-50 p-3 rounded">
            <h4 class="font-medium text-gray-900 mb-2">Tally Tables</h4>
            
            <div class="mb-3">
              <label class="block text-xs font-medium text-gray-500 uppercase mb-1">Sent / Sold</label>
              <select bind:value={$settingsStore.linkTypeTallySent} class="border border-gray-300 rounded px-2 py-1 w-full text-sm">
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>

            <div class="mb-1">
              <label class="block text-xs font-medium text-gray-500 uppercase mb-1">Received / Purchased</label>
              <select bind:value={$settingsStore.linkTypeTallyReceived} class="border border-gray-300 rounded px-2 py-1 w-full text-sm">
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>
          </div>

          <!-- Detailed Section -->
          <div class="bg-gray-50 p-3 rounded">
            <h4 class="font-medium text-gray-900 mb-2">Detailed Tables</h4>
            
            <div class="mb-3">
              <label class="block text-xs font-medium text-gray-500 uppercase mb-1">Sent / Sold</label>
              <select bind:value={$settingsStore.linkTypeDetailedSent} class="border border-gray-300 rounded px-2 py-1 w-full text-sm">
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>

            <div class="mb-1">
              <label class="block text-xs font-medium text-gray-500 uppercase mb-1">Received / Purchased</label>
              <select bind:value={$settingsStore.linkTypeDetailedReceived} class="border border-gray-300 rounded px-2 py-1 w-full text-sm">
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>
          </div>
        </div>

        <div class="pt-3">
          <label class="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" bind:checked={$settingsStore.enableCTELink} class="rounded text-blue-600 focus:ring-blue-500" />
            <span class="font-medium text-gray-900">Override for CTE Nations</span>
          </label>
          
          {#if $settingsStore.enableCTELink}
            <div class="ml-6">
              <select bind:value={$settingsStore.linkTypeCTE} class="border border-gray-300 rounded px-2 py-1 w-full text-sm">
                <option value="nation">Nation Page</option>
                <option value="trades">Trades Page</option>
                <option value="buys">Trades (Buys)</option>
                <option value="sells">Trades (Sales)</option>
                <option value="unsmurf">Unsmurf</option>
                <option value="boneyard">Boneyard</option>
                <option value="custom">Custom URL</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">Applies to all links for nations that have Ceased To Exist.</p>
            </div>
          {/if}
        </div>

        <!-- Custom URL Input -->
        {#if $settingsStore.linkTypeTallySent === 'custom' || 
             $settingsStore.linkTypeTallyReceived === 'custom' || 
             $settingsStore.linkTypeDetailedSent === 'custom' || 
             $settingsStore.linkTypeDetailedReceived === 'custom' || 
             ($settingsStore.enableCTELink && $settingsStore.linkTypeCTE === 'custom')}
          <div class="pt-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Custom URL Template</label>
            <input 
              type="text" 
              bind:value={$settingsStore.customLinkTemplate} 
              placeholder="https://example.com/?nation={'{nation}'}"
              class="border border-gray-300 rounded px-2 py-1 w-full text-sm"
            />
            <p class="text-xs text-gray-500 mt-1">Use <code>{'{nation}'}</code> as a placeholder for the nation name.</p>
          </div>
        {/if}
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