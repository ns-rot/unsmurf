<script>
  import { canonicalizeName, uncanonicalizeName } from "./settingsUtils.js";
  import {
    isNationCurrent,
    findPuppetmaster,
    listPuppets,
    tallyPuppets,
    countActivePuppets,
  } from "./sheetFetch.js";
  import PuppetPopup from "./PuppetPopup.svelte";

  import { settingsStore } from "./settingsStore.js";

  export let nationId = "";

  // Debugging logs
  $: console.log("nationId updated in NationAlert:", nationId);

  // Compute derived values reactively
  $: dataReady = $settingsStore.dataFetched;
  $: canonicalizedName = canonicalizeName(nationId);
  $: canonicalizedMasterName = (() => {
    if (!dataReady) return "";
    const info = findPuppetmaster(canonicalizedName).master;
    return canonicalizeName(info) === canonicalizedName ? "" : info;
  })();
  $: isCTE = dataReady ? !isNationCurrent(canonicalizedName) : false;

  // Ensure a nation is NOT a puppet of itself
  $: isPuppet = canonicalizedMasterName != "" ? true : false;

  // If nation is a puppet, check if the master is a CTE
  $: isMasterCte = dataReady
    ? !isNationCurrent(canonicalizedMasterName)
    : false;

  // Get puppet counts
  $: puppetCountSelf = dataReady ? tallyPuppets(canonicalizedName) : 0; // Puppets under the current nation
  $: puppetCountMaster = dataReady ? tallyPuppets(canonicalizedMasterName) : 0; // Puppets under the master nation

  // Choose which tally to display
  $: puppetTally = isPuppet ? puppetCountMaster : puppetCountSelf;

  // Active puppet count
  $: activePuppetTally = dataReady
    ? countActivePuppets(
        listPuppets(isPuppet ? canonicalizedMasterName : canonicalizedName),
      )
    : 0;

  // Format names for display
  $: formattedName = isCTE
    ? "<span class='select-none text-red-600 dark:text-red-400'>&#xe000;&#x2009;</span>" +
      uncanonicalizeName(canonicalizedName)
    : uncanonicalizeName(canonicalizedName);

  $: formattedMasterName = isMasterCte
    ? "<span class='select-none text-red-600 dark:text-red-400'>&#xe000;&#x2009;</span>" +
      uncanonicalizeName(canonicalizedMasterName)
    : uncanonicalizeName(canonicalizedMasterName);

  // Background & text color logic
  $: bgColor =
    canonicalizedName.length <= 2
      ? "#00000000"
      : isCTE
        ? "#000000FF"
        : "#00000000";

  $: textColor =
    canonicalizedName.length <= 2 ? "#00000000" : isCTE ? "#FFFFFF" : "#000000";

  // Alert message logic
  $: alertMessage = (() => {
    if (canonicalizedName.length <= 2) {
      return "　"; // Single CJK space
    }

    let returnValue = `<strong>${formattedName}</strong>`;

    if (isPuppet) {
      returnValue += ` (<strong>${formattedMasterName}</strong>)`;
    }

    return returnValue;
  })();

  $: alertMessagePuppetCount =
    puppetTally > 0
      ? `<br>${puppetTally !== activePuppetTally ? ` ${activePuppetTally}/` : ""}${puppetTally} puppets`
      : "";

  // Whether to show the info button (only when there are puppets)
  $: showInfoButton = puppetTally > 0;

  // State for popup visibility
  let isPopupVisible = false;

  // Toggle popup visibility
  function togglePopup() {
    isPopupVisible = !isPopupVisible;
  }

  // Close popup
  function closePopup() {
    isPopupVisible = false;
  }

  // Get the display name for the popup title
  $: popupNationName = isPuppet
    ? uncanonicalizeName(canonicalizedMasterName)
    : uncanonicalizeName(canonicalizedName);

  // Get the list of puppets to display in the popup
  $: puppetList = (() => {
    const nameToCheck = isPuppet ? canonicalizedMasterName : canonicalizedName;
    return listPuppets(nameToCheck).map((puppet) => uncanonicalizeName(puppet));
  })();
</script>

<!-- Alert Banner -->
{#if isCTE || puppetTally > 0}
  <div
    class="font-inter py-2 px-6 rounded-2xl transition-all duration-200 shadow-md block w-full sm:inline-block sm:w-auto sm:min-w-[300px] bg-gray-600 dark:bg-gray-800 text-white"
    role="alert"
  >
    <div class="text-center">
      <div class="text-lg font-bold leading-tight">
        {@html alertMessage}
      </div>
      {#if showInfoButton}
        <button
          on:click={togglePopup}
          class="text-sm font-medium leading-tight opacity-90 mt-1 hover:opacity-100 hover:underline decoration-dotted underline-offset-2 cursor-pointer focus:outline-none w-full"
          aria-label="View puppets"
        >
          {@html alertMessagePuppetCount.replace("<br>", "")}
        </button>
      {:else}
        <div
          class="text-sm font-medium leading-tight opacity-75 mt-1 cursor-default"
        >
          {@html alertMessagePuppetCount.replace("<br>", "")}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Puppet Popup -->
{#if isPopupVisible && showInfoButton}
  <PuppetPopup
    nationName={popupNationName}
    puppetCount={puppetTally}
    {puppetList}
    onClose={closePopup}
  />
{/if}
