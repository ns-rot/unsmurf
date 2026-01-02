<script>
  import { canonicalizeName, uncanonicalizeName } from "./settingsUtils.js";
  import {
    isNationCurrent,
    findPuppetmaster,
    listPuppets,
    tallyPuppets,
  } from "./sheetFetch.js";
  import PuppetPopup from "./PuppetPopup.svelte";

  export let nationId = "";

  // Debugging logs
  $: console.log("nationId updated in NationAlert:", nationId);

  // Compute derived values reactively
  $: canonicalizedName = canonicalizeName(nationId);
  $: canonicalizedMasterName = (() => {
    const info = findPuppetmaster(canonicalizedName).master;
    return canonicalizeName(info) === canonicalizedName ? "" : info;
  })();
  $: isCTE = !isNationCurrent(canonicalizedName);

  // Ensure a nation is NOT a puppet of itself
  $: isPuppet = canonicalizedMasterName != "" ? true : false;

  // If nation is a puppet, check if the master is a CTE
  $: isMasterCte = !isNationCurrent(canonicalizedMasterName);

  // Get puppet counts
  $: puppetCountSelf = tallyPuppets(canonicalizedName); // Puppets under the current nation
  $: puppetCountMaster = tallyPuppets(canonicalizedMasterName); // Puppets under the master nation

  // Choose which tally to display
  $: puppetTally = isPuppet ? puppetCountMaster : puppetCountSelf;

  // Format names for display
  $: formattedName = isCTE
    ? "<span class='select-none'>&#xe000;&#x2009;</span>" + uncanonicalizeName(canonicalizedName)
    : uncanonicalizeName(canonicalizedName);

  $: formattedMasterName = isMasterCte
    ? "<span class='select-none'>&#xe000;&#x2009;</span>" + uncanonicalizeName(canonicalizedMasterName)
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
    puppetTally > 0 ? `<br>${puppetTally} known puppets` : "<br>No known puppets";
    
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
  $: popupNationName = isPuppet ? uncanonicalizeName(canonicalizedMasterName) : uncanonicalizeName(canonicalizedName);
  
  // Get the list of puppets to display in the popup
  $: puppetList = (() => {
    const nameToCheck = isPuppet ? canonicalizedMasterName : canonicalizedName;
    return listPuppets(nameToCheck).map(puppet => uncanonicalizeName(puppet));
  })();
</script>

<!-- Alert Banner -->
<div
  class="mx-[-0.375rem] sm:mx-[-1rem] md:mx-[-1.5rem] lg:mx-[-2rem] xl:mx-[-6%] font-inter py-4 mt-4 mb-2 transition-all duration-200 min-h-[3rem]"
  role="alert"
  style="background-color: {bgColor}; color: {textColor}; transition: background-color 0.5s, color 0.5s;"
>
  <div class="w-[80%] mx-auto text-center">
    <span class="text-xl">
      {@html alertMessage}
    </span>
    <span class="text-lg inline-flex items-center">
      {@html alertMessagePuppetCount}
      {#if showInfoButton}
        <button
          on:click={togglePopup}
          class="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full border border-current text-xs font-semibold cursor-pointer"
          aria-label="More information about puppets"
        >
          i
        </button>
      {/if}
    </span>
  </div>
</div>

<!-- Puppet Popup -->
{#if isPopupVisible && showInfoButton}
  <PuppetPopup
    nationName={popupNationName}
    puppetCount={puppetTally}
    puppetList={puppetList}
    onClose={closePopup}
  />
{/if}
